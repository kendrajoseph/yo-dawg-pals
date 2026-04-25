import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  requestGroupId: z.string().uuid().optional(),
  bookingCount: z.number().int().min(1).optional(),
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

const formatRequestTiming = (booking: {
  requested_date?: string | null;
  requested_window_label?: string | null;
  start_at: string;
}) => {
  if (booking.requested_date && booking.requested_window_label) {
    return `${booking.requested_date} · ${booking.requested_window_label}`;
  }

  return new Date(booking.start_at).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseAnonKey) throw new Error("SUPABASE_ANON_KEY is not configured");

    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
    if (!twilioFromNumber) throw new Error("TWILIO_FROM_NUMBER is not configured");

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await client.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const userId = claimsData.claims.sub;
    const { bookingId, requestGroupId, bookingCount } = parsed.data;

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, customer_id, sitter_id, status, request_group_id, requested_date, requested_window_label, start_at, services(name), pets(name)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return json({ error: "Booking not found" }, 404);
    }

    if (booking.customer_id !== userId) {
      return json({ error: "Forbidden" }, 403);
    }

    if (booking.status !== "requested") {
      return json({ error: "Only requested bookings can trigger this alert" }, 400);
    }

    // Dedupe at the request-group level: only send ONE sitter notification per group,
    // even when the group fans out into multiple booking rows (multi-pet, multi-service).
    const groupId = requestGroupId || booking.request_group_id;
    if (groupId) {
      const { data: groupBookingIds } = await admin
        .from("bookings")
        .select("id")
        .eq("request_group_id", groupId);
      const ids = (groupBookingIds ?? []).map((row: { id: string }) => row.id);
      if (ids.length > 0) {
        const { data: existingForGroup } = await admin
          .from("sitter_notifications")
          .select("id")
          .in("booking_id", ids)
          .eq("kind", "booking_request")
          .limit(1);
        if (existingForGroup && existingForGroup.length > 0) {
          return json({ ok: true, duplicated: true, smsSent: false });
        }
      }
    } else {
      const { data: existingNotification } = await admin
        .from("sitter_notifications")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("kind", "booking_request")
        .maybeSingle();
      if (existingNotification) {
        return json({ ok: true, duplicated: true, smsSent: false });
      }
    }

    const [{ data: customerProfile }, { data: sitterProfile }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", booking.customer_id).maybeSingle(),
      admin.from("profiles").select("full_name, mobile_phone, phone").eq("id", booking.sitter_id).maybeSingle(),
    ]);

    const customerName = customerProfile?.full_name?.trim() || "A client";
    const sitterName = sitterProfile?.full_name?.trim() || "Anneke";
    const petName = booking.pets?.name || "a pet";
    const serviceName = booking.services?.name || "a service";
    const timing = formatRequestTiming(booking);
    const notificationTitle = "New booking request";
    const totalCount = bookingCount && bookingCount > 1 ? bookingCount : 1;
    const notificationMessage = totalCount > 1
      ? `${customerName} submitted ${totalCount} requests starting with ${serviceName} for ${petName} (${timing}).`
      : `${customerName} requested ${serviceName} for ${petName} (${timing}).`;

    const { error: insertError } = await admin.from("sitter_notifications").insert({
      user_id: booking.sitter_id,
      kind: "booking_request",
      title: notificationTitle,
      message: notificationMessage,
      booking_id: booking.id,
      metadata: {
        customerName,
        sitterName,
        petName,
        serviceName,
        timing,
        requestGroupId: groupId,
        bookingCount: totalCount,
      },
    });

    if (insertError) {
      return json({ error: insertError.message }, 400);
    }

    const sitterPhone = sitterProfile?.mobile_phone || sitterProfile?.phone;
    if (!sitterPhone) {
      return json({ ok: true, smsSent: false, reason: "Sitter phone number is missing" });
    }

    const appUrl = Deno.env.get("APP_URL") ?? "https://yodawg.ca";
    const reviewUrl = `${appUrl.replace(/\/+$/, "")}/sitter/requests/${booking.id}`;
    const smsBody = totalCount > 1
      ? `YoDawg: New request from ${customerName} (${totalCount} bookings) starting with ${serviceName} for ${petName} · ${timing}. Review: ${reviewUrl}`
      : `YoDawg: New request from ${customerName} for ${petName} · ${serviceName} · ${timing}. Review: ${reviewUrl}`;
    const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: toE164(sitterPhone),
        From: toE164(twilioFromNumber),
        Body: smsBody,
      }),
    });

    const twilioData = await twilioResponse.json();
    if (!twilioResponse.ok) {
      console.error("notify-new-booking-request sms error", {
        status: twilioResponse.status,
        twilioData,
        bookingId,
      });
      return json({
        ok: true,
        smsSent: false,
        smsError: `Twilio API error [${twilioResponse.status}]`,
      });
    }

    return json({ ok: true, smsSent: true });
  } catch (error) {
    console.error("notify-new-booking-request error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ ok: false, error: message }, 500);
  }
});