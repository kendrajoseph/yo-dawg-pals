// Anneke's site assistant — chat with tool calling.
// Read tools execute automatically. Mutating tools pause and return a
// pending-approval payload that the client confirms before re-invocation.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

type PendingApproval = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  preview: Record<string, unknown>;
};

type Ctx = {
  admin: SupabaseClient;
  client: SupabaseClient;
  userId: string;
  appOrigin: string;
  serviceRoleKey: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fmtMoney = (cents?: number | null) =>
  cents == null ? "—" : `$${(cents / 100).toFixed(2)} CAD`;

// ============================================================
// Tool definitions (OpenAI / Lovable AI Gateway tool schema)
// ============================================================

const READ_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_bookings",
      description: "Search bookings by client name, pet name, status, service slug, or date range. Returns at most 25 compact rows.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free text matched against client name and pet name." },
          status: { type: "string", description: "Comma-separated statuses, e.g. 'requested,confirmed,awaiting_payment'." },
          serviceSlug: { type: "string" },
          fromDate: { type: "string", description: "ISO date YYYY-MM-DD inclusive." },
          toDate: { type: "string", description: "ISO date YYYY-MM-DD inclusive." },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_booking",
      description: "Full detail for a booking by id: client, pet, service, status, schedule, totals, line items, and recent payments.",
      parameters: { type: "object", properties: { bookingId: { type: "string" } }, required: ["bookingId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_today_schedule",
      description: "Confirmed/awaiting_payment bookings scheduled for today and tomorrow.",
      parameters: {
        type: "object",
        properties: { includeTomorrow: { type: "boolean" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pending_requests",
      description: "All bookings with status='requested', grouped by request group.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "search_clients",
      description: "Search profiles by full name, email, or phone. Returns id and summary.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_client",
      description: "Profile, pets, recent bookings, and outstanding balance for a client by id.",
      parameters: { type: "object", properties: { clientId: { type: "string" } }, required: ["clientId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_invoices",
      description: "Search invoices by status, client name, or date range.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          query: { type: "string" },
          fromDate: { type: "string" },
          toDate: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_invoice",
      description: "Full invoice detail by id: line items, totals, public link.",
      parameters: { type: "object", properties: { invoiceId: { type: "string" } }, required: ["invoiceId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_services",
      description: "Active services and their variants with pricing.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_availability",
      description: "Weekday availability blocks, walk windows, and blocked dates.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const WRITE_TOOLS = [
  {
    type: "function",
    function: {
      name: "approve_booking",
      description: "Approve a single requested booking using its requested time. Sets status to confirmed (free) or awaiting_payment.",
      parameters: { type: "object", properties: { bookingId: { type: "string" } }, required: ["bookingId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "decline_booking",
      description: "Decline a pending booking request (sets status to cancelled).",
      parameters: {
        type: "object",
        properties: { bookingId: { type: "string" }, reason: { type: "string" } },
        required: ["bookingId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_booking",
      description: "Cancel an existing confirmed/awaiting_payment booking via the cancel-booking flow.",
      parameters: {
        type: "object",
        properties: { bookingId: { type: "string" }, reason: { type: "string" } },
        required: ["bookingId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_booking",
      description: "Move a booking to a new start/end time. ISO timestamps.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          startAt: { type: "string", description: "New scheduled start ISO timestamp." },
          endAt: { type: "string", description: "New scheduled end ISO timestamp." },
        },
        required: ["bookingId", "startAt", "endAt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_booking_extra",
      description: "Add an extra-time fee or custom line item charge to a booking.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          kind: { type: "string", enum: ["extra_time", "late_fee", "custom"] },
          label: { type: "string" },
          amountCents: { type: "number", description: "Total cents to add." },
          minutes: { type: "number", description: "Optional: minutes for extra_time." },
        },
        required: ["bookingId", "kind", "label", "amountCents"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_payment_reminder",
      description: "Email a payment reminder for an outstanding invoice.",
      parameters: { type: "object", properties: { invoiceId: { type: "string" } }, required: ["invoiceId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "send_invoice_email",
      description: "Email an invoice to the client.",
      parameters: { type: "object", properties: { invoiceId: { type: "string" } }, required: ["invoiceId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "send_client_message",
      description: "Send a direct message (email) to a client.",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["clientId", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_booking_update",
      description: "Send a quick pickup/drop-off/care-note update to the client of a booking.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          kind: { type: "string", enum: ["pickup", "dropoff", "care_note"] },
          note: { type: "string" },
        },
        required: ["bookingId", "kind", "note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "block_date",
      description: "Mark a date as unavailable on Anneke's calendar.",
      parameters: {
        type: "object",
        properties: { date: { type: "string" }, reason: { type: "string" } },
        required: ["date"],
      },
    },
  },
];

const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];
const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.function.name));

// ============================================================
// Tool implementations
// ============================================================

async function executeReadTool(name: string, args: any, ctx: Ctx): Promise<unknown> {
  const { admin, userId } = ctx;

  switch (name) {
    case "search_bookings": {
      const limit = Math.min(args.limit ?? 25, 50);
      let q = admin.from("bookings").select(
        "id, status, payment_status, booking_kind, customer_id, pet_id, service_id, start_at, end_at, scheduled_start_at, scheduled_end_at, requested_date, requested_window_label, total_cents, services(name, slug), pets(name)"
      ).eq("sitter_id", userId).order("created_at", { ascending: false }).limit(limit);
      if (args.status) {
        const statuses = String(args.status).split(",").map((s) => s.trim()).filter(Boolean);
        q = q.in("status", statuses);
      }
      if (args.serviceSlug) {
        const { data: svc } = await admin.from("services").select("id").eq("slug", args.serviceSlug).maybeSingle();
        if (svc?.id) q = q.eq("service_id", svc.id);
      }
      if (args.fromDate) q = q.gte("start_at", `${args.fromDate}T00:00:00`);
      if (args.toDate) q = q.lte("start_at", `${args.toDate}T23:59:59`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as any[];
      let filtered = rows;
      if (args.query) {
        const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
        const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", customerIds);
        const nameById = new Map((profs ?? []).map((p: any) => [p.id, (p.full_name ?? "").toLowerCase()]));
        const needle = String(args.query).toLowerCase();
        filtered = rows.filter((r) =>
          (nameById.get(r.customer_id) ?? "").includes(needle) ||
          (r.pets?.name ?? "").toLowerCase().includes(needle)
        );
      }
      const customerIds = Array.from(new Set(filtered.map((r) => r.customer_id)));
      const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", customerIds);
      const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? "Client"]));
      return {
        count: filtered.length,
        bookings: filtered.map((b) => ({
          id: b.id,
          status: b.status,
          payment_status: b.payment_status,
          client: nameById.get(b.customer_id) ?? "Client",
          pet: b.pets?.name ?? null,
          service: b.services?.name ?? null,
          when: b.scheduled_start_at ?? b.start_at ?? b.requested_date,
          total: fmtMoney(b.total_cents),
        })),
      };
    }

    case "get_booking": {
      const { data, error } = await admin.from("bookings")
        .select("*, services(name, slug, payment_mode, duration_minutes), pets(name, breed), service_variants(name, price_cents, payment_mode)")
        .eq("id", args.bookingId).eq("sitter_id", userId).maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "Booking not found." };
      const [{ data: prof }, { data: authUser }, { data: invoices }] = await Promise.all([
        admin.from("profiles").select("full_name, phone").eq("id", (data as any).customer_id).maybeSingle(),
        admin.auth.admin.getUserById((data as any).customer_id),
        admin.from("invoices").select("id, invoice_number, status, total_cents, amount_paid_cents, due_date, public_token").eq("booking_id", args.bookingId),
      ]);
      return {
        id: data.id,
        status: data.status,
        payment_status: data.payment_status,
        client: { id: data.customer_id, name: prof?.full_name ?? "Client", email: authUser?.user?.email, phone: prof?.phone },
        pet: (data as any).pets,
        service: (data as any).services,
        variant: (data as any).service_variants,
        scheduled_start_at: (data as any).scheduled_start_at,
        scheduled_end_at: (data as any).scheduled_end_at,
        requested_date: (data as any).requested_date,
        requested_window: (data as any).requested_window_label,
        notes: (data as any).notes,
        internal_notes: (data as any).internal_notes,
        totals: {
          base: fmtMoney((data as any).base_price_cents),
          extra_time: fmtMoney((data as any).extra_time_fee_cents),
          late_pickup: fmtMoney((data as any).late_pickup_fee_cents),
          total: fmtMoney((data as any).total_cents),
          paid: fmtMoney((data as any).payment_amount_cents),
        },
        invoices: (invoices ?? []).map((i) => ({
          id: i.id, number: i.invoice_number, status: i.status,
          total: fmtMoney(i.total_cents), paid: fmtMoney(i.amount_paid_cents),
          due_date: i.due_date,
        })),
      };
    }

    case "list_today_schedule": {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const horizonDays = args.includeTomorrow === false ? 1 : 2;
      const end = new Date(today); end.setDate(end.getDate() + horizonDays);
      const { data, error } = await admin.from("bookings")
        .select("id, status, customer_id, scheduled_start_at, scheduled_end_at, start_at, end_at, services(name), pets(name)")
        .eq("sitter_id", userId)
        .in("status", ["confirmed", "awaiting_payment", "in_progress"])
        .gte("start_at", today.toISOString())
        .lt("start_at", end.toISOString())
        .order("start_at");
      if (error) return { error: error.message };
      const rows = (data ?? []) as any[];
      const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
      const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", customerIds);
      const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? "Client"]));
      return {
        count: rows.length,
        items: rows.map((r) => ({
          id: r.id, status: r.status,
          client: nameById.get(r.customer_id) ?? "Client",
          pet: r.pets?.name, service: r.services?.name,
          start: r.scheduled_start_at ?? r.start_at,
          end: r.scheduled_end_at ?? r.end_at,
        })),
      };
    }

    case "list_pending_requests": {
      const { data, error } = await admin.from("bookings")
        .select("id, customer_id, request_group_id, request_group_label, recurrence_label, requested_date, requested_window_label, services(name, slug), pets(name)")
        .eq("sitter_id", userId).eq("status", "requested").order("created_at", { ascending: false });
      if (error) return { error: error.message };
      const rows = (data ?? []) as any[];
      const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
      const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", customerIds);
      const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? "Client"]));
      const groups = new Map<string, any>();
      for (const r of rows) {
        const key = r.request_group_id ?? r.id;
        const g = groups.get(key) ?? {
          group_id: key,
          label: r.request_group_label ?? r.recurrence_label ?? "Single visit",
          bookings: [],
        };
        g.bookings.push({
          id: r.id,
          client: nameById.get(r.customer_id) ?? "Client",
          pet: r.pets?.name,
          service: r.services?.name,
          requested_date: r.requested_date,
          window: r.requested_window_label,
        });
        groups.set(key, g);
      }
      return { count: rows.length, groups: [...groups.values()] };
    }

    case "search_clients": {
      const limit = Math.min(args.limit ?? 15, 50);
      const needle = `%${String(args.query).toLowerCase()}%`;
      const { data: profs, error } = await admin.from("profiles")
        .select("id, full_name, phone").or(`full_name.ilike.${needle},phone.ilike.${needle}`).limit(limit);
      if (error) return { error: error.message };
      const ids = (profs ?? []).map((p) => p.id);
      const emails = new Map<string, string>();
      for (const id of ids) {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data?.user?.email) emails.set(id, data.user.email);
      }
      return {
        count: profs?.length ?? 0,
        clients: (profs ?? []).map((p) => ({
          id: p.id, name: p.full_name, phone: p.phone, email: emails.get(p.id) ?? null,
        })),
      };
    }

    case "get_client": {
      const [{ data: prof }, { data: authUser }, { data: pets }, { data: bookings }, { data: invoices }] = await Promise.all([
        admin.from("profiles").select("*").eq("id", args.clientId).maybeSingle(),
        admin.auth.admin.getUserById(args.clientId),
        admin.from("pets").select("id, name, breed, photo_url").eq("owner_id", args.clientId),
        admin.from("bookings").select("id, status, start_at, total_cents, services(name)").eq("customer_id", args.clientId).eq("sitter_id", userId).order("start_at", { ascending: false }).limit(10),
        admin.from("invoices").select("id, invoice_number, status, total_cents, amount_paid_cents, due_date").eq("customer_id", args.clientId).neq("status", "void"),
      ]);
      const outstanding = (invoices ?? []).filter((i) => ["sent", "partial", "draft", "overdue"].includes(i.status))
        .reduce((acc, i) => acc + ((i.total_cents ?? 0) - (i.amount_paid_cents ?? 0)), 0);
      return {
        id: args.clientId,
        name: prof?.full_name, email: authUser?.user?.email, phone: prof?.phone,
        sms_opt_in: (prof as any)?.sms_opt_in ?? false,
        pets: pets ?? [],
        recent_bookings: (bookings ?? []).map((b: any) => ({
          id: b.id, status: b.status, when: b.start_at,
          service: b.services?.name, total: fmtMoney(b.total_cents),
        })),
        outstanding_balance: fmtMoney(outstanding),
        invoices: (invoices ?? []).map((i) => ({
          id: i.id, number: i.invoice_number, status: i.status,
          total: fmtMoney(i.total_cents), paid: fmtMoney(i.amount_paid_cents),
        })),
      };
    }

    case "search_invoices": {
      const limit = Math.min(args.limit ?? 25, 50);
      let q = admin.from("invoices").select("id, invoice_number, status, customer_id, total_cents, amount_paid_cents, due_date, sent_at, created_at, public_token")
        .eq("sitter_id", userId).order("created_at", { ascending: false }).limit(limit);
      if (args.status) q = q.eq("status", args.status);
      if (args.fromDate) q = q.gte("created_at", `${args.fromDate}T00:00:00`);
      if (args.toDate) q = q.lte("created_at", `${args.toDate}T23:59:59`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as any[];
      const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
      const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", customerIds);
      const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? "Client"]));
      let filtered = rows;
      if (args.query) {
        const needle = String(args.query).toLowerCase();
        filtered = rows.filter((r) => (nameById.get(r.customer_id) ?? "").toLowerCase().includes(needle));
      }
      return {
        count: filtered.length,
        invoices: filtered.map((i) => ({
          id: i.id, number: i.invoice_number, status: i.status,
          client: nameById.get(i.customer_id) ?? "Client",
          total: fmtMoney(i.total_cents), paid: fmtMoney(i.amount_paid_cents),
          due_date: i.due_date, sent_at: i.sent_at,
        })),
      };
    }

    case "get_invoice": {
      const { data, error } = await admin.from("invoices").select("*").eq("id", args.invoiceId).eq("sitter_id", userId).maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "Invoice not found." };
      const { data: items } = await admin.from("invoice_line_items").select("*").eq("invoice_id", args.invoiceId).order("sort_order");
      return {
        id: data.id, number: (data as any).invoice_number, status: data.status,
        total: fmtMoney((data as any).total_cents), paid: fmtMoney((data as any).amount_paid_cents),
        due_date: (data as any).due_date,
        notes: (data as any).notes,
        public_token: (data as any).public_token,
        line_items: (items ?? []).map((li: any) => ({
          label: li.label, qty: li.quantity, unit: fmtMoney(li.unit_price_cents), total: fmtMoney(li.total_cents), kind: li.kind,
        })),
      };
    }

    case "list_services": {
      const { data: services } = await admin.from("services").select("id, name, slug, payment_mode, duration_minutes, scheduling_mode").eq("is_active", true).order("name");
      const { data: variants } = await admin.from("service_variants").select("id, service_id, name, price_cents, duration_minutes, is_active").eq("is_active", true);
      const variantsBySvc = new Map<string, any[]>();
      for (const v of variants ?? []) {
        const arr = variantsBySvc.get(v.service_id) ?? [];
        arr.push({ name: v.name, price: fmtMoney(v.price_cents), duration_minutes: v.duration_minutes });
        variantsBySvc.set(v.service_id, arr);
      }
      return {
        services: (services ?? []).map((s) => ({
          name: s.name, slug: s.slug, mode: s.payment_mode, scheduling: s.scheduling_mode,
          duration_minutes: s.duration_minutes,
          variants: variantsBySvc.get(s.id) ?? [],
        })),
      };
    }

    case "list_availability": {
      const [{ data: avail }, { data: walks }, { data: blocked }] = await Promise.all([
        admin.from("availability").select("id, weekday, start_minute, end_minute, max_bookings, availability_services(services(slug, name))").eq("sitter_id", userId),
        admin.from("walk_windows").select("id, weekday, start_minute, end_minute, window_label, max_bookings, services(slug, name)").eq("sitter_id", userId),
        admin.from("blocked_dates").select("id, blocked_date, reason").eq("sitter_id", userId).order("blocked_date"),
      ]);
      const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      return {
        availability: (avail ?? []).map((a: any) => ({
          weekday: wd[a.weekday], start: fmtMin(a.start_minute), end: fmtMin(a.end_minute),
          max_bookings: a.max_bookings,
          services: (a.availability_services ?? []).map((x: any) => x.services?.name).filter(Boolean),
        })),
        walk_windows: (walks ?? []).map((w: any) => ({
          weekday: wd[w.weekday], label: w.window_label,
          start: fmtMin(w.start_minute), end: fmtMin(w.end_minute),
          max_bookings: w.max_bookings, service: w.services?.name,
        })),
        blocked_dates: (blocked ?? []).map((b) => ({ date: b.blocked_date, reason: b.reason })),
      };
    }
  }
  return { error: `Unknown read tool: ${name}` };
}

// Build a human-readable preview for a write tool BEFORE executing it.
async function previewWriteTool(name: string, args: any, ctx: Ctx): Promise<{ summary: string; preview: Record<string, unknown> }> {
  const { admin, userId } = ctx;
  switch (name) {
    case "approve_booking":
    case "decline_booking":
    case "cancel_booking":
    case "reschedule_booking":
    case "add_booking_extra":
    case "send_booking_update": {
      const { data } = await admin.from("bookings")
        .select("id, customer_id, services(name), pets(name), start_at, scheduled_start_at, requested_date, requested_window_label")
        .eq("id", args.bookingId).eq("sitter_id", userId).maybeSingle();
      const { data: prof } = data
        ? await admin.from("profiles").select("full_name").eq("id", (data as any).customer_id).maybeSingle()
        : { data: null as any };
      const ctxLine = data
        ? `${(data as any).pets?.name ?? "pet"} · ${(data as any).services?.name ?? "service"} · ${prof?.full_name ?? "client"}`
        : args.bookingId;
      let summary = "";
      if (name === "approve_booking") summary = `Approve booking — ${ctxLine}`;
      if (name === "decline_booking") summary = `Decline booking — ${ctxLine}${args.reason ? ` (${args.reason})` : ""}`;
      if (name === "cancel_booking") summary = `Cancel booking — ${ctxLine}${args.reason ? ` (${args.reason})` : ""}`;
      if (name === "reschedule_booking") summary = `Reschedule ${ctxLine} → ${args.startAt}`;
      if (name === "add_booking_extra") summary = `Add ${args.kind.replace("_", " ")} "${args.label}" (${fmtMoney(args.amountCents)}) to ${ctxLine}`;
      if (name === "send_booking_update") summary = `Text/email ${args.kind.replace("_", " ")} update to ${ctxLine}`;
      return { summary, preview: { booking: ctxLine, ...args } };
    }
    case "send_payment_reminder":
    case "send_invoice_email": {
      const { data } = await admin.from("invoices").select("invoice_number, customer_id, total_cents, amount_paid_cents")
        .eq("id", args.invoiceId).eq("sitter_id", userId).maybeSingle();
      const { data: prof } = data
        ? await admin.from("profiles").select("full_name").eq("id", (data as any).customer_id).maybeSingle()
        : { data: null as any };
      const num = (data as any)?.invoice_number ?? args.invoiceId;
      const verb = name === "send_payment_reminder" ? "payment reminder for" : "invoice";
      const summary = `Email ${verb} ${num} to ${prof?.full_name ?? "client"} (${fmtMoney((data as any)?.total_cents)})`;
      return { summary, preview: { invoice: num, ...args } };
    }
    case "send_client_message": {
      const { data: prof } = await admin.from("profiles").select("full_name").eq("id", args.clientId).maybeSingle();
      return {
        summary: `Email "${args.subject}" to ${prof?.full_name ?? "client"}`,
        preview: { client: prof?.full_name, subject: args.subject, body_preview: String(args.body).slice(0, 240) },
      };
    }
    case "block_date":
      return {
        summary: `Block ${args.date}${args.reason ? ` — ${args.reason}` : ""}`,
        preview: { date: args.date, reason: args.reason ?? null },
      };
  }
  return { summary: `Run ${name}`, preview: args };
}

async function executeWriteTool(name: string, args: any, ctx: Ctx): Promise<unknown> {
  const { admin, userId, serviceRoleKey, appOrigin } = ctx;
  try {
    switch (name) {
      case "approve_booking": {
        const { data: b, error } = await admin.from("bookings")
          .select("*, services(name, payment_mode, requires_pet_approval), service_variants(price_cents, payment_mode), pets(name)")
          .eq("id", args.bookingId).eq("sitter_id", userId).maybeSingle();
        if (error || !b) return { ok: false, error: error?.message ?? "Not found" };
        if (!(b as any).requested_date || (b as any).requested_window_start_minute == null) {
          return { ok: false, error: "Booking has no requested time — set scheduled_start/end first." };
        }
        const start = new Date(`${(b as any).requested_date}T00:00:00`);
        start.setMinutes((b as any).requested_window_start_minute);
        const endDate = (b as any).requested_end_date ?? (b as any).requested_date;
        const end = new Date(`${endDate}T00:00:00`);
        end.setMinutes((b as any).requested_window_end_minute);
        const paymentMode = (b as any).service_variants?.payment_mode ?? (b as any).services?.payment_mode ?? "deposit";
        const status = paymentMode === "free" ? "confirmed" : "awaiting_payment";
        const price = (b as any).service_variants?.price_cents ?? 0;
        const { error: upErr } = await admin.from("bookings").update({
          scheduled_start_at: start.toISOString(),
          scheduled_end_at: end.toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: userId,
          base_price_cents: price,
          payment_amount_cents: paymentMode === "free" ? 0 : price,
          total_cents: price,
          status,
        }).eq("id", args.bookingId);
        if (upErr) return { ok: false, error: upErr.message };
        return { ok: true, message: `Approved. Status → ${status}.` };
      }
      case "decline_booking": {
        const { error } = await admin.from("bookings").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          internal_notes: args.reason ? `Declined: ${args.reason}` : null,
        }).eq("id", args.bookingId).eq("sitter_id", userId);
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: "Booking declined." };
      }
      case "cancel_booking": {
        const res = await admin.functions.invoke("cancel-booking", {
          headers: { Authorization: `Bearer ${serviceRoleKey}` },
          body: { bookingId: args.bookingId, reason: args.reason ?? null, initiator: "sitter" },
        });
        if (res.error) return { ok: false, error: res.error.message };
        return { ok: true, message: "Cancellation processed.", data: res.data };
      }
      case "reschedule_booking": {
        const { error } = await admin.from("bookings").update({
          scheduled_start_at: args.startAt,
          scheduled_end_at: args.endAt,
          start_at: args.startAt,
          end_at: args.endAt,
        }).eq("id", args.bookingId).eq("sitter_id", userId);
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: "Booking rescheduled." };
      }
      case "add_booking_extra": {
        // Find or create an invoice for this booking
        const { data: b } = await admin.from("bookings").select("customer_id, total_cents, extra_time_fee_cents, late_pickup_fee_cents")
          .eq("id", args.bookingId).eq("sitter_id", userId).maybeSingle();
        if (!b) return { ok: false, error: "Booking not found." };
        // Update booking aggregate fields
        const patch: any = { total_cents: ((b as any).total_cents ?? 0) + args.amountCents };
        if (args.kind === "extra_time") {
          patch.extra_time_fee_cents = ((b as any).extra_time_fee_cents ?? 0) + args.amountCents;
          if (args.minutes) patch.extra_time_minutes = args.minutes;
        } else if (args.kind === "late_fee") {
          patch.late_pickup_fee_cents = ((b as any).late_pickup_fee_cents ?? 0) + args.amountCents;
        }
        const { error: upErr } = await admin.from("bookings").update(patch).eq("id", args.bookingId);
        if (upErr) return { ok: false, error: upErr.message };
        // Try to add to existing invoice if one exists
        const { data: inv } = await admin.from("invoices").select("id, total_cents, subtotal_cents")
          .eq("booking_id", args.bookingId).neq("status", "void").maybeSingle();
        if (inv) {
          const { data: maxOrder } = await admin.from("invoice_line_items")
            .select("sort_order").eq("invoice_id", (inv as any).id).order("sort_order", { ascending: false }).limit(1);
          const nextOrder = ((maxOrder?.[0] as any)?.sort_order ?? -1) + 1;
          await admin.from("invoice_line_items").insert({
            invoice_id: (inv as any).id,
            label: args.label,
            quantity: 1,
            unit_price_cents: args.amountCents,
            total_cents: args.amountCents,
            kind: args.kind,
            sort_order: nextOrder,
          });
          await admin.from("invoices").update({
            subtotal_cents: ((inv as any).subtotal_cents ?? 0) + args.amountCents,
            total_cents: ((inv as any).total_cents ?? 0) + args.amountCents,
          }).eq("id", (inv as any).id);
        }
        return { ok: true, message: `Added ${args.label} (${fmtMoney(args.amountCents)}).` };
      }
      case "send_payment_reminder": {
        const res = await admin.functions.invoke("send-payment-reminder", {
          headers: { Authorization: `Bearer ${serviceRoleKey}` },
          body: { invoiceId: args.invoiceId },
        });
        if (res.error) return { ok: false, error: res.error.message };
        return { ok: true, message: "Reminder queued." };
      }
      case "send_invoice_email": {
        const res = await admin.functions.invoke("send-invoice-email", {
          headers: { Authorization: `Bearer ${serviceRoleKey}` },
          body: { invoiceId: args.invoiceId },
        });
        if (res.error) return { ok: false, error: res.error.message };
        return { ok: true, message: "Invoice emailed." };
      }
      case "send_client_message": {
        const res = await admin.functions.invoke("send-client-message", {
          headers: { Authorization: `Bearer ${serviceRoleKey}` },
          body: { clientId: args.clientId, subject: args.subject, body: args.body },
        });
        if (res.error) return { ok: false, error: res.error.message };
        return { ok: true, message: "Message sent." };
      }
      case "send_booking_update": {
        const res = await admin.functions.invoke("send-booking-update", {
          headers: { Authorization: `Bearer ${serviceRoleKey}` },
          body: { bookingId: args.bookingId, kind: args.kind, note: args.note },
        });
        if (res.error) return { ok: false, error: res.error.message };
        return { ok: true, message: "Update sent.", data: res.data };
      }
      case "block_date": {
        const { error } = await admin.from("blocked_dates").insert({
          sitter_id: userId, blocked_date: args.date, reason: args.reason ?? null,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Blocked ${args.date}.` };
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
  return { ok: false, error: `Unknown write tool: ${name}` };
}

// ============================================================
// System prompt
// ============================================================

const SYSTEM_PROMPT = `You are Anneke's operations assistant for the Yo Dawg Sitters dashboard. Anneke runs a small dog walking and pet care business in Toronto.

You help her with anything on the site: looking up bookings/clients/invoices/services, approving or declining requests, rescheduling, adding extras and late fees, sending invoices and reminders, messaging clients, sending pickup/dropoff updates, and managing her schedule.

Style:
- Be concise, warm, direct. Use plain markdown. No emoji unless she asks.
- Always search/look up first before suggesting an action. Never invent ids.
- When she asks about "today", "this week", "the Smiths", look it up — don't ask her for ids.
- After running a read tool, summarize the key facts naturally; don't dump raw JSON at her.

Mutating actions (anything that approves/declines/cancels, sends an email or text, charges money, or changes the schedule) require her explicit approval. The system handles the approval card automatically: just call the tool with the correct arguments and the user will be shown a confirm prompt before it runs. Don't repeatedly ask "should I…?" — call the tool, the UI will gate it.

Today's date is ${new Date().toISOString().slice(0, 10)}.`;

// ============================================================
// Main loop
// ============================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const incomingMessages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const approval: { toolCallId: string; toolName: string; args: any; approved: boolean } | null = body.approval ?? null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Server not configured" }, 500);
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } } });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await client.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { data: roles } = await client.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("sitter")) return json({ error: "Forbidden" }, 403);

    const ctx: Ctx = {
      admin, client, userId, serviceRoleKey,
      appOrigin: req.headers.get("origin") ?? "",
    };

    // Build initial conversation. Strip any leftover system messages from client.
    const convo: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...incomingMessages.filter((m) => m.role !== "system"),
    ];

    // If the request includes an approval result, replay the approved tool now
    // (the assistant message with that tool_call must already be in convo).
    if (approval) {
      let result: unknown;
      if (approval.approved) {
        result = await executeWriteTool(approval.toolName, approval.args, ctx);
      } else {
        result = { ok: false, declined: true, message: "Anneke chose not to run this action." };
      }
      convo.push({
        role: "tool",
        tool_call_id: approval.toolCallId,
        name: approval.toolName,
        content: JSON.stringify(result),
      });
    }

    // Tool loop. Cap iterations to avoid runaways.
    for (let step = 0; step < 12; step++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools: ALL_TOOLS,
        }),
      });

      if (aiRes.status === 429) return json({ error: "AI rate limit reached. Try again in a moment." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }, 402);
      if (!aiRes.ok) return json({ error: `AI error (${aiRes.status})` }, 500);

      const ai = await aiRes.json();
      const choice = ai.choices?.[0]?.message;
      if (!choice) return json({ error: "AI returned empty response" }, 500);

      // Push assistant message verbatim (may carry tool_calls)
      convo.push({
        role: "assistant",
        content: choice.content ?? null,
        tool_calls: choice.tool_calls,
      });

      const toolCalls = choice.tool_calls as ChatMessage["tool_calls"];
      if (!toolCalls || toolCalls.length === 0) {
        // Done — assistant produced a final answer
        return json({ ok: true, messages: convo.slice(1), pendingApproval: null });
      }

      // Execute reads inline; first write halts and returns for approval
      let pending: PendingApproval | null = null;
      for (const tc of toolCalls) {
        const fnName = tc.function.name;
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.function.arguments || "{}"); } catch { parsedArgs = {}; }

        if (WRITE_TOOL_NAMES.has(fnName)) {
          const { summary, preview } = await previewWriteTool(fnName, parsedArgs, ctx);
          pending = { toolCallId: tc.id, toolName: fnName, args: parsedArgs, summary, preview };
          break; // stop; client must approve before continuing
        } else {
          const result = await executeReadTool(fnName, parsedArgs, ctx);
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            name: fnName,
            content: JSON.stringify(result).slice(0, 14000),
          });
        }
      }

      if (pending) {
        return json({ ok: true, messages: convo.slice(1), pendingApproval: pending });
      }
      // continue loop with tool results in convo
    }

    return json({ ok: true, messages: convo.slice(1), pendingApproval: null, warning: "Reached step limit." });
  } catch (e) {
    console.error("assistant-chat error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
