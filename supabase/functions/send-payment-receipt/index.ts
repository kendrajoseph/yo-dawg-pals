// Send a payment receipt. Called by webhook on success or manually.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const bodySchema = z.object({
  invoiceId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  amountPaidCents: z.number().int().positive(),
  paymentMethod: z.string().max(120).optional(),
  paidAt: z.string().optional(),
}).refine((d) => d.invoiceId || d.bookingId, { message: "invoiceId or bookingId required" });

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { invoiceId, bookingId, amountPaidCents, paymentMethod, paidAt } = parsed.data;

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    let invoice: any = null;
    if (invoiceId) {
      const { data } = await admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
      invoice = data;
    } else if (bookingId) {
      const { data } = await admin.from("invoices").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      invoice = data;
    }

    let customerId = invoice?.customer_id;
    let invoiceNumber = invoice?.invoice_number ?? "";
    let lineItems: any[] = [];

    if (invoice) {
      const { data: lis } = await admin.from("invoice_line_items").select("*").eq("invoice_id", invoice.id).order("sort_order");
      lineItems = lis ?? [];
    } else if (bookingId) {
      const { data: b } = await admin.from("bookings").select("customer_id").eq("id", bookingId).maybeSingle();
      customerId = (b as any)?.customer_id;
    }
    if (!customerId) return json({ error: "Customer not found" }, 404);

    const { data: customerAuth } = await admin.auth.admin.getUserById(customerId);
    const recipientEmail = customerAuth?.user?.email;
    if (!recipientEmail) return json({ error: "Customer email not found" }, 400);

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", customerId).maybeSingle();

    const receiptNumber = invoiceNumber ? invoiceNumber.replace("INV-", "RCP-") : `RCP-${Date.now()}`;

    const { data: sendData, error: sendErr } = await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "payment-receipt",
        recipientEmail,
        idempotencyKey: `receipt-${invoice?.id ?? bookingId}-${amountPaidCents}-${paidAt ?? Date.now()}`,
        templateData: {
          customerName: (profile as any)?.full_name ?? "there",
          invoiceNumber,
          receiptNumber,
          paidAt: paidAt ?? new Date().toISOString(),
          amountPaidCents,
          paymentMethod: paymentMethod ?? "",
          lineItems: lineItems.map((li) => ({
            label: li.label, quantity: Number(li.quantity), total_cents: li.total_cents,
          })),
        },
        clientMessageLog: invoice?.sitter_id && customerId ? {
          sitterId: invoice.sitter_id,
          customerId,
          bookingId: invoice?.booking_id ?? bookingId ?? null,
          kind: "receipt",
          subject: `Receipt ${receiptNumber}`,
          message: `Payment received · $${(amountPaidCents / 100).toFixed(2)}${paymentMethod ? ` · ${paymentMethod}` : ""}`,
        } : undefined,
      },
    });
    if (sendErr) return json({ error: sendErr.message }, 500);

    await admin.from("payment_events").insert({
      invoice_id: invoice?.id ?? null,
      booking_id: bookingId ?? invoice?.booking_id ?? null,
      kind: "receipt_sent",
      channel: "email",
      amount_cents: amountPaidCents,
      metadata: {
        receipt_number: receiptNumber,
        payment_method: paymentMethod ?? null,
        client_message_id: (sendData as any)?.clientMessageId ?? null,
      },
    });

    return json({ ok: true });
  } catch (e: any) {
    console.error("send-payment-receipt error", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
