import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
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
      .select("id, customer_id, status, start_at, scheduled_start_at, stripe_payment_intent, stripe_charge_id, payment_amount_cents, payment_status")
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) return json({ error: "Booking not found" }, 404);
    if (booking.customer_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (["cancelled", "refunded"].includes(booking.status)) return json({ error: "Booking already cancelled" }, 400);

    const serviceStart = new Date(booking.scheduled_start_at || booking.start_at).getTime();
    const hoursUntil = (serviceStart - Date.now()) / 36e5;
    const paidCents = (booking as any).payment_amount_cents ?? 0;
    const wasPaid = (booking as any).payment_status === "paid" || paidCents > 0;
    // Auto-refund any paid booking (not just status='confirmed') within the policy window.
    const refundCents = wasPaid && (booking.stripe_payment_intent || (booking as any).stripe_charge_id)
      ? computeRefundCents(paidCents, hoursUntil)
      : 0;

    // Auto-detect Stripe env (sandbox vs live) from the original checkout session,
    // so customers paid in live mode get refunded in live mode.
    let resolvedEnv: StripeEnv = environment as StripeEnv;
    try {
      const { data: lastCharge } = await supabase.from("payment_events")
        .select("metadata")
        .eq("booking_id", bookingId)
        .eq("kind", "charge_succeeded")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sid = (lastCharge as any)?.metadata?.stripe_session_id ?? "";
      if (typeof sid === "string" && sid.startsWith("cs_live_")) resolvedEnv = "live";
      else if (typeof sid === "string" && sid.startsWith("cs_test_")) resolvedEnv = "sandbox";
    } catch (_) { /* fall through to caller-supplied env */ }

    let refundId: string | null = null;
    let refundedAmount = 0;
    if (refundCents > 0) {
      const tryRefund = async (env: StripeEnv) => {
        const stripe = createStripeClient(env);
        return await stripe.refunds.create({
          payment_intent: (booking as any).stripe_payment_intent ?? undefined,
          charge: !(booking as any).stripe_payment_intent ? (booking as any).stripe_charge_id : undefined,
          amount: refundCents,
          reason: "requested_by_customer",
          metadata: { bookingId, source: "customer_cancel", hoursUntil: String(Math.round(hoursUntil * 10) / 10) },
        });
      };

      let refund: any;
      try {
        refund = await tryRefund(resolvedEnv);
      } catch (e: any) {
        const code = e?.raw?.code ?? e?.code;
        if (code === "resource_missing") {
          const other: StripeEnv = resolvedEnv === "live" ? "sandbox" : "live";
          console.log(`cancel-booking: ${resolvedEnv} missing intent, retrying in ${other}`);
          refund = await tryRefund(other);
          resolvedEnv = other;
        } else {
          throw e;
        }
      }
      refundId = refund.id;
      refundedAmount = refund.amount ?? refundCents;
    }

    const isFullRefund = refundedAmount >= paidCents && paidCents > 0;
    const newStatus = isFullRefund ? "refunded" : "cancelled";
    const remaining = Math.max(0, paidCents - refundedAmount);

    // Update booking — also reflect refund on payment_status / payment_amount_cents
    // so the invoice/booking UI shows the correct paid balance.
    const bookingUpdate: Record<string, unknown> = {
      status: newStatus,
      cancelled_at: new Date().toISOString(),
      refund_id: refundId,
      refund_amount_cents: refundedAmount,
    };
    if (refundedAmount > 0) {
      bookingUpdate.payment_status = remaining > 0 ? "partial" : "refunded";
      bookingUpdate.payment_amount_cents = remaining;
    }
    await supabase.from("bookings").update(bookingUpdate).eq("id", bookingId);

    // Mirror refund onto the related invoice + log a payment_event so it appears
    // in invoice history just like a sitter-initiated refund.
    if (refundedAmount > 0) {
      const { data: invoice } = await supabase.from("invoices")
        .select("id, amount_paid_cents")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invoice) {
        const newPaid = Math.max(0, ((invoice as any).amount_paid_cents ?? 0) - refundedAmount);
        await supabase.from("invoices").update({
          amount_paid_cents: newPaid,
          status: newPaid === 0 ? "void" : "partial",
        }).eq("id", (invoice as any).id);
      }

      await supabase.from("payment_events").insert({
        booking_id: bookingId,
        invoice_id: (invoice as any)?.id ?? null,
        kind: "refund",
        channel: "stripe",
        amount_cents: refundedAmount,
        created_by: user.id,
        metadata: {
          stripe_refund_id: refundId,
          source: "customer_cancel",
          policy: hoursUntil >= 24 ? "full" : hoursUntil >= 12 ? "half" : "none",
          environment: resolvedEnv,
        },
      });
    }

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
