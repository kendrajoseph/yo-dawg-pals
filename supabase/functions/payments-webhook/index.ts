import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";
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
      if (bookingId) {
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        await supabase.from("bookings").update({ status: "confirmed", paid_at: new Date().toISOString(), stripe_payment_intent: paymentIntentId ?? null, stripe_session_id: session.id }).eq("id", bookingId);
        await notifyAnnekeOfPaidBooking(bookingId);
      }
    }
    if (event.type === "charge.refunded") {
      const charge: any = event.data.object;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) await supabase.from("bookings").update({ status: "refunded" }).eq("stripe_payment_intent", paymentIntentId);
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
