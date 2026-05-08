// Sitter-only: invite a new client by email. Creates an auth user (or
// reuses an existing one if the email already exists), then links the
// resulting profile to this sitter via created_by_sitter_id so RLS lets
// the sitter manage the client even before any booking exists.
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
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.full_name ?? "").trim();
    if (!email || !fullName) return json(400, { error: "Email and name required" });

    // Try to invite. If email already exists, fall back to looking up the user.
    let userId: string | null = null;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });

    if (invited?.user) {
      userId = invited.user.id;
    } else if (inviteErr) {
      // Email already registered → find existing user
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users.find((u) => u.email?.toLowerCase() === email);
      if (!found) return json(400, { error: inviteErr.message });
      userId = found.id;
    }
    if (!userId) return json(500, { error: "Could not create user" });

    // Patch profile (handle_new_user trigger created the row on insert).
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
      })
      .eq("id", userId);
    if (profErr) return json(500, { error: profErr.message });

    return json(200, { client_id: userId });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
