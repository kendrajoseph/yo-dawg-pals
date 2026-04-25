// Public endpoint: looks up an invoice by token and returns Stripe Checkout URL.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const bodySchema = z.object({
  token: z.string().min(10).max(200),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
  returnOrigin: z.string().url().optional(),
});

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { token, environment, returnOrigin } = parsed.data;

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const { data: invoice } = await admin.from("invoices").select("*").eq("public_token", token).maybeSingle();
    if (!invoice) return json({ error: "Invoice not found" }, 404);
    if (["paid", "void", "refunded"].includes((invoice as any).status)) {
      return json({ error: "Invoice already settled" }, 400);
    }

    const owed = ((invoice as any).total_cents ?? 0) - ((invoice as any).amount_paid_cents ?? 0);
    if (owed <= 0) return json({ error: "Nothing to pay" }, 400);

    const origin = returnOrigin ?? req.headers.get("origin") ?? "https://yodawg.ca";

    const stripe = createStripeClient(environment as StripeEnv);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "cad",
          unit_amount: owed,
          product_data: { name: `Invoice ${(invoice as any).invoice_number}` },
        },
        quantity: 1,
      }],
      success_url: `${origin}/pay/${token}?status=paid`,
      cancel_url: `${origin}/pay/${token}?status=cancelled`,
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: {
          bookingId: (invoice as any).booking_id,
          invoiceId: (invoice as any).id,
          userId: (invoice as any).customer_id,
        },
      },
      metadata: {
        bookingId: (invoice as any).booking_id,
        invoiceId: (invoice as any).id,
        userId: (invoice as any).customer_id,
      },
    });

    return json({ url: session.url });
  } catch (e: any) {
    console.error("pay-invoice-public error", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
