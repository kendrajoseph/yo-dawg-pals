import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const xmlHeaders = {
  ...corsHeaders,
  "Content-Type": "text/xml; charset=utf-8",
};

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const emptyResponse = () =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response/>`, {
    status: 200,
    headers: xmlHeaders,
  });

const replyResponse = (msg: string) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(msg)}</Message></Response>`,
    { status: 200, headers: xmlHeaders },
  );

const normalizePhone = (phone: string) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let fromPhone = "";
    let toPhone = "";
    let body = "";
    let messageSid = "";

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      fromPhone = String(form.get("From") || "");
      toPhone = String(form.get("To") || "");
      body = String(form.get("Body") || "").trim();
      messageSid = String(form.get("MessageSid") || "");
    } else {
      try {
        const json = await req.json();
        fromPhone = String(json.From || json.from || "");
        toPhone = String(json.To || json.to || "");
        body = String(json.Body || json.body || "").trim();
        messageSid = String(json.MessageSid || json.messageSid || "");
      } catch {
        // ignore
      }
    }

    if (!fromPhone || !body) {
      return emptyResponse();
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const normalizedFrom = normalizePhone(fromPhone);
    const upperBody = body.toUpperCase();

    const stopKeywords = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
    const helpKeywords = ["HELP", "INFO"];
    const startKeywords = ["START", "YES", "UNSTOP"];

    const isStop = stopKeywords.includes(upperBody);
    const isHelp = helpKeywords.includes(upperBody);
    const isStart = startKeywords.includes(upperBody);

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, mobile_phone, phone, full_name");

    let matchedProfile: { id: string; full_name: string | null } | null = null;
    for (const p of profiles ?? []) {
      const candidates = [p.mobile_phone, p.phone].filter(Boolean) as string[];
      if (candidates.some((c) => normalizePhone(c) === normalizedFrom)) {
        matchedProfile = { id: p.id, full_name: p.full_name };
        break;
      }
    }

    await admin.from("inbound_sms_messages").insert({
      twilio_message_sid: messageSid || null,
      from_phone: fromPhone,
      to_phone: toPhone,
      body,
      matched_profile_id: matchedProfile?.id ?? null,
      is_stop: isStop,
      is_help: isHelp,
    });

    if (isStop && matchedProfile) {
      await admin
        .from("profiles")
        .update({
          sms_opt_in: false,
          sms_unsubscribed_at: new Date().toISOString(),
        })
        .eq("id", matchedProfile.id);
      return emptyResponse();
    }

    if (isStart && matchedProfile) {
      await admin
        .from("profiles")
        .update({
          sms_opt_in: true,
          sms_unsubscribed_at: null,
        })
        .eq("id", matchedProfile.id);
      return replyResponse(
        "Yo Dawg: You're subscribed again. Reply STOP to unsubscribe at any time.",
      );
    }

    if (isHelp) {
      return replyResponse(
        "Yo Dawg: For help email anneke@yodawg.ca or call 647-278-4483. Reply STOP to unsubscribe. Msg & data rates may apply.",
      );
    }

    return emptyResponse();
  } catch (error) {
    console.error("handle-twilio-inbound error", error);
    return emptyResponse();
  }
});
