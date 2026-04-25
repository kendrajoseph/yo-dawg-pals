// Issue a Stripe refund (full or partial) for a booking.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  amountCents: z.number().int().positive().optional(), // omit for full refund
  reason: z.string().max(500).optional(),
  notifyCustomer: z.boolean().default(true),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
});

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { bookingId, amountCents, reason, notifyCustomer, environment } = parsed.data;

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await client.from("user_roles").select("role").eq("user_id", user.id);
    const isSitter = (roles ?? []).some((r: any) => r.role === "sitter" || r.role === "admin");
    if (!isSitter) return json({ error: "Forbidden" }, 403);

    const { data: booking } = await admin.from("bookings")
      .select("id, sitter_id, stripe_payment_intent, stripe_charge_id, payment_amount_cents, customer_id")
      .eq("id", bookingId).maybeSingle();
    if (!booking) return json({ error: "Booking not found" }, 404);
    if (!(booking as any).stripe_payment_intent && !(booking as any).stripe_charge_id) {
      return json({ error: "No Stripe payment to refund (was this paid via Stripe?)" }, 400);
    }

    const stripe = createStripeClient(environment as StripeEnv);
    const refund = await stripe.refunds.create({
      payment_intent: (booking as any).stripe_payment_intent ?? undefined,
      charge: !(booking as any).stripe_payment_intent ? (booking as any).stripe_charge_id : undefined,
      amount: amountCents,
      reason: "requested_by_customer",
      metadata: { bookingId, sitter_reason: reason ?? "" },
    });

    const refunded = refund.amount;
    const remaining = Math.max(0, ((booking as any).payment_amount_cents ?? 0) - refunded);

    await admin.from("bookings").update({
      refund_id: refund.id,
      payment_status: remaining > 0 ? "partial" : "refunded",
      payment_amount_cents: remaining,
    }).eq("id", bookingId);

    // Update related invoice
    const { data: invoice } = await admin.from("invoices")
      .select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (invoice) {
      const newPaid = Math.max(0, ((invoice as any).amount_paid_cents ?? 0) - refunded);
      await admin.from("invoices").update({
        amount_paid_cents: newPaid,
        status: newPaid === 0 ? "refunded" : "partial",
      }).eq("id", invoice.id);
    }

    await admin.from("payment_events").insert({
      booking_id: bookingId,
      invoice_id: invoice?.id ?? null,
      kind: "refund",
      channel: "stripe",
      amount_cents: refunded,
      created_by: user.id,
      metadata: { stripe_refund_id: refund.id, reason: reason ?? null },
    });

    if (notifyCustomer) {
      try {
        const { data: customerAuth } = await admin.auth.admin.getUserById((booking as any).customer_id);
        const { data: profile } = await admin.from("profiles").select("full_name").eq("id", (booking as any).customer_id).maybeSingle();
        if (customerAuth?.user?.email) {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "refund-issued",
              recipientEmail: customerAuth.user.email,
              idempotencyKey: `refund-${refund.id}`,
              templateData: {
                customerName: (profile as any)?.full_name ?? "there",
                invoiceNumber: (invoice as any)?.invoice_number ?? "",
                refundedCents: refunded,
                reason: reason ?? "",
              },
            },
          });
        }
      } catch (e) { console.error("refund email failed", e); }
    }

    return json({ ok: true, refunded, refundId: refund.id });
  } catch (e: any) {
    console.error("refund-payment error", e);
    return json({ error: e?.raw?.message ?? e?.message ?? "Refund failed" }, 500);
  }
});
