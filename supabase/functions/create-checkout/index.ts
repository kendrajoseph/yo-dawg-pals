// Creates a Stripe embedded checkout session for a booking.
// Free bookings ($0) skip Stripe entirely and confirm immediately.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { notifyAnnekeOfPaidBooking } from "../_shared/notify-anneke.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { bookingId, environment, returnUrl } = await req.json();
    if (!bookingId || typeof bookingId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid bookingId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate the customer
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load booking + linked service (server-side, bypasses RLS)
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, customer_id, status, payment_amount_cents, services(name, stripe_price_id, payment_mode)")
      .eq("id", bookingId)
      .single();

    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (booking.customer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = (booking as any).services;
    if (!service?.stripe_price_id) {
      return new Response(JSON.stringify({ error: "Service has no Stripe price configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Free service path — confirm immediately, skip Stripe entirely
    if (service.payment_mode === "free") {
      await supabase
        .from("bookings")
        .update({ status: "confirmed", paid_at: new Date().toISOString() })
        .eq("id", bookingId);
      await notifyAnnekeOfPaidBooking(bookingId);
      return new Response(JSON.stringify({ free: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Resolve human-readable price ID via lookup_keys
    const prices = await stripe.prices.list({ lookup_keys: [service.stripe_price_id] });
    if (!prices.data.length) {
      return new Response(JSON.stringify({ error: `Price ${service.stripe_price_id} not found in Stripe` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripePrice = prices.data[0];

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded",
      return_url: returnUrl || `${req.headers.get("origin")}/booking/${bookingId}/success?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: user.email,
      metadata: {
        bookingId,
        userId: user.id,
        serviceName: service.name ?? "",
      },
      payment_intent_data: {
        metadata: { bookingId, userId: user.id },
      },
    });

    // Save the session id for reconciliation
    await supabase
      .from("bookings")
      .update({ stripe_session_id: session.id })
      .eq("id", bookingId);

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
