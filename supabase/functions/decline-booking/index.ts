import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().trim().max(800).optional(),
  sendEmail: z.boolean().default(true),
  sendSms: z.boolean().default(false),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toE164 = (phone: string) => {
  const trimmed = (phone || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

const formatWhen = (iso?: string | null, dateOnly?: string | null, label?: string | null) => {
  if (iso) {
    return new Date(iso).toLocaleString("en-CA", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto",
    });
  }
  if (dateOnly) {
    const d = new Date(`${dateOnly}T12:00:00`);
    const datePart = d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    return label ? `${datePart} · ${label}` : datePart;
  }
  return "your requested time";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const twilioApiKey = Deno.env.get("TWILIO_API_KEY");
    const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

    const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` } },
    });

    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { bookingId, reason, sendEmail, sendSms } = parsed.data;
    const cleanReason = reason && reason.trim().length > 0 ? reason.trim() : null;

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, customer_id, sitter_id, status, scheduled_start_at, requested_date, requested_window_label, services(name), pets(name)")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr || !booking) return json({ error: "Booking not found" }, 404);

    const { data: roleRows } = await client.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
    const isSitter = booking.sitter_id === user.id;
    if (!isSitter && !isAdmin) return json({ error: "Forbidden" }, 403);

    // Cancel the booking
    const { error: updateError } = await admin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        internal_notes: cleanReason
          ? `[Declined] ${cleanReason}`
          : booking.status,
      })
      .eq("id", bookingId);
    if (updateError) return json({ error: updateError.message }, 400);

    // Audit log entry
    await admin.from("booking_updates").insert({
      booking_id: bookingId,
      created_by: user.id,
      kind: "approval",
      message: cleanReason ? `Declined. Reason: ${cleanReason}` : "Declined.",
      sent_via_sms: false,
    });

    // Look up customer info
    const [{ data: profile }, { data: customerAuth }] = await Promise.all([
      admin.from("profiles").select("full_name, mobile_phone, sms_opt_in").eq("id", booking.customer_id).maybeSingle(),
      admin.auth.admin.getUserById(booking.customer_id),
    ]);
    const customerEmail = customerAuth?.user?.email;
    const customerName = profile?.full_name || customerEmail || "there";
    const serviceName = (booking.services as any)?.name || "walk";
    const petName = (booking.pets as any)?.name || "";
    const requestedWhen = formatWhen(
      booking.scheduled_start_at as string | null,
      booking.requested_date as string | null,
      booking.requested_window_label as string | null,
    );

    let emailSent = false;
    let emailError: string | null = null;
    let smsSent = false;
    let smsError: string | null = null;

    if (sendEmail) {
      if (!customerEmail) {
        emailError = "No email address on file for this client.";
      } else {
        const emailRes = await admin.functions.invoke("send-transactional-email", {
          headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` },
          body: {
            templateName: "booking-declined",
            recipientEmail: customerEmail,
            idempotencyKey: `booking-declined-${bookingId}-${Date.now()}`,
            templateData: {
              customerName,
              serviceName,
              petName,
              requestedWhen,
              reason: cleanReason ?? undefined,
              sitterName: "Anneke",
            },
          },
        });
        const data = emailRes.data as { success?: boolean; queued?: boolean; reason?: string; error?: string } | null;
        if (emailRes.error) {
          emailError = emailRes.error.message;
        } else if (data?.success === false) {
          emailError = data.reason === "email_suppressed"
            ? "Email skipped because this address is unsubscribed or suppressed."
            : data.error ?? "Email could not be queued.";
        } else if (data?.success === true || data?.queued === true) {
          emailSent = true;
        } else {
          emailError = "Email could not be queued.";
        }
      }
    }

    if (sendSms) {
      if (!profile?.mobile_phone) {
        smsError = "No mobile number on file.";
      } else if (!profile.sms_opt_in) {
        smsError = "Client has not opted in to SMS.";
      } else if (!lovableApiKey || !twilioApiKey || !twilioFromNumber) {
        smsError = "SMS is not configured.";
      } else {
        const lines = [
          `Hi ${customerName.split(" ")[0]}, Anneke here.`,
          `I can't take your ${serviceName.toLowerCase()}${petName ? ` for ${petName}` : ""} (${requestedWhen}).`,
        ];
        if (cleanReason) lines.push(cleanReason);
        lines.push("Feel free to send another request. — Yo Dawg");
        const smsBody = lines.join(" ").slice(0, 320);

        const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "X-Connection-Api-Key": twilioApiKey,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: toE164(profile.mobile_phone),
            From: toE164(twilioFromNumber),
            Body: smsBody,
          }),
        });
        const twilioData = await twilioResponse.json().catch(() => ({}));
        if (!twilioResponse.ok) {
          smsError = `SMS failed: ${twilioResponse.status} ${JSON.stringify(twilioData)}`;
          console.error("decline-booking sms error", { twilioData, status: twilioResponse.status });
        } else {
          smsSent = true;
        }
      }
    }

    return json({
      ok: true,
      cancelled: true,
      emailSent,
      emailError,
      smsSent,
      smsError,
    });
  } catch (error) {
    console.error("decline-booking error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ ok: false, error: message }, 500);
  }
});
