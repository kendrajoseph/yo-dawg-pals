import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { bookingId, environment } = await req.json();
    if (!bookingId || typeof bookingId !== "string") return new Response(JSON.stringify({ error: "Invalid bookingId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: booking, error: bErr } = await supabase.from("bookings").select("id, customer_id, status, start_at, scheduled_start_at, stripe_payment_intent").eq("id", bookingId).single();
    if (bErr || !booking) return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (booking.customer_id !== user.id) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (["cancelled", "refunded"].includes(booking.status)) return new Response(JSON.stringify({ error: "Booking already cancelled" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const serviceStart = new Date(booking.scheduled_start_at || booking.start_at).getTime();
    const hoursUntil = (serviceStart - Date.now()) / 36e5;
    const eligibleForRefund = hoursUntil >= 24 && !!booking.stripe_payment_intent && booking.status === "confirmed";
    let refundId: string | null = null;
    if (eligibleForRefund) {
      const stripe = createStripeClient((environment || "sandbox") as StripeEnv);
      const refund = await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent! });
      refundId = refund.id;
    }

    const newStatus = eligibleForRefund ? "refunded" : "cancelled";
    await supabase.from("bookings").update({ status: newStatus, cancelled_at: new Date().toISOString(), refund_id: refundId }).eq("id", bookingId);
    return new Response(JSON.stringify({ status: newStatus, refunded: eligibleForRefund, hoursUntil: Math.round(hoursUntil) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cancel-booking error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
