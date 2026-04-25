import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, verifyWebhook } from "../_shared/stripe.ts";
import { notifyAnnekeOfPaidBooking } from "../_shared/notify-anneke.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const env = ((new URL(req.url)).searchParams.get("env") || "sandbox") as StripeEnv;
  try {
    const event = await verifyWebhook(req, env);
    if (event.type === "checkout.session.completed") {
      const session: any = event.data.object;
      const bookingId = session.metadata?.bookingId;
      const userId = session.metadata?.userId;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

      // Capture the saved payment method so Anneke can recharge later off-session.
      if (userId && customerId && paymentIntentId) {
        try {
          const stripe = createStripeClient(env);
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
          const paymentMethodId = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
          if (paymentMethodId) {
            await supabase
              .from("profiles")
              .update({ stripe_customer_id: customerId, default_payment_method_id: paymentMethodId })
              .eq("id", userId);
          }
        } catch (err) {
          console.error("Failed to capture saved payment method", err);
        }
      }

      if (bookingId) {
        const { data: bookingRow } = await supabase
          .from("bookings")
          .select("total_cents, payment_amount_cents")
          .eq("id", bookingId)
          .maybeSingle();
        const totalCents = (bookingRow as any)?.total_cents ?? (session.amount_total ?? 0);
        const paidCents = session.amount_total ?? totalCents;

        await supabase.from("bookings").update({
          status: "confirmed",
          paid_at: new Date().toISOString(),
          payment_status: "paid",
          payment_amount_cents: paidCents,
          stripe_payment_intent: paymentIntentId ?? null,
          stripe_session_id: session.id,
        }).eq("id", bookingId);

        // Mark related invoice paid + emit events + send receipt
        const invoiceId = session.metadata?.invoiceId;
        let resolvedInvoiceId: string | null = invoiceId ?? null;
        if (!resolvedInvoiceId) {
          const { data: inv } = await supabase.from("invoices")
            .select("id").eq("booking_id", bookingId)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          resolvedInvoiceId = (inv as any)?.id ?? null;
        }
        if (resolvedInvoiceId) {
          await supabase.from("invoices").update({
            status: "paid",
            amount_paid_cents: paidCents,
            paid_at: new Date().toISOString(),
          }).eq("id", resolvedInvoiceId);
        }

        await supabase.from("payment_events").insert({
          booking_id: bookingId,
          invoice_id: resolvedInvoiceId,
          kind: "charge_succeeded",
          channel: "stripe",
          amount_cents: paidCents,
          metadata: { stripe_session_id: session.id, stripe_payment_intent: paymentIntentId },
        });

        try {
          await supabase.functions.invoke("send-payment-receipt", {
            body: {
              invoiceId: resolvedInvoiceId ?? undefined,
              bookingId,
              amountPaidCents: paidCents,
              paymentMethod: "Card",
              paidAt: new Date().toISOString(),
            },
          });
        } catch (e) { console.error("receipt email failed", e); }

        await notifyAnnekeOfPaidBooking(bookingId);
      }
    }
    if (event.type === "charge.refunded") {
      const charge: any = event.data.object;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) await supabase.from("bookings").update({ status: "refunded", payment_status: "refunded" }).eq("stripe_payment_intent", paymentIntentId);
    }
    if (event.type === "payment_intent.succeeded") {
      const intent: any = event.data.object;
      const bookingId = intent.metadata?.bookingId;
      if (bookingId) {
        await supabase.from("bookings").update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent: intent.id,
          stripe_charge_id: intent.latest_charge ?? null,
        }).eq("id", bookingId);
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
