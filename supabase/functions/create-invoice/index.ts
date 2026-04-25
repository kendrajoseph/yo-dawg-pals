// Create an invoice (with line items) for a booking. Optionally email it.
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
  bookingId: z.string().uuid(),
  dueDate: z.string().optional(), // YYYY-MM-DD
  notes: z.string().max(2000).optional(),
  lineItems: z.array(lineItemSchema).min(1),
  sendEmail: z.boolean().default(false),
});

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { bookingId, dueDate, notes, lineItems, sendEmail } = parsed.data;

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: booking } = await admin
      .from("bookings")
      .select("id, customer_id, sitter_id, start_at")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return json({ error: "Booking not found" }, 404);
    if ((booking as any).sitter_id !== user.id) return json({ error: "Forbidden" }, 403);

    // Compute totals
    const itemsWithTotals = lineItems.map((li, i) => ({
      ...li,
      total_cents: Math.round(li.unit_price_cents * li.quantity),
      sort_order: i,
    }));
    const subtotal = itemsWithTotals.reduce((s, li) => s + li.total_cents, 0);

    // Default due date: booking start - 1 day
    let computedDue = dueDate;
    if (!computedDue && (booking as any).start_at) {
      const d = new Date((booking as any).start_at);
      d.setDate(d.getDate() - 1);
      computedDue = d.toISOString().slice(0, 10);
    }

    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .insert({
        booking_id: bookingId,
        sitter_id: (booking as any).sitter_id,
        customer_id: (booking as any).customer_id,
        status: sendEmail ? "sent" : "draft",
        subtotal_cents: subtotal,
        total_cents: subtotal,
        due_date: computedDue ?? null,
        notes: notes ?? null,
        sent_at: sendEmail ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (invErr || !invoice) return json({ error: invErr?.message ?? "Insert failed" }, 500);

    const itemsToInsert = itemsWithTotals.map((li) => ({
      invoice_id: invoice.id,
      label: li.label,
      quantity: li.quantity,
      unit_price_cents: li.unit_price_cents,
      total_cents: li.total_cents,
      kind: li.kind,
      sort_order: li.sort_order,
    }));
    const { error: liErr } = await admin.from("invoice_line_items").insert(itemsToInsert);
    if (liErr) return json({ error: liErr.message }, 500);

    await admin.from("payment_events").insert({
      invoice_id: invoice.id,
      booking_id: bookingId,
      kind: "invoice_created",
      created_by: user.id,
      metadata: { invoice_number: invoice.invoice_number, total_cents: subtotal },
    });

    if (sendEmail) {
      try {
        await admin.functions.invoke("send-invoice-email", {
          body: { invoiceId: invoice.id },
        });
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
