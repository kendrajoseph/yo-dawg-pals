import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const bodySchema = z.object({
  customerId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  kind: z.enum(["service_update", "customer_service", "offer"]),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(1200),
  sendEmail: z.boolean().default(false),
  sendSms: z.boolean().default(false),
});

const json = (body: unknown, _status = 200) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toE164 = (phone: string) => {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

const kindLabel: Record<string, string> = {
  service_update: "Service update",
  customer_service: "Customer service",
  offer: "Client offer",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovelyApiKey = Deno.env.get("LOVABLE_API_KEY");
    const twilioApiKey = Deno.env.get("TWILIO_API_KEY");
    const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Backend configuration is incomplete");
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRows, error: rolesError } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) return json({ error: rolesError.message }, 403);
    const isSitter = (roleRows ?? []).some((row) => row.role === "sitter");
    if (!isSitter) return json({ error: "Only sitters can send client messages" }, 403);

    const { customerId, bookingId, kind, subject, message, sendEmail, sendSms } = parsed.data;

    if (bookingId) {
      const { data: bookingCheck, error: bookingCheckError } = await admin
        .from("bookings")
        .select("id")
        .eq("id", bookingId)
        .eq("customer_id", customerId)
        .eq("sitter_id", user.id)
        .maybeSingle();

      if (bookingCheckError) return json({ error: bookingCheckError.message }, 400);
      if (!bookingCheck) return json({ error: "Booking does not belong to this client" }, 403);
    } else {
      const { data: relationship, error: relationshipError } = await admin
        .from("bookings")
        .select("id")
        .eq("customer_id", customerId)
        .eq("sitter_id", user.id)
        .limit(1)
        .maybeSingle();

      if (relationshipError) return json({ error: relationshipError.message }, 400);
      if (!relationship) return json({ error: "You can only message clients you have bookings with" }, 403);
    }

    const [{ data: profile, error: profileError }, { data: booking }] = await Promise.all([
      admin.from("profiles").select("full_name, mobile_phone, sms_opt_in").eq("id", customerId).maybeSingle(),
      bookingId
        ? admin.from("bookings").select("scheduled_start_at, start_at, services(name), pets(name)").eq("id", bookingId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (profileError) return json({ error: profileError.message }, 400);

    const { data: insertRow, error: insertError } = await admin
      .from("client_messages")
      .insert({
        sitter_id: user.id,
        customer_id: customerId,
        booking_id: bookingId ?? null,
        kind,
        subject,
        message,
        send_email: sendEmail,
        send_sms: sendSms,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError || !insertRow) return json({ error: insertError?.message ?? "Failed to save message" }, 400);

    let emailSent = false;
    let smsSent = false;
    let smsError: string | null = null;

    if (sendEmail) {
      const recipientEmail = (await admin.auth.admin.getUserById(customerId)).data.user?.email;
      if (recipientEmail) {
        const bookingLabel = booking
          ? `${booking.services?.name ?? "Service"} · ${booking.pets?.name ?? "Pet"}`
          : undefined;
        const emailRes = await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "client-direct-message",
            recipientEmail,
            idempotencyKey: `client-direct-message-${insertRow.id}`,
            templateData: {
              customerName: profile?.full_name || undefined,
              subject,
              message,
              sitterName: "Anneke",
              bookingLabel,
              kindLabel: kindLabel[kind],
            },
          },
        });

        if (!emailRes.error) {
          emailSent = true;
          await admin.from("client_messages").update({ delivered_email_at: new Date().toISOString() }).eq("id", insertRow.id);
        }
      }
    }

    if (sendSms && profile?.sms_opt_in && profile.mobile_phone && lovelyApiKey && twilioApiKey && twilioFromNumber) {
      const smsBody = `${subject} — ${message}`.slice(0, 320);
      const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovelyApiKey}`,
          "X-Connection-Api-Key": twilioApiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: toE164(profile.mobile_phone),
          From: toE164(twilioFromNumber),
          Body: smsBody,
        }),
      });

      const twilioData = await twilioResponse.json();
      if (!twilioResponse.ok) {
        smsError = `SMS failed: Twilio API error [${twilioResponse.status}]: ${JSON.stringify(twilioData)}`;
        console.error("send-client-message sms error", { twilioData, status: twilioResponse.status });
      } else {
        smsSent = true;
        await admin.from("client_messages").update({ delivered_sms_at: new Date().toISOString() }).eq("id", insertRow.id);
      }
    }

    return json({
      ok: true,
      id: insertRow.id,
      emailSent,
      smsSent,
      smsError,
      message: smsError
        ? "Client message saved, but SMS could not be sent."
        : emailSent || smsSent
          ? "Client message sent."
          : "Client message saved in the app.",
    });
  } catch (error) {
    console.error("send-client-message error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ ok: false, error: message }, 500);
  }
});