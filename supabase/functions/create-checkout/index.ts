import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { notifyAnnekeOfPaidBooking } from "../_shared/notify-anneke.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { bookingId, environment, returnUrl } = await req.json();
    if (!bookingId || typeof bookingId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid bookingId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, customer_id, status, payment_amount_cents, total_cents, extra_time_fee_cents, late_pickup_fee_cents, services(name, payment_mode), service_variants(name, payment_mode)")
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (booking.customer_id !== user.id) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!["pending_payment", "awaiting_payment"].includes(booking.status)) return new Response(JSON.stringify({ error: "Booking is not payable" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const service = (booking as any).services;
    const variant = (booking as any).service_variants;
    const paymentMode = variant?.payment_mode ?? service?.payment_mode;
    const amountCents = booking.payment_amount_cents ?? booking.total_cents ?? 0;
    const itemName = variant?.name ?? service?.name ?? "Booking";

    if (paymentMode === "free" || amountCents === 0) {
      await supabase.from("bookings").update({ status: "confirmed", paid_at: new Date().toISOString() }).eq("id", bookingId);
      await notifyAnnekeOfPaidBooking(bookingId);
      return new Response(JSON.stringify({ free: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = createStripeClient((environment || "sandbox") as StripeEnv);
    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: "cad",
          product_data: {
            name: itemName,
            description: [
              booking.extra_time_fee_cents ? `Includes ${Math.round(booking.extra_time_fee_cents / 100)} CAD approved extra-time fees` : null,
              booking.late_pickup_fee_cents ? `Includes ${Math.round(booking.late_pickup_fee_cents / 100)} CAD late-pickup fee` : null,
            ].filter(Boolean).join(" · ") || undefined,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      ui_mode: "embedded",
      return_url: returnUrl || `${req.headers.get("origin")}/booking/${bookingId}/success?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: user.email,
      metadata: { bookingId, userId: user.id, serviceName: itemName },
      payment_intent_data: { metadata: { bookingId, userId: user.id } },
    });

    await supabase.from("bookings").update({ stripe_session_id: session.id }).eq("id", bookingId);
    return new Response(JSON.stringify({ clientSecret: session.client_secret }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("create-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
