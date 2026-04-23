import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const notificationResponse = (
  ok: boolean,
  notificationStatus: "sent" | "skipped" | "failed",
  notificationType: "confirmation_email" | "payment_alert",
  notificationMessage: string,
  attemptNumber?: number,
  retryAvailable?: boolean,
  status = 200,
) =>
  json(
    {
      ok,
      notificationStatus,
      notificationType,
      notificationMessage,
      attemptNumber,
      retryAvailable,
    },
    status,
  );

type NotificationType = "confirmation_email" | "payment_alert";
type TriggerSource = "approval" | "retry";
type NotificationStatus = "sent" | "skipped" | "failed";

const getNotificationConfig = (
  booking: any,
  notificationType: NotificationType,
  customerName: string,
  customerEmail: string | undefined,
  scheduledStartAt: string | null | undefined,
  groupLabel: string | null | undefined,
  appUrl: string,
) => {
  if (notificationType === "confirmation_email") {
    return {
      templateName: "walk-schedule-confirmed",
      recipientEmail: customerEmail,
      idempotencyKeyPrefix: "solo-confirmed",
      defaultMissingEmailMessage: "Client email was skipped because no email address is on file.",
      defaultSuccessMessage: "Confirmation email sent to the client.",
      defaultFailureTitle: "confirmation_email" as const,
      templateData: {
        customerName,
        serviceName: booking.services?.name || "Solo Walk",
        petName: booking.pets?.name || "your dog",
        scheduledStartAt,
      },
    };
  }

  return {
    templateName: "group-walk-payment-request",
    recipientEmail: customerEmail,
    idempotencyKeyPrefix: "group-payment",
    defaultMissingEmailMessage: "Client payment alert was skipped because no email address is on file.",
    defaultSuccessMessage: "Payment alert sent to the client.",
    defaultFailureTitle: "payment_alert" as const,
    templateData: {
      customerName,
      serviceName: booking.services?.name || "Group Walk",
      petName: booking.pets?.name || "your dog",
      scheduledStartAt,
      groupLabel: groupLabel || "your matched group",
      payUrl: `${appUrl}/booking/${booking.id}/checkout`,
    },
  };
};

const recordNotificationAttempt = async ({
  bookingId,
  notificationType,
  triggerSource,
  status,
  message,
  errorMessage,
  attemptedBy,
}: {
  bookingId: string;
  notificationType: NotificationType;
  triggerSource: TriggerSource;
  status: NotificationStatus;
  message: string;
  errorMessage?: string | null;
  attemptedBy?: string | null;
}) => {
  const { data: latestAttempt } = await supabase
    .from("booking_notification_attempts")
    .select("attempt_number")
    .eq("booking_id", bookingId)
    .eq("notification_type", notificationType)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const attemptNumber = (latestAttempt?.attempt_number ?? 0) + 1;

  const { error } = await supabase.from("booking_notification_attempts").insert({
    booking_id: bookingId,
    notification_type: notificationType,
    trigger_source: triggerSource,
    attempt_number: attemptNumber,
    status,
    message,
    error_message: errorMessage ?? null,
    attempted_by: attemptedBy ?? null,
  });

  if (error) {
    console.error("Failed to record notification attempt", error);
  }

  return attemptNumber;
};

const sendClientNotification = async ({
  booking,
  notificationType,
  triggerSource,
  customerName,
  customerEmail,
  scheduledStartAt,
  groupLabel,
  appUrl,
  attemptedBy,
}: {
  booking: any;
  notificationType: NotificationType;
  triggerSource: TriggerSource;
  customerName: string;
  customerEmail?: string;
  scheduledStartAt?: string | null;
  groupLabel?: string | null;
  appUrl: string;
  attemptedBy?: string;
}) => {
  const config = getNotificationConfig(
    booking,
    notificationType,
    customerName,
    customerEmail,
    scheduledStartAt,
    groupLabel,
    appUrl,
  );

  if (!config.recipientEmail) {
    const attemptNumber = await recordNotificationAttempt({
      bookingId: booking.id,
      notificationType,
      triggerSource,
      status: "skipped",
      message: config.defaultMissingEmailMessage,
      attemptedBy,
    });

    return notificationResponse(true, "skipped", notificationType, config.defaultMissingEmailMessage, attemptNumber, false);
  }

  const emailResult = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: config.templateName,
      recipientEmail: config.recipientEmail,
      idempotencyKey: `${config.idempotencyKeyPrefix}-${booking.id}-${triggerSource}-${Date.now()}`,
      templateData: config.templateData,
    },
  });

  if (emailResult.error) {
    const message = notificationType === "confirmation_email"
      ? `Request confirmed, but the confirmation email failed to send: ${emailResult.error.message}`
      : `Payment opened, but the client payment alert failed to send: ${emailResult.error.message}`;
    const attemptNumber = await recordNotificationAttempt({
      bookingId: booking.id,
      notificationType,
      triggerSource,
      status: "failed",
      message,
      errorMessage: emailResult.error.message,
      attemptedBy,
    });

    return notificationResponse(true, "failed", notificationType, message, attemptNumber, true);
  }

  const emailData = emailResult.data as { success?: boolean; reason?: string } | null;
  if (emailData?.success === false) {
    const message = emailData.reason === "email_suppressed"
      ? "This client email was skipped because the address is unsubscribed or suppressed."
      : "The client notification was skipped and no email was sent.";
    const attemptNumber = await recordNotificationAttempt({
      bookingId: booking.id,
      notificationType,
      triggerSource,
      status: "skipped",
      message,
      errorMessage: emailData.reason ?? null,
      attemptedBy,
    });

    return notificationResponse(true, "skipped", notificationType, message, attemptNumber, false);
  }

  const attemptNumber = await recordNotificationAttempt({
    bookingId: booking.id,
    notificationType,
    triggerSource,
    status: "sent",
    message: config.defaultSuccessMessage,
    attemptedBy,
  });

  return notificationResponse(true, "sent", notificationType, config.defaultSuccessMessage, attemptNumber, false);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const { data: authData, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { action, bookingId, scheduledStartAt, scheduledEndAt, groupLabel, internalNotes, appUrl } = await req.json();
    if (!action || !bookingId) return json({ error: "Missing action or bookingId" }, 400);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, customer_id, sitter_id, status, payment_amount_cents, scheduled_start_at, group_assignment_label, services(name, slug), pets(name)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) return json({ error: "Booking not found" }, 404);

    const isSitter = booking.sitter_id === authData.user.id;
    const isCustomer = booking.customer_id === authData.user.id;
    if (!isSitter && !isCustomer) return json({ error: "Forbidden" }, 403);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", booking.customer_id)
      .maybeSingle();
    const { data: customerAuth } = await supabase.auth.admin.getUserById(booking.customer_id);
    const customerEmail = customerAuth.user?.email;
    const customerName = profile?.full_name || customerEmail || "there";

    const resolvedAppUrl = appUrl || req.headers.get("origin") || "";

    if (action === "request_received") {
      if (!isCustomer) return json({ error: "Forbidden" }, 403);
      if (!customerEmail) return json({ error: "Missing customer email" }, 400);

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "walk-request-received",
          recipientEmail: customerEmail,
          idempotencyKey: `walk-request-${bookingId}`,
          templateData: {
            customerName,
            serviceName: booking.services?.name || "Walk",
            petName: booking.pets?.name || "your dog",
          },
        },
      });
      return json({ ok: true });
    }

    if (!isSitter) return json({ error: "Forbidden" }, 403);

    const retryTypeByAction: Record<string, NotificationType> = {
      retry_confirmation_email: "confirmation_email",
      retry_payment_alert: "payment_alert",
    };

    if (action in retryTypeByAction) {
      const notificationType = retryTypeByAction[action];

      if (notificationType === "confirmation_email" && booking.status !== "confirmed") {
        return json({ error: "Booking must be confirmed before retrying confirmation email" }, 400);
      }

      if (notificationType === "payment_alert" && booking.status !== "awaiting_payment") {
        return json({ error: "Booking must be awaiting payment before retrying payment alert" }, 400);
      }

      return await sendClientNotification({
        booking,
        notificationType,
        triggerSource: "retry",
        customerName,
        customerEmail,
        scheduledStartAt: booking.scheduled_start_at,
        groupLabel: booking.group_assignment_label,
        appUrl: resolvedAppUrl,
        attemptedBy: authData.user.id,
      });
    }

    if (!scheduledStartAt || !scheduledEndAt) return json({ error: "Missing scheduled time" }, 400);

    const commonPatch = {
      scheduled_start_at: scheduledStartAt,
      scheduled_end_at: scheduledEndAt,
      approved_at: new Date().toISOString(),
      approved_by: authData.user.id,
      group_assignment_label: groupLabel || null,
      internal_notes: internalNotes || null,
    };

    if (action === "schedule_solo_walk") {
      const { error } = await supabase
        .from("bookings")
        .update({ ...commonPatch, status: "confirmed" })
        .eq("id", bookingId);
      if (error) return json({ error: error.message }, 400);

      return await sendClientNotification({
        booking: { ...booking, scheduled_start_at: scheduledStartAt },
        notificationType: "confirmation_email",
        triggerSource: "approval",
        customerName,
        customerEmail,
        scheduledStartAt,
        groupLabel,
        appUrl: resolvedAppUrl,
        attemptedBy: authData.user.id,
      });
    }

    if (action === "approve_group_walk") {
      const { error } = await supabase
        .from("bookings")
        .update({ ...commonPatch, status: "awaiting_payment" })
        .eq("id", bookingId);
      if (error) return json({ error: error.message }, 400);

      return await sendClientNotification({
        booking: { ...booking, scheduled_start_at: scheduledStartAt, group_assignment_label: groupLabel },
        notificationType: "payment_alert",
        triggerSource: "approval",
        customerName,
        customerEmail,
        scheduledStartAt,
        groupLabel,
        appUrl: resolvedAppUrl,
        attemptedBy: authData.user.id,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("booking-workflow error", error);
    return json({ error: (error as Error).message }, 500);
  }
});
