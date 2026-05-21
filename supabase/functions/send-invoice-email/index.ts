// Send an invoice via the transactional email pipeline.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const bodySchema = z.object({ invoiceId: z.string().uuid() });

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PUBLIC_BASE = "https://yodawg.ca";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const { data: invoice } = await admin
      .from("invoices")
      .select("*")
      .eq("id", parsed.data.invoiceId)
      .maybeSingle();
    if (!invoice) return json({ error: "Invoice not found" }, 404);

    const { data: lineItems } = await admin
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("sort_order");

    const { data: customer } = await admin.auth.admin.getUserById((invoice as any).customer_id);
    const recipientEmail = customer?.user?.email;
    if (!recipientEmail) return json({ error: "Customer email not found" }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone, mobile_phone")
      .eq("id", (invoice as any).customer_id)
      .maybeSingle();

    const payUrl = `${PUBLIC_BASE}/pay/${(invoice as any).public_token}`;

    const sendRes = await fetch(`${url}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${service}`,
        apikey: service,
      },
      body: JSON.stringify({
        templateName: "invoice-issued",
        recipientEmail,
        idempotencyKey: `invoice-${invoice.id}-${Date.now()}`,
        templateData: {
          customerName: (profile as any)?.full_name ?? "there",
          customerEmail: recipientEmail,
          customerPhone: (profile as any)?.mobile_phone ?? (profile as any)?.phone ?? "",
          invoiceNumber: (invoice as any).invoice_number,
          dueDate: (invoice as any).due_date,
          totalCents: (invoice as any).total_cents,
          lineItems: (lineItems ?? []).map((li: any) => ({
            label: li.label,
            quantity: Number(li.quantity),
            total_cents: li.total_cents,
          })),
          payUrl,
          notes: (invoice as any).notes ?? "",
        },
        clientMessageLog: {
          sitterId: (invoice as any).sitter_id,
          customerId: (invoice as any).customer_id,
          bookingId: (invoice as any).booking_id,
          kind: "invoice",
          subject: `Invoice ${(invoice as any).invoice_number}`,
          message: `Invoice ${(invoice as any).invoice_number} sent · $${(((invoice as any).total_cents ?? 0) / 100).toFixed(2)}`,
        },
      }),
    });
    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("send-transactional-email failed", sendRes.status, errText);
      return json({ error: `Email send failed: ${errText}` }, 500);
    }
    let sendJson: any = {};
    try { sendJson = await sendRes.json(); } catch { /* ignore */ }

    await admin.from("invoices").update({
      status: (invoice as any).status === "draft" ? "sent" : (invoice as any).status,
      sent_at: (invoice as any).sent_at ?? new Date().toISOString(),
    }).eq("id", invoice.id);

    await admin.from("payment_events").insert({
      invoice_id: invoice.id,
      booking_id: (invoice as any).booking_id,
      kind: "invoice_sent",
      channel: "email",
      metadata: {
        recipient: recipientEmail,
        client_message_id: sendJson?.clientMessageId ?? null,
      },
    });

    return json({ ok: true });
  } catch (e: any) {
    console.error("send-invoice-email error", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
