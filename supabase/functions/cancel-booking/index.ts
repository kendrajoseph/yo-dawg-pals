import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * Refund policy:
 *   ≥24h before service start → 100% refund
 *   12-24h before                → 50% refund
 *   <12h or already started      → 0% refund
 */
function computeRefundCents(paidCents: number, hoursUntil: number): number {
  if (hoursUntil >= 24) return paidCents;
  if (hoursUntil >= 12) return Math.round(paidCents * 0.5);
  return 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { bookingId, environment } = parsed.data;

    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, customer_id, status, start_at, scheduled_start_at, stripe_payment_intent, payment_amount_cents")
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) return json({ error: "Booking not found" }, 404);
    if (booking.customer_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (["cancelled", "refunded"].includes(booking.status)) return json({ error: "Booking already cancelled" }, 400);

    const serviceStart = new Date(booking.scheduled_start_at || booking.start_at).getTime();
    const hoursUntil = (serviceStart - Date.now()) / 36e5;
    const paidCents = (booking as any).payment_amount_cents ?? 0;
    const refundCents = booking.status === "confirmed" && booking.stripe_payment_intent
      ? computeRefundCents(paidCents, hoursUntil)
      : 0;

    let refundId: string | null = null;
    let refundedAmount = 0;
    if (refundCents > 0 && booking.stripe_payment_intent) {
      const stripe = createStripeClient(environment as StripeEnv);
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent,
        amount: refundCents,
      });
      refundId = refund.id;
      refundedAmount = refundCents;
    }

    const isFullRefund = refundedAmount >= paidCents && paidCents > 0;
    const newStatus = isFullRefund ? "refunded" : "cancelled";

    await supabase.from("bookings").update({
      status: newStatus,
      cancelled_at: new Date().toISOString(),
      refund_id: refundId,
      refund_amount_cents: refundedAmount,
    }).eq("id", bookingId);

    return json({
      status: newStatus,
      refunded: refundedAmount > 0,
      refundCents: refundedAmount,
      hoursUntil: Math.round(hoursUntil * 10) / 10,
      policy: hoursUntil >= 24 ? "full" : hoursUntil >= 12 ? "half" : "none",
    });
  } catch (e) {
    console.error("cancel-booking error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
