// ============================================================================
// FILE: supabase/functions/_shared/assistant-tools.ts
// ============================================================================
// Defines the tool surface the AI can call. Each tool has:
//   - JSON schema (sent to the model)
//   - Handler function (executes against the database)
//   - safety_level: 'read' | 'draft' | 'destructive'
//
// 'read' and 'draft' execute immediately.
// 'destructive' creates a pending_action that requires AJ to confirm.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

export type SafetyLevel = "read" | "draft" | "destructive";

export type ToolDefinition = {
  name: string;
  description: string;
  safety_level: SafetyLevel;
  parameters: any; // JSON schema
  handler: (args: any, ctx: ToolContext) => Promise<any>;
};

export type ToolContext = {
  supabase: ReturnType<typeof createClient>;
  sitterId: string;
  conversationId: string;
};

// ============================================================================
// HELPER: format money
// ============================================================================
function fmt(cents: number | null | undefined): string {
  if (cents == null) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

// ============================================================================
// READ TOOLS
// ============================================================================

const queryInvoices: ToolDefinition = {
  name: "query_invoices",
  description: "Find invoices by status, customer, or date range. Use this when AJ asks about invoices, payments, money owed, or who needs to pay.",
  safety_level: "read",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "array",
        items: { type: "string", enum: ["draft", "sent", "paid", "overdue", "partial", "void", "refunded"] },
        description: "Filter by invoice status. 'overdue' specifically means sent invoices past their due date.",
      },
      customer_name_contains: {
        type: "string",
        description: "Partial customer name match. Case-insensitive.",
      },
      min_amount_cents: { type: "number" },
      max_amount_cents: { type: "number" },
      limit: { type: "number", description: "Max results to return. Default 20." },
    },
  },
  handler: async (args, ctx) => {
    let query = ctx.supabase
      .from("invoices")
      .select("id, invoice_number, status, total_cents, amount_paid_cents, due_date, customer_id, issued_at, created_at")
      .eq("sitter_id", ctx.sitterId);

    if (args.status?.length) {
      // Special handling for "overdue": status='sent' AND due_date < today
      if (args.status.length === 1 && args.status[0] === "overdue") {
        const today = new Date().toISOString().slice(0, 10);
        query = query.in("status", ["sent", "partial"]).lt("due_date", today);
      } else {
        query = query.in("status", args.status);
      }
    }

    if (args.min_amount_cents) query = query.gte("total_cents", args.min_amount_cents);
    if (args.max_amount_cents) query = query.lte("total_cents", args.max_amount_cents);

    const { data, error } = await query.order("created_at", { ascending: false }).limit(args.limit ?? 20);
    if (error) return { error: error.message };

    // Resolve customer names
    const ids = Array.from(new Set((data ?? []).map((i: any) => i.customer_id).filter(Boolean)));
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    let results = (data ?? []).map((inv: any) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: nameById.get(inv.customer_id) ?? "Unknown",
      status: inv.status,
      total: fmt(inv.total_cents),
      paid: fmt(inv.amount_paid_cents),
      owed: fmt((inv.total_cents ?? 0) - (inv.amount_paid_cents ?? 0)),
      due_date: inv.due_date,
      days_overdue: inv.due_date
        ? Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (24 * 60 * 60 * 1000)))
        : 0,
      issued_at: inv.issued_at,
    }));

    // Client-side customer filter (Supabase doesn't make string-on-joined-table ergonomic)
    if (args.customer_name_contains) {
      const q = args.customer_name_contains.toLowerCase();
      results = results.filter((r) => r.customer_name.toLowerCase().includes(q));
    }

    return {
      count: results.length,
      total_owed: fmt(results.reduce((acc, r) => acc + parseInt(r.owed.replace(/[^0-9-]/g, "")), 0)),
      invoices: results,
    };
  },
};

const queryBookings: ToolDefinition = {
  name: "query_bookings",
  description: "Find bookings by status, customer, pet, date range, or service. Use when AJ asks about her schedule, upcoming/past bookings, or specific clients' bookings.",
  safety_level: "read",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "array",
        items: { type: "string", enum: ["requested", "pending_payment", "awaiting_payment", "confirmed", "completed", "cancelled", "refunded"] },
      },
      date_from: { type: "string", description: "ISO date YYYY-MM-DD" },
      date_to: { type: "string", description: "ISO date YYYY-MM-DD" },
      customer_name_contains: { type: "string" },
      pet_name_contains: { type: "string" },
      service_slug: { type: "string", description: "Filter by service slug like 'solo-walk', 'boarding'" },
      limit: { type: "number" },
    },
  },
  handler: async (args, ctx) => {
    let query = ctx.supabase
      .from("bookings")
      .select("id, status, start_at, end_at, scheduled_start_at, requested_date, requested_window_label, customer_id, payment_amount_cents, total_cents, services(name, slug), pets(name)")
      .eq("sitter_id", ctx.sitterId);

    if (args.status?.length) query = query.in("status", args.status);
    if (args.date_from) query = query.gte("start_at", new Date(args.date_from + "T00:00:00Z").toISOString());
    if (args.date_to) query = query.lte("start_at", new Date(args.date_to + "T23:59:59Z").toISOString());

    const { data, error } = await query.order("start_at", { ascending: true }).limit(args.limit ?? 30);
    if (error) return { error: error.message };

    const ids = Array.from(new Set((data ?? []).map((b: any) => b.customer_id).filter(Boolean)));
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    let results = (data ?? []).map((b: any) => ({
      id: b.id,
      customer_name: nameById.get(b.customer_id) ?? "Unknown",
      pet_name: b.pets?.name ?? null,
      service_name: b.services?.name ?? null,
      service_slug: b.services?.slug ?? null,
      status: b.status,
      start_at: b.scheduled_start_at ?? b.start_at,
      end_at: b.end_at,
      requested_date: b.requested_date,
      requested_window_label: b.requested_window_label,
      total: fmt(b.total_cents ?? b.payment_amount_cents),
    }));

    if (args.customer_name_contains) {
      const q = args.customer_name_contains.toLowerCase();
      results = results.filter((r) => r.customer_name.toLowerCase().includes(q));
    }
    if (args.pet_name_contains) {
      const q = args.pet_name_contains.toLowerCase();
      results = results.filter((r) => (r.pet_name ?? "").toLowerCase().includes(q));
    }
    if (args.service_slug) {
      results = results.filter((r) => r.service_slug === args.service_slug);
    }

    return { count: results.length, bookings: results };
  },
};

const queryClients: ToolDefinition = {
  name: "query_clients",
  description: "Find clients (customers) by name. Returns their contact info, total bookings, and last booking date.",
  safety_level: "read",
  parameters: {
    type: "object",
    properties: {
      name_contains: { type: "string" },
      limit: { type: "number" },
    },
  },
  handler: async (args, ctx) => {
    // Get all clients (profiles with bookings under this sitter, or created by this sitter)
    const { data: bookings } = await ctx.supabase
      .from("bookings")
      .select("customer_id, start_at, status")
      .eq("sitter_id", ctx.sitterId);

    const bookingStats = new Map<string, { count: number; last: string | null }>();
    for (const b of bookings ?? []) {
      const cur = bookingStats.get(b.customer_id) ?? { count: 0, last: null };
      cur.count += 1;
      if (!cur.last || b.start_at > cur.last) cur.last = b.start_at;
      bookingStats.set(b.customer_id, cur);
    }

    // Also include manual clients with 0 bookings
    const { data: manual } = await ctx.supabase
      .from("profiles")
      .select("id")
      .eq("created_by_sitter_id", ctx.sitterId);
    for (const m of manual ?? []) {
      if (!bookingStats.has((m as any).id)) bookingStats.set((m as any).id, { count: 0, last: null });
    }

    const ids = Array.from(bookingStats.keys());
    if (!ids.length) return { count: 0, clients: [] };

    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, full_name, phone, mobile_phone, sms_opt_in")
      .in("id", ids);

    let results = (profiles ?? []).map((p: any) => ({
      id: p.id,
      name: p.full_name ?? "Unnamed",
      phone: p.mobile_phone ?? p.phone ?? null,
      sms_opt_in: !!p.sms_opt_in,
      bookings_count: bookingStats.get(p.id)?.count ?? 0,
      last_booking: bookingStats.get(p.id)?.last ?? null,
    }));

    if (args.name_contains) {
      const q = args.name_contains.toLowerCase();
      results = results.filter((r) => r.name.toLowerCase().includes(q));
    }

    return { count: results.length, clients: results.slice(0, args.limit ?? 20) };
  },
};

const queryPets: ToolDefinition = {
  name: "query_pets",
  description: "Find pets by name or owner. Returns pet details including breed, age, special notes.",
  safety_level: "read",
  parameters: {
    type: "object",
    properties: {
      pet_name_contains: { type: "string" },
      owner_name_contains: { type: "string" },
      limit: { type: "number" },
    },
  },
  handler: async (args, ctx) => {
    // Pets accessed via bookings (so we only see pets this sitter has worked with)
    const { data: bookings } = await ctx.supabase
      .from("bookings")
      .select("pet_id")
      .eq("sitter_id", ctx.sitterId);

    const petIds = Array.from(new Set((bookings ?? []).map((b: any) => b.pet_id).filter(Boolean)));
    if (!petIds.length) return { count: 0, pets: [] };

    const { data: pets } = await ctx.supabase
      .from("pets")
      .select("id, name, breed, age_years, owner_id, notes, photo_url")
      .in("id", petIds);

    const ownerIds = Array.from(new Set((pets ?? []).map((p: any) => p.owner_id).filter(Boolean)));
    const { data: owners } = await ctx.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    const ownerById = new Map((owners ?? []).map((o: any) => [o.id, o.full_name]));

    let results = (pets ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      breed: p.breed,
      age_years: p.age_years,
      owner_name: ownerById.get(p.owner_id) ?? "Unknown",
      notes: p.notes,
      has_photo: !!p.photo_url,
    }));

    if (args.pet_name_contains) {
      const q = args.pet_name_contains.toLowerCase();
      results = results.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (args.owner_name_contains) {
      const q = args.owner_name_contains.toLowerCase();
      results = results.filter((r) => r.owner_name.toLowerCase().includes(q));
    }

    return { count: results.length, pets: results.slice(0, args.limit ?? 20) };
  },
};

const queryRevenue: ToolDefinition = {
  name: "query_revenue",
  description: "Get revenue totals over a date range. Returns total earned, by service, by week/month.",
  safety_level: "read",
  parameters: {
    type: "object",
    properties: {
      date_from: { type: "string", description: "ISO date YYYY-MM-DD" },
      date_to: { type: "string", description: "ISO date YYYY-MM-DD" },
      group_by: { type: "string", enum: ["service", "week", "month", "none"], description: "How to group results" },
    },
    required: ["date_from", "date_to"],
  },
  handler: async (args, ctx) => {
    const { data: payments } = await ctx.supabase
      .from("invoices")
      .select("amount_paid_cents, paid_at, total_cents, status")
      .eq("sitter_id", ctx.sitterId)
      .in("status", ["paid", "partial"])
      .gte("paid_at", new Date(args.date_from + "T00:00:00Z").toISOString())
      .lte("paid_at", new Date(args.date_to + "T23:59:59Z").toISOString());

    const total = (payments ?? []).reduce((acc: number, p: any) => acc + (p.amount_paid_cents ?? 0), 0);
    return {
      total_received: fmt(total),
      total_cents: total,
      invoice_count: payments?.length ?? 0,
      date_from: args.date_from,
      date_to: args.date_to,
    };
  },
};

const queryAvailability: ToolDefinition = {
  name: "query_availability",
  description: "Get AJ's weekly availability and blocked dates. Use when she asks about her schedule structure or what days she's blocked.",
  safety_level: "read",
  parameters: {
    type: "object",
    properties: {
      include_blocked: { type: "boolean", description: "Include upcoming blocked dates. Default true." },
    },
  },
  handler: async (args, ctx) => {
    const { data: avail } = await ctx.supabase
      .from("availability")
      .select("id, weekday, start_minute, end_minute, max_bookings")
      .eq("sitter_id", ctx.sitterId);

    const { data: blocked } = await ctx.supabase
      .from("blocked_dates")
      .select("id, blocked_date, reason")
      .eq("sitter_id", ctx.sitterId)
      .gte("blocked_date", new Date().toISOString().slice(0, 10))
      .order("blocked_date");

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const formatTime = (m: number) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${h % 12 || 12}:${min.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    };

    return {
      weekly_availability: (avail ?? []).map((a: any) => ({
        day: days[a.weekday],
        weekday_num: a.weekday,
        from: formatTime(a.start_minute),
        to: formatTime(a.end_minute),
        max_bookings: a.max_bookings,
      })),
      blocked_dates: (args.include_blocked !== false ? blocked ?? [] : []).map((b: any) => ({
        date: b.blocked_date,
        reason: b.reason,
      })),
    };
  },
};

const queryServices: ToolDefinition = {
  name: "query_services",
  description: "List all active services and their pricing. Use when AJ asks about her services or pricing structure.",
  safety_level: "read",
  parameters: { type: "object", properties: {} },
  handler: async (_args, ctx) => {
    const { data } = await ctx.supabase
      .from("services")
      .select("id, name, slug, description, scheduling_mode, service_variants(name, slug, price_cents, duration_minutes, unit_label)")
      .eq("is_active", true)
      .order("sort_order");

    return {
      services: (data ?? []).map((s: any) => ({
        name: s.name,
        slug: s.slug,
        mode: s.scheduling_mode,
        variants: (s.service_variants ?? []).map((v: any) => ({
          name: v.name,
          price: fmt(v.price_cents),
          duration_minutes: v.duration_minutes,
          unit: v.unit_label,
        })),
      })),
    };
  },
};

const queryInbox: ToolDefinition = {
  name: "query_inbox",
  description: "Get pending booking requests and approval items needing AJ's attention. Use when she asks 'what's in my inbox' or 'what needs my attention'.",
  safety_level: "read",
  parameters: { type: "object", properties: {} },
  handler: async (_args, ctx) => {
    const { data: requests } = await ctx.supabase
      .from("bookings")
      .select("id, customer_id, requested_date, requested_window_label, created_at, services(name), pets(name)")
      .eq("sitter_id", ctx.sitterId)
      .eq("status", "requested")
      .order("created_at", { ascending: false });

    const customerIds = Array.from(new Set((requests ?? []).map((r: any) => r.customer_id).filter(Boolean)));
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", customerIds);
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    return {
      pending_requests: (requests ?? []).map((r: any) => ({
        id: r.id,
        customer: nameById.get(r.customer_id) ?? "Unknown",
        pet: r.pets?.name ?? null,
        service: r.services?.name ?? null,
        requested_date: r.requested_date,
        window: r.requested_window_label,
        requested_at: r.created_at,
      })),
    };
  },
};

// ============================================================================
// DRAFT TOOLS (execute immediately, but produce drafts for AJ to review)
// ============================================================================

const draftClientMessage: ToolDefinition = {
  name: "draft_client_message",
  description: "Draft a message to a client. AJ will see the draft and can edit before sending. Use when she asks to message someone.",
  safety_level: "draft",
  parameters: {
    type: "object",
    properties: {
      client_id: { type: "string", description: "The customer's UUID" },
      tone: { type: "string", enum: ["friendly", "professional", "apologetic", "urgent"], description: "Tone of the message" },
      key_points: { type: "array", items: { type: "string" }, description: "Main points to include" },
    },
    required: ["client_id", "key_points"],
  },
  handler: async (args, ctx) => {
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", args.client_id)
      .single();

    const name = profile?.full_name?.split(" ")[0] ?? "there";
    const tone = args.tone ?? "friendly";

    // Compose a simple draft based on key points
    let body = `Hi ${name},\n\n`;
    if (tone === "apologetic") body += "I wanted to reach out about something. ";
    body += args.key_points.join(" ");
    body += "\n\nThanks,\nAJ";

    return {
      draft_subject: tone === "urgent" ? "Urgent: about your booking" : "A quick note",
      draft_body: body,
      recipient_name: name,
      next_step: "Show this draft to AJ. If she wants to send, create a pending action of type 'send_client_message'.",
    };
  },
};

// ============================================================================
// DESTRUCTIVE TOOLS (create pending_actions that require confirmation)
// ============================================================================

const proposeSendReminder: ToolDefinition = {
  name: "propose_send_payment_reminder",
  description: "Propose sending a payment reminder for an overdue invoice. Creates a pending action that AJ must confirm.",
  safety_level: "destructive",
  parameters: {
    type: "object",
    properties: {
      invoice_id: { type: "string" },
    },
    required: ["invoice_id"],
  },
  handler: async (args, ctx) => {
    const { data: invoice } = await ctx.supabase
      .from("invoices")
      .select("invoice_number, total_cents, amount_paid_cents, customer_id")
      .eq("id", args.invoice_id)
      .single();

    if (!invoice) return { error: "Invoice not found" };

    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", invoice.customer_id)
      .single();

    const owed = fmt((invoice.total_cents ?? 0) - (invoice.amount_paid_cents ?? 0));

    const { data: action } = await ctx.supabase
      .from("assistant_pending_actions")
      .insert({
        conversation_id: ctx.conversationId,
        sitter_id: ctx.sitterId,
        action_type: "send_payment_reminder",
        action_summary: `Send payment reminder to ${profile?.full_name ?? "client"} for invoice ${invoice.invoice_number} (${owed} owing)`,
        action_payload: { invoice_id: args.invoice_id },
      })
      .select()
      .single();

    return {
      pending_action_id: action?.id,
      summary: `Will send a reminder to ${profile?.full_name ?? "client"} for ${owed}. Awaiting confirmation.`,
    };
  },
};

const proposeBlockDate: ToolDefinition = {
  name: "propose_block_date",
  description: "Propose blocking off a date so no bookings can be made. Creates a pending action.",
  safety_level: "destructive",
  parameters: {
    type: "object",
    properties: {
      date: { type: "string", description: "ISO date YYYY-MM-DD" },
      reason: { type: "string" },
    },
    required: ["date"],
  },
  handler: async (args, ctx) => {
    const { data: action } = await ctx.supabase
      .from("assistant_pending_actions")
      .insert({
        conversation_id: ctx.conversationId,
        sitter_id: ctx.sitterId,
        action_type: "block_date",
        action_summary: `Block off ${args.date}${args.reason ? ` (${args.reason})` : ""}`,
        action_payload: { date: args.date, reason: args.reason ?? null },
      })
      .select()
      .single();

    return {
      pending_action_id: action?.id,
      summary: `Will block ${args.date}. Awaiting confirmation.`,
    };
  },
};

const proposeApproveBooking: ToolDefinition = {
  name: "propose_approve_booking",
  description: "Propose approving a booking request. Creates a pending action.",
  safety_level: "destructive",
  parameters: {
    type: "object",
    properties: {
      booking_id: { type: "string" },
    },
    required: ["booking_id"],
  },
  handler: async (args, ctx) => {
    const { data: booking } = await ctx.supabase
      .from("bookings")
      .select("services(name), pets(name), customer_id, requested_date")
      .eq("id", args.booking_id)
      .single();

    if (!booking) return { error: "Booking not found" };

    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", (booking as any).customer_id)
      .single();

    const { data: action } = await ctx.supabase
      .from("assistant_pending_actions")
      .insert({
        conversation_id: ctx.conversationId,
        sitter_id: ctx.sitterId,
        action_type: "approve_booking",
        action_summary: `Approve ${(booking as any).services?.name ?? "booking"} for ${(booking as any).pets?.name ?? "pet"} (${profile?.full_name ?? "client"})`,
        action_payload: { booking_id: args.booking_id },
      })
      .select()
      .single();

    return {
      pending_action_id: action?.id,
      summary: `Will approve the booking. Awaiting confirmation.`,
    };
  },
};

const proposeMarkInvoicePaid: ToolDefinition = {
  name: "propose_mark_invoice_paid",
  description: "Propose marking an invoice as paid manually (for e-transfers, cash, etc). Creates a pending action.",
  safety_level: "destructive",
  parameters: {
    type: "object",
    properties: {
      invoice_id: { type: "string" },
      payment_method: { type: "string", enum: ["etransfer", "cash", "check", "other"] },
      note: { type: "string" },
    },
    required: ["invoice_id"],
  },
  handler: async (args, ctx) => {
    const { data: invoice } = await ctx.supabase
      .from("invoices")
      .select("invoice_number, total_cents, customer_id")
      .eq("id", args.invoice_id)
      .single();

    if (!invoice) return { error: "Invoice not found" };

    const { data: action } = await ctx.supabase
      .from("assistant_pending_actions")
      .insert({
        conversation_id: ctx.conversationId,
        sitter_id: ctx.sitterId,
        action_type: "mark_invoice_paid",
        action_summary: `Mark invoice ${invoice.invoice_number} (${fmt(invoice.total_cents)}) as paid via ${args.payment_method ?? "manual"}`,
        action_payload: {
          invoice_id: args.invoice_id,
          payment_method: args.payment_method ?? "other",
          note: args.note ?? null,
        },
      })
      .select()
      .single();

    return {
      pending_action_id: action?.id,
      summary: `Will mark invoice ${invoice.invoice_number} as paid. Awaiting confirmation.`,
    };
  },
};

const proposeSendClientMessage: ToolDefinition = {
  name: "propose_send_client_message",
  description: "Propose sending a previously drafted message to a client (via SMS + email).",
  safety_level: "destructive",
  parameters: {
    type: "object",
    properties: {
      client_id: { type: "string" },
      subject: { type: "string" },
      body: { type: "string" },
    },
    required: ["client_id", "body"],
  },
  handler: async (args, ctx) => {
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", args.client_id)
      .single();

    const { data: action } = await ctx.supabase
      .from("assistant_pending_actions")
      .insert({
        conversation_id: ctx.conversationId,
        sitter_id: ctx.sitterId,
        action_type: "send_client_message",
        action_summary: `Send message to ${profile?.full_name ?? "client"}: "${args.body.slice(0, 80)}..."`,
        action_payload: { client_id: args.client_id, subject: args.subject, body: args.body },
      })
      .select()
      .single();

    return {
      pending_action_id: action?.id,
      summary: `Will send to ${profile?.full_name ?? "client"}. Awaiting confirmation.`,
    };
  },
};

// ============================================================================
// EXPORT REGISTRY
// ============================================================================
export const TOOLS: ToolDefinition[] = [
  // read
  queryInvoices,
  queryBookings,
  queryClients,
  queryPets,
  queryRevenue,
  queryAvailability,
  queryServices,
  queryInbox,
  // draft
  draftClientMessage,
  // destructive (propose, then AJ confirms)
  proposeSendReminder,
  proposeBlockDate,
  proposeApproveBooking,
  proposeMarkInvoicePaid,
  proposeSendClientMessage,
];

export function getToolDefinitions(): any[] {
  return TOOLS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export async function executeTool(
  name: string,
  args: any,
  ctx: ToolContext,
): Promise<{ ok: boolean; result?: any; error?: string }> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
  try {
    const result = await tool.handler(args, ctx);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
