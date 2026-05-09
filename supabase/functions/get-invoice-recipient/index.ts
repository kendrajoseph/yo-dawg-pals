// Returns the customer's contact info for an invoice the caller (sitter) owns.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const bodySchema = z.object({ invoiceId: z.string().uuid() });
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    // RLS will only return invoice if caller is the sitter (or admin/customer)
    const { data: inv, error } = await userClient
      .from("invoices")
      .select("id, customer_id, sitter_id, sent_at")
      .eq("id", parsed.data.invoiceId)
      .maybeSingle();
    if (error || !inv) return json({ error: "Not found" }, 404);

    const { data: u } = await admin.auth.admin.getUserById(inv.customer_id);
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone, mobile_phone")
      .eq("id", inv.customer_id)
      .maybeSingle();

    return json({
      email: u?.user?.email ?? null,
      phone: (profile as any)?.mobile_phone ?? (profile as any)?.phone ?? null,
      full_name: (profile as any)?.full_name ?? null,
      sent_at: (inv as any).sent_at,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
