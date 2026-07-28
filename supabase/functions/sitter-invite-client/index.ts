// Sitter-only: create a client profile.
// - mode "invite": sends an email invite via Supabase auth
// - mode "ghost": creates an auth user with a synthetic email so the
//   profiles.id -> auth.users(id) FK is satisfied, without emailing anyone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(401, { error: "Not signed in" });

    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "sitter").maybeSingle();
    if (!roleRow) return json(403, { error: "Sitter only" });

    const body = await req.json().catch(() => ({}));
    const mode: "invite" | "ghost" = body.mode === "ghost" ? "ghost" : "invite";
    const fullName = String(body.full_name ?? "").trim();
    if (!fullName) return json(400, { error: "Name required" });

    let userId: string | null = null;

    if (mode === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return json(400, { error: "Email required" });

      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
      });

      if (invited?.user) {
        userId = invited.user.id;
      } else if (inviteErr) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = list?.users.find((u) => u.email?.toLowerCase() === email);
        if (!found) return json(400, { error: inviteErr.message });
        userId = found.id;
      }
    } else {
      // Ghost: synthesize an email to satisfy auth.users NOT NULL/unique, mark manual.
      const syntheticEmail = `manual-${crypto.randomUUID()}@ghost.yodawg.local`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: { full_name: fullName, is_manual_ghost: true },
      });
      if (createErr || !created?.user) return json(500, { error: createErr?.message ?? "Could not create ghost user" });
      userId = created.user.id;
    }

    if (!userId) return json(500, { error: "Could not create user" });

    const { error: profErr } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        phone: body.phone || null,
        mobile_phone: body.mobile_phone || null,
        address_line1: body.address_line1 || null,
        address_line2: body.address_line2 || null,
        city: body.city || null,
        province: body.province || null,
        postal_code: body.postal_code || null,
        created_by_sitter_id: user.id,
        is_manual: mode === "ghost",
      })
      .eq("id", userId);
    if (profErr) return json(500, { error: profErr.message });

    return json(200, { client_id: userId });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
