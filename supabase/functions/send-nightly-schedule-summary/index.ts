import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const BUSINESS_TIMEZONE = "America/Toronto";
const MAX_BOOKINGS_IN_SMS = 5;

const bodySchema = z.object({
  dryRun: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false),
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

const getLocalParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
};

const getTomorrowDate = (timeZone: string) => {
  const now = new Date();
  const local = getLocalParts(now, timeZone);
  const base = new Date(`${local.year}-${local.month}-${local.day}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().slice(0, 10);
};

const formatStatus = (status: string) => {
  if (status === "requested") return "req";
  if (status === "confirmed") return "ok";
  if (status === "awaiting_payment" || status === "pending_payment") return "pay";
  return status;
};

const bookingTimeLabel = (booking: any) => {
  if (booking.booking_kind === "requested" && !booking.scheduled_start_at && booking.requested_window_label) {
    return booking.requested_window_label;
  }

  const raw = booking.scheduled_start_at ?? booking.start_at;
  const parts = getLocalParts(new Date(raw), BUSINESS_TIMEZONE);
  const hour = parts.hour % 12 || 12;
  const minute = String(parts.minute).padStart(2, "0");
  const suffix = parts.hour >= 12 ? "p" : "a";
  return minute === "00" ? `${hour}${suffix}` : `${hour}:${minute}${suffix}`;
};

const sortBookingValue = (booking: any) => {
  if (booking.booking_kind === "requested" && !booking.scheduled_start_at && booking.requested_window_start_minute !== null) {
    return booking.requested_window_start_minute;
  }

  const raw = booking.scheduled_start_at ?? booking.start_at;
  const parts = getLocalParts(new Date(raw), BUSINESS_TIMEZONE);
  return parts.hour * 60 + parts.minute;
};

const buildSummaryMessage = (recipientName: string | null, bookings: any[], tomorrow: string) => {
  const introName = recipientName?.trim() ? `Hi ${recipientName.trim().split(" ")[0]}, ` : "";

  if (bookings.length === 0) {
    return `${introName}tomorrow (${tomorrow}) is clear — no bookings or requests on the calendar.`;
  }

  const ordered = [...bookings].sort((a, b) => sortBookingValue(a) - sortBookingValue(b));
  const visible = ordered.slice(0, MAX_BOOKINGS_IN_SMS);
  const items = visible.map((booking) => {
    const petName = booking.pets?.name ?? "Pet";
    const serviceName = booking.services?.name ?? "Service";
    return `${bookingTimeLabel(booking)} ${petName} ${serviceName} (${formatStatus(booking.status)})`;
  });
  const extraCount = ordered.length - visible.length;
  const extra = extraCount > 0 ? ` +${extraCount} more.` : ".";

  return `${introName}tomorrow: ${ordered.length} booking${ordered.length === 1 ? "" : "s"}. ${items.join("; ")}${extra}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = bodySchema.safeParse(req.method === "POST" ? await req.json().catch(() => ({})) : {});
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const { dryRun, force } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");

    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
    if (!twilioFromNumber) throw new Error("TWILIO_FROM_NUMBER is not configured");

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const nowParts = getLocalParts(new Date(), BUSINESS_TIMEZONE);

    if (!force && nowParts.hour !== 20) {
      return json({ ok: true, skipped: true, reason: `Current ${BUSINESS_TIMEZONE} time is ${String(nowParts.hour).padStart(2, "0")}:${String(nowParts.minute).padStart(2, "0")}; waiting for 20:00.` });
    }

    const tomorrow = getTomorrowDate(BUSINESS_TIMEZONE);

    const [{ data: sitterRoles, error: sitterRoleError }, { data: bookingRows, error: bookingsError }] = await Promise.all([
      admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "sitter"),
      admin
        .from("bookings")
        .select("id, sitter_id, status, booking_kind, requested_date, requested_window_label, requested_window_start_minute, scheduled_start_at, start_at, services(name), pets(name)")
        .in("status", ["requested", "confirmed", "awaiting_payment", "pending_payment"]),
    ]);

    if (sitterRoleError) {
      return json({ error: sitterRoleError.message }, 400);
    }

    if (bookingsError) {
      return json({ error: bookingsError.message }, 400);
    }

    const sitterIds = (sitterRoles ?? []).map((row: any) => row.user_id as string);

    const { data: sitterProfiles, error: sitterProfilesError } = sitterIds.length === 0
      ? { data: [], error: null }
      : await admin.from("profiles").select("id, full_name, mobile_phone, sms_opt_in").in("id", sitterIds);

    if (sitterProfilesError) {
      return json({ error: sitterProfilesError.message }, 400);
    }

    const profileById = new Map((sitterProfiles ?? []).map((profile: any) => [profile.id as string, profile]));

    const recipients = sitterIds
      .map((userId) => {
        const profile = profileById.get(userId);
        return {
          userId,
          fullName: (profile?.full_name as string | null) ?? null,
          mobilePhone: (profile?.mobile_phone as string | null) ?? null,
          smsOptIn: Boolean(profile?.sms_opt_in),
        };
      })
      .filter((row) => row.smsOptIn && row.mobilePhone);

    const recipientIds = new Set(recipients.map((row) => row.userId));
    const bookingsBySitter = new Map<string, any[]>();

    for (const booking of bookingRows ?? []) {
      if (!recipientIds.has(booking.sitter_id)) continue;

      const bookingDate = booking.booking_kind === "requested" && !booking.scheduled_start_at && booking.requested_date
        ? booking.requested_date
        : getLocalParts(new Date(booking.scheduled_start_at ?? booking.start_at), BUSINESS_TIMEZONE);

      const normalizedDate = typeof bookingDate === "string"
        ? bookingDate
        : `${bookingDate.year}-${bookingDate.month}-${bookingDate.day}`;

      if (normalizedDate !== tomorrow) continue;
      const current = bookingsBySitter.get(booking.sitter_id) ?? [];
      current.push(booking);
      bookingsBySitter.set(booking.sitter_id, current);
    }

    const previews = recipients.map((recipient) => ({
      sitterId: recipient.userId,
      phone: recipient.mobilePhone,
      preview: buildSummaryMessage(recipient.fullName, bookingsBySitter.get(recipient.userId) ?? [], tomorrow),
      bookingCount: (bookingsBySitter.get(recipient.userId) ?? []).length,
    }));

    if (dryRun) {
      return json({ ok: true, dryRun: true, timezone: BUSINESS_TIMEZONE, tomorrow, recipients: previews });
    }

    const results = await Promise.all(
      previews.map(async (preview) => {
        const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: toE164(preview.phone ?? ""),
            From: toE164(twilioFromNumber),
            Body: preview.preview,
          }),
        });

        const responseText = await response.text();

        if (!response.ok) {
          throw new Error(`Twilio API error [${response.status}]: ${responseText}`);
        }

        return { sitterId: preview.sitterId, phone: preview.phone, bookingCount: preview.bookingCount };
      }),
    );

    return json({ ok: true, timezone: BUSINESS_TIMEZONE, tomorrow, sent: results.length, results, previews });
  } catch (error) {
    console.error("send-nightly-schedule-summary error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ ok: false, error: message }, 500);
  }
});