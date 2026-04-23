export type AssistantServiceContext = {
  id: string;
  name: string;
  slug: string;
  duration_minutes: number;
  payment_mode: "full" | "deposit" | "free";
  scheduling_mode: "instant" | "request" | "boarding";
  requires_pet_approval: boolean;
  approval_required: boolean;
};

export type AssistantAvailabilityContext = {
  id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  max_bookings: number;
  service_slugs: string[];
};

export type AssistantWalkWindowContext = {
  id: string;
  service_slug: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  window_label: string;
  max_bookings: number;
};

export type AssistantBlockedDateContext = {
  id: string;
  blocked_date: string;
  reason: string | null;
};

export type AssistantRequestBookingContext = {
  id: string;
  status: string;
  service_slug: string | null;
  service_name: string | null;
  pet_name: string | null;
  customer_name: string;
  booking_kind: string | null;
  requested_date: string | null;
  requested_end_date: string | null;
  requested_window_label: string | null;
  requested_window_start_minute: number | null;
  requested_window_end_minute: number | null;
  recurrence_label: string | null;
  request_group_id: string | null;
  request_group_label: string | null;
};

export type AssistantRequestGroupContext = {
  id: string;
  label: string;
  bookings: AssistantRequestBookingContext[];
};

export type AssistantDashboardContext = {
  today: string;
  services: AssistantServiceContext[];
  availability: AssistantAvailabilityContext[];
  walkWindows: AssistantWalkWindowContext[];
  blockedDates: AssistantBlockedDateContext[];
  requestGroups: AssistantRequestGroupContext[];
};

export type AssistantOperation =
  | {
      type: "create_availability_blocks";
      summary: string;
      blocks: Array<{
        weekday: number;
        startMinute: number;
        endMinute: number;
        maxBookings?: number;
        serviceSlugs: string[];
      }>;
    }
  | {
      type: "update_walk_windows";
      summary: string;
      windows: Array<{
        mode: "upsert" | "delete";
        weekday: number;
        serviceSlug: string;
        label: string;
        startMinute?: number;
        endMinute?: number;
        maxBookings?: number;
      }>;
    }
  | {
      type: "add_blocked_dates";
      summary: string;
      entries: Array<{
        date: string;
        reason?: string | null;
      }>;
    }
  | {
      type: "approve_requests";
      summary: string;
      decision: "approve" | "decline";
      filters: {
        statuses?: string[];
        serviceSlugs?: string[];
        requestGroupLabel?: string | null;
        customerName?: string | null;
        bookingIds?: string[];
        relativeWindow?: "recent" | "today" | "all";
      };
    }
  | {
      type: "send_preview_notifications";
      summary: string;
      bookingIds: string[];
    };

export type AssistantPlanResponse = {
  summary: string;
  intent: string;
  confidence: "low" | "medium" | "high";
  warnings: string[];
  followUpQuestions: string[];
  operations: AssistantOperation[];
};

export type AssistantNotificationPreview = {
  bookingId: string;
  recipientName: string;
  recipientEmail: string;
  serviceName: string;
  petName: string;
  templateName: "walk-schedule-confirmed" | "group-walk-payment-request";
  statusAfter: "confirmed" | "awaiting_payment";
  scheduledStartAt: string;
  groupLabel?: string | null;
  payUrl?: string | null;
};

export type AssistantExecutionResponse = {
  ok: boolean;
  summary: string;
  warnings: string[];
  followUpQuestions: string[];
  applied: Array<{ type: string; count: number }>;
  notificationPreview: AssistantNotificationPreview[];
};

export const weekdayLabel = (weekday: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday] ?? "Day";

export const formatMinuteLabel = (minute: number) => {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 || 12;
  return `${normalizedHour}:${String(mins).padStart(2, "0")} ${suffix}`;
};