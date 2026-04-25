import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { bookingId, environment } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return json({ error: "Backend configuration is incomplete" }, 500);
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Only Anneke (the sitter) can run off-session charges.
    const { data: roleRows } = await client.from("user_roles").select("role").eq("user_id", user.id);
    const isSitter = (roleRows ?? []).some((r: any) => r.role === "sitter" || r.role === "admin");
    if (!isSitter) return json({ error: "Forbidden" }, 403);

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, customer_id, sitter_id, status, payment_status, total_cents, payment_amount_cents, base_price_cents, extra_time_fee_cents, late_pickup_fee_cents, services(name), service_variants(name)")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr || !booking) return json({ error: "Booking not found" }, 404);

    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id, default_payment_method_id, full_name")
      .eq("id", (booking as any).customer_id)
      .maybeSingle();

    const stripeCustomerId = (profile as any)?.stripe_customer_id;
    const paymentMethodId = (profile as any)?.default_payment_method_id;
    if (!stripeCustomerId || !paymentMethodId) {
      return json({ error: "No saved card on file for this client. They need to complete a checkout once before you can recharge." }, 400);
    }

    const variant = (booking as any).service_variants;
    const service = (booking as any).services;
    const base = (booking as any).base_price_cents ?? 0;
    const extras = ((booking as any).extra_time_fee_cents ?? 0) + ((booking as any).late_pickup_fee_cents ?? 0);
    const total = (booking as any).total_cents ?? (base + extras);
    const alreadyPaid = (booking as any).payment_amount_cents ?? 0;
    const owed = Math.max(0, total - alreadyPaid);
    if (owed <= 0) return json({ error: "Nothing to charge — booking is already paid in full." }, 400);

    const itemName = variant?.name ?? service?.name ?? "Booking";

    const stripe = createStripeClient(environment as StripeEnv);
    const intent = await stripe.paymentIntents.create({
      amount: owed,
      currency: "cad",
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: `Yo Dawg — ${itemName} balance`,
      metadata: { bookingId, userId: (booking as any).customer_id, kind: "saved_card_recharge" },
    });

    if (intent.status === "succeeded") {
      await admin.from("bookings").update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent: intent.id,
        stripe_charge_id: typeof intent.latest_charge === "string" ? intent.latest_charge : null,
        payment_amount_cents: total,
      }).eq("id", bookingId);

      // Update related invoice
      const { data: inv } = await admin.from("invoices")
        .select("id, total_cents").eq("booking_id", bookingId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (inv) {
        await admin.from("invoices").update({
          status: "paid",
          amount_paid_cents: (inv as any).total_cents,
          paid_at: new Date().toISOString(),
        }).eq("id", (inv as any).id);
      }

      await admin.from("payment_events").insert({
        booking_id: bookingId,
        invoice_id: (inv as any)?.id ?? null,
        kind: "charge_succeeded",
        channel: "stripe_off_session",
        amount_cents: owed,
        created_by: user.id,
        metadata: { stripe_payment_intent: intent.id },
      });

      try {
        await admin.functions.invoke("send-payment-receipt", {
          body: {
            invoiceId: (inv as any)?.id ?? undefined,
            bookingId,
            amountPaidCents: owed,
            paymentMethod: "Saved card",
            paidAt: new Date().toISOString(),
          },
        });
      } catch (e) { console.error("receipt email failed", e); }

      return json({ ok: true, status: intent.status, amount: owed });
    }

    await admin.from("payment_events").insert({
      booking_id: bookingId,
      kind: "charge_failed",
      channel: "stripe_off_session",
      amount_cents: owed,
      created_by: user.id,
      metadata: { stripe_payment_intent: intent.id, status: intent.status },
    });

    return json({ ok: false, status: intent.status, requires_action: intent.status === "requires_action" }, 402);
  } catch (e: any) {
    console.error("charge-saved-card error", e);
    const message = e?.raw?.message || e?.message || "Charge failed";
    return json({ error: message }, 500);
  }
});
