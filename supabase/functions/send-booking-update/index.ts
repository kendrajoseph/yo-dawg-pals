import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  kind: z.enum(["pickup", "dropoff", "note"]),
  note: z.string().trim().max(240).optional(),
  sendSms: z.boolean().default(true),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
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

const kindText = {
  pickup: "picked up",
  dropoff: "dropped off",
  note: "sent a quick update about",
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not configured");
    }

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY is not configured");
    }

    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) {
      throw new Error("TWILIO_API_KEY is not configured");
    }

    const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
    if (!twilioFromNumber) {
      return json(
        {
          error: "TWILIO_FROM_NUMBER is not configured",
          setup: "Add the sending phone number as a backend secret before using SMS updates.",
        },
        500,
      );
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { bookingId, kind, note, sendSms } = parsed.data;

    const { data: roleRows, error: rolesError } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      return json({ error: rolesError.message }, 403);
    }

    const isSitter = (roleRows ?? []).some((row) => row.role === "sitter");
    if (!isSitter) {
      return json({ error: "Only sitters can send booking updates" }, 403);
    }

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, customer_id, sitter_id, status, scheduled_start_at, start_at, services(name), pets(name)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return json({ error: "Booking not found" }, 404);
    }

    if (booking.sitter_id !== user.id) {
      return json({ error: "This booking is not assigned to you" }, 403);
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("full_name, mobile_phone, sms_opt_in")
      .eq("id", booking.customer_id)
      .maybeSingle();

    if (profileError) {
      return json({ error: profileError.message }, 400);
    }

    const customerName = profile?.full_name?.trim() || "there";
    const petName = booking.pets?.name || "your dog";
    const serviceName = booking.services?.name || "your service";

    const defaultMessage =
      kind === "pickup"
        ? `Anneke just picked up ${petName} for ${serviceName}.`
        : kind === "dropoff"
          ? `Anneke just dropped off ${petName}.`
          : `Anneke sent a quick update about ${petName}.`;

    const cleanNote = note?.trim() || null;
    const smsBody = cleanNote ? `${defaultMessage} ${cleanNote}` : defaultMessage;

    let smsSent = false;
    let smsError: string | null = null;
    let message = cleanNote ?? defaultMessage;

    if (sendSms && profile?.sms_opt_in && profile?.mobile_phone) {
      const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
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
        console.error("send-booking-update sms error", { twilioData, status: twilioResponse.status });
      } else {
        smsSent = true;
        message = cleanNote ?? defaultMessage;
      }
    }

    const { error: insertError } = await admin.from("booking_updates").insert({
      booking_id: bookingId,
      kind,
      message,
      sent_via_sms: smsSent,
      created_by: user.id,
    });

    if (insertError) {
      return json({ error: insertError.message }, 400);
    }

    // Also send a transactional email so the client gets it in their inbox
    let emailSent = false;
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(booking.customer_id);
      const recipientEmail = authUser?.user?.email;
      if (recipientEmail) {
        const subject =
          kind === "pickup"
            ? `${petName} is on their way home`
            : kind === "dropoff"
              ? `${petName} just got dropped off`
              : `Quick update about ${petName}`;
        const res = await admin.functions.invoke("send-transactional-email", {
          headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` },
          body: {
            templateName: "client-direct-message",
            recipientEmail,
            idempotencyKey: `booking-update-${bookingId}-${kind}-${Date.now()}`,
            templateData: {
              customerName,
              subject,
              message: smsBody,
              petName,
              serviceName,
              sitterName: "Anneke",
            },
          },
        });
        if (!res.error) emailSent = true;
      }
    } catch (e) {
      console.warn("send-booking-update email failed", e);
    }

    return json({
      ok: true,
      smsSent,
      emailSent,
      smsError,
      message: smsSent
        ? `Text + email sent to ${customerName}.`
        : emailSent
          ? `Email sent to ${customerName}${smsError ? " (SMS failed)" : ""}.`
          : smsError
            ? "Update saved, but SMS could not be sent."
          : sendSms
            ? "Update saved. SMS was skipped because the owner has not enabled text updates."
            : "Update saved without sending a text.",
      preview: smsBody,
    });
  } catch (error) {
    console.error("send-booking-update error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ ok: false, error: message }, 500);
  }
});
