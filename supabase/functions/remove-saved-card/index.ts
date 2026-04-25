// Allows a customer to detach their saved card from Stripe and clear it from their profile.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const bodySchema = z.object({
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
});

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { environment } = parsed.data;

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await admin
      .from("profiles")
      .select("default_payment_method_id")
      .eq("id", user.id)
      .maybeSingle();

    const pmId = (profile as any)?.default_payment_method_id;
    if (pmId) {
      try {
        const stripe = createStripeClient(environment as StripeEnv);
        await stripe.paymentMethods.detach(pmId);
      } catch (e) {
        console.warn("Stripe detach failed (continuing to clear locally)", e);
      }
    }

    await admin.from("profiles").update({ default_payment_method_id: null }).eq("id", user.id);
    return json({ ok: true });
  } catch (e: any) {
    console.error("remove-saved-card error", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
