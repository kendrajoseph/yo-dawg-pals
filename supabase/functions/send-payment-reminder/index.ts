// Send a payment reminder for an invoice. Sitter-triggered or cron.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const bodySchema = z.object({
  invoiceId: z.string().uuid(),
  tone: z.enum(["friendly", "firm", "final"]).default("friendly"),
  channel: z.enum(["email", "email_sms"]).default("email"),
  triggeredByCron: z.boolean().default(false),
});

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PUBLIC_BASE = "https://yodawg.ca";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { invoiceId, tone, channel, triggeredByCron } = parsed.data;

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const { data: invoice } = await admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (!invoice) return json({ error: "Invoice not found" }, 404);
    if (["paid", "void", "refunded"].includes((invoice as any).status)) {
      return json({ error: "Invoice does not need a reminder" }, 400);
    }

    const { data: customerAuth } = await admin.auth.admin.getUserById((invoice as any).customer_id);
    const recipientEmail = customerAuth?.user?.email;
    if (!recipientEmail) return json({ error: "Customer email not found" }, 400);

    const { data: profile } = await admin.from("profiles")
      .select("full_name, mobile_phone, sms_opt_in")
      .eq("id", (invoice as any).customer_id).maybeSingle();

    const owed = ((invoice as any).total_cents ?? 0) - ((invoice as any).amount_paid_cents ?? 0);
    const payUrl = `${PUBLIC_BASE}/pay/${(invoice as any).public_token}`;

    let daysOverdue = 0;
    if ((invoice as any).due_date) {
      const due = new Date((invoice as any).due_date);
      daysOverdue = Math.max(0, Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const { error: emailErr } = await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "payment-reminder",
        recipientEmail,
        idempotencyKey: `reminder-${invoice.id}-${tone}-${new Date().toISOString().slice(0, 10)}`,
        templateData: {
          customerName: (profile as any)?.full_name ?? "there",
          invoiceNumber: (invoice as any).invoice_number,
          dueDate: (invoice as any).due_date,
          amountDueCents: owed,
          payUrl,
          tone,
          daysOverdue,
        },
      },
    });
    if (emailErr) console.error("reminder email failed", emailErr);

    if (channel === "email_sms" && (profile as any)?.mobile_phone && (profile as any)?.sms_opt_in) {
      try {
        await admin.functions.invoke("send-client-message", {
          body: {
            customerId: (invoice as any).customer_id,
            kind: "customer_service",
            subject: `Payment reminder — ${(invoice as any).invoice_number}`,
            message: `Hi! Your invoice ${(invoice as any).invoice_number} for $${(owed / 100).toFixed(2)} is ${daysOverdue > 0 ? `${daysOverdue} days overdue` : "due"}. Pay here: ${payUrl}`,
            sendEmail: false,
            sendSms: true,
          },
        });
      } catch (e) { console.error("reminder SMS failed", e); }
    }

    await admin.from("payment_events").insert({
      invoice_id: invoice.id,
      booking_id: (invoice as any).booking_id,
      kind: "reminder_sent",
      channel,
      metadata: { tone, days_overdue: daysOverdue, triggered_by_cron: triggeredByCron },
    });

    if (daysOverdue > 0 && (invoice as any).status === "sent") {
      await admin.from("invoices").update({ status: "overdue" }).eq("id", invoice.id);
    }

    return json({ ok: true });
  } catch (e: any) {
    console.error("send-payment-reminder error", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
