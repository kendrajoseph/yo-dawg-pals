// Create an invoice (with line items) for a single booking OR for an entire
// booking request group. Optionally applies sitter tax + sibling discounts
// and emails the result.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const lineItemSchema = z.object({
  label: z.string().min(1).max(200),
  quantity: z.number().min(0).max(999).default(1),
  unit_price_cents: z.number().int(),
  kind: z.enum(["service", "extra_time", "late_fee", "discount", "custom", "tip", "tax"]).default("custom"),
});

const bodySchema = z.object({
  bookingId: z.string().uuid().optional(),
  requestGroupId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  lineItems: z.array(lineItemSchema).optional(),
  sendEmail: z.boolean().default(false),
  applyTax: z.boolean().default(false),
  applySiblingDiscount: z.boolean().default(false),
}).refine((b) => b.bookingId || b.requestGroupId, { message: "bookingId or requestGroupId required" });

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { bookingId, requestGroupId, dueDate, notes, lineItems, sendEmail, applyTax, applySiblingDiscount } = parsed.data;

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    let sitterId: string;
    let customerId: string;
    let invoiceBookingId: string | null = null;
    let computedDue: string | null = dueDate ?? null;
    let itemsWithTotals: Array<{ label: string; quantity: number; unit_price_cents: number; total_cents: number; kind: string; sort_order: number }> = [];

    if (requestGroupId) {
      // ── Group path: build line items from every booking in the group ──
      const { data: group } = await admin
        .from("booking_request_groups")
        .select("id, sitter_id, customer_id, notes")
        .eq("id", requestGroupId)
        .maybeSingle();
      if (!group) return json({ error: "Request group not found" }, 404);
      if ((group as any).sitter_id !== user.id) return json({ error: "Forbidden" }, 403);

      sitterId = (group as any).sitter_id;
      customerId = (group as any).customer_id;

      const { data: bks } = await admin
        .from("bookings")
        .select("id, base_price_cents, total_cents, bundle_position, start_at, services(name), service_variants(sibling_discount_percent), pets(name)")
        .eq("request_group_id", requestGroupId)
        .order("bundle_position", { ascending: true });

      if (!bks || bks.length === 0) return json({ error: "No bookings in group" }, 404);

      let sort = 0;
      for (const b of bks as any[]) {
        const svcName = b.services?.name ?? "Service";
        const petName = b.pets?.name ?? "";
        const price = b.base_price_cents ?? b.total_cents ?? 0;
        itemsWithTotals.push({
          label: petName ? `${svcName} — ${petName}` : svcName,
          quantity: 1,
          unit_price_cents: price,
          total_cents: price,
          kind: "service",
          sort_order: sort++,
        });

        if (applySiblingDiscount && (b.bundle_position ?? 0) > 0) {
          const pct = b.service_variants?.sibling_discount_percent ?? 0;
          if (pct > 0) {
            const discount = -Math.round((price * pct) / 100);
            itemsWithTotals.push({
              label: `Sibling discount (${pct}%) — ${petName || svcName}`,
              quantity: 1,
              unit_price_cents: discount,
              total_cents: discount,
              kind: "discount",
              sort_order: sort++,
            });
          }
        }
      }

      // Default due date: earliest booking start - 1 day, or sitter default
      if (!computedDue) {
        const earliest = (bks as any[])
          .map((b) => b.start_at)
          .filter(Boolean)
          .sort()[0];
        if (earliest) {
          const d = new Date(earliest);
          d.setDate(d.getDate() - 1);
          computedDue = d.toISOString().slice(0, 10);
        }
      }
    } else if (bookingId) {
      // ── Original single-booking path (requires explicit lineItems) ──
      if (!lineItems || lineItems.length === 0) return json({ error: "lineItems required for single booking" }, 400);

      const { data: booking } = await admin
        .from("bookings")
        .select("id, customer_id, sitter_id, start_at")
        .eq("id", bookingId)
        .maybeSingle();
      if (!booking) return json({ error: "Booking not found" }, 404);
      if ((booking as any).sitter_id !== user.id) return json({ error: "Forbidden" }, 403);

      sitterId = (booking as any).sitter_id;
      customerId = (booking as any).customer_id;
      invoiceBookingId = bookingId;

      itemsWithTotals = lineItems.map((li, i) => ({
        ...li,
        total_cents: Math.round(li.unit_price_cents * li.quantity),
        sort_order: i,
      }));

      if (!computedDue && (booking as any).start_at) {
        const d = new Date((booking as any).start_at);
        d.setDate(d.getDate() - 1);
        computedDue = d.toISOString().slice(0, 10);
      }
    } else {
      return json({ error: "bookingId or requestGroupId required" }, 400);
    }

    // ── Tax (sitter_settings) ──
    let taxCents = 0;
    let taxRate: number | null = null;
    let taxLabel: string | null = null;
    if (applyTax) {
      const { data: settings } = await admin
        .from("sitter_settings")
        .select("tax_enabled, tax_rate_percent, tax_label, default_due_days")
        .eq("sitter_id", sitterId!)
        .maybeSingle();
      if (settings && (settings as any).tax_enabled) {
        taxRate = Number((settings as any).tax_rate_percent ?? 0);
        taxLabel = (settings as any).tax_label ?? "Tax";
        const sub = itemsWithTotals.reduce((s, li) => s + li.total_cents, 0);
        taxCents = Math.round((sub * taxRate) / 100);
        if (taxCents !== 0) {
          itemsWithTotals.push({
            label: `${taxLabel} (${taxRate}%)`,
            quantity: 1,
            unit_price_cents: taxCents,
            total_cents: taxCents,
            kind: "tax",
            sort_order: itemsWithTotals.length,
          });
        }
      }
      if (!computedDue) {
        const days = (settings as any)?.default_due_days ?? 7;
        const d = new Date();
        d.setDate(d.getDate() + days);
        computedDue = d.toISOString().slice(0, 10);
      }
    }

    const subtotal = itemsWithTotals
      .filter((li) => li.kind !== "tax")
      .reduce((s, li) => s + li.total_cents, 0);
    const total = subtotal + taxCents;

    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .insert({
        booking_id: invoiceBookingId,
        request_group_id: requestGroupId ?? null,
        sitter_id: sitterId!,
        customer_id: customerId!,
        status: sendEmail ? "sent" : "draft",
        subtotal_cents: subtotal,
        tax_cents: taxCents,
        tax_rate_percent: taxRate,
        tax_label: taxLabel,
        total_cents: total,
        due_date: computedDue,
        notes: notes ?? null,
        sent_at: sendEmail ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (invErr || !invoice) return json({ error: invErr?.message ?? "Insert failed" }, 500);

    const { error: liErr } = await admin.from("invoice_line_items").insert(
      itemsWithTotals.map((li) => ({
        invoice_id: invoice.id,
        label: li.label,
        quantity: li.quantity,
        unit_price_cents: li.unit_price_cents,
        total_cents: li.total_cents,
        kind: li.kind,
        sort_order: li.sort_order,
      })),
    );
    if (liErr) return json({ error: liErr.message }, 500);

    await admin.from("payment_events").insert({
      invoice_id: invoice.id,
      booking_id: invoiceBookingId,
      kind: "invoice_created",
      created_by: user.id,
      metadata: { invoice_number: invoice.invoice_number, total_cents: total, request_group_id: requestGroupId ?? null },
    });

    if (sendEmail) {
      try {
        await admin.functions.invoke("send-invoice-email", { body: { invoiceId: invoice.id } });
      } catch (e) {
        console.error("send-invoice-email failed", e);
      }
    }

    return json({ ok: true, invoice });
  } catch (e: any) {
    console.error("create-invoice error", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
