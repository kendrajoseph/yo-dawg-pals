// Shared booking helpers
export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

export const formatPriceWithDecimals = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const minutesToTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const timeToMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const formatBookingDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const formatRequestedDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export const formatBookingSchedule = (booking: {
  booking_kind?: string | null;
  requested_date?: string | null;
  requested_end_date?: string | null;
  requested_window_label?: string | null;
  requested_window_start_minute?: number | null;
  requested_window_end_minute?: number | null;
  recurrence_label?: string | null;
  request_group_label?: string | null;
  scheduled_start_at?: string | null;
  start_at?: string | null;
}) => {
  if (booking.booking_kind === "requested" && !booking.scheduled_start_at) {
    const requestedTimeSlot =
      booking.requested_window_start_minute != null && booking.requested_window_end_minute != null
        ? `${minutesToTime(booking.requested_window_start_minute)}–${minutesToTime(booking.requested_window_end_minute)}`
        : null;

    const parts = [
      booking.requested_date ? formatRequestedDate(booking.requested_date) : null,
      booking.requested_end_date && booking.requested_end_date !== booking.requested_date
        ? `to ${formatRequestedDate(booking.requested_end_date)}`
        : null,
      booking.requested_window_label
        ? requestedTimeSlot
          ? `${booking.requested_window_label} · ${requestedTimeSlot}`
          : booking.requested_window_label
        : requestedTimeSlot,
      booking.recurrence_label,
      booking.request_group_label,
    ].filter(Boolean);

    return parts.length ? parts.join(" · ") : "Scheduling in progress";
  }

  const when = booking.scheduled_start_at ?? booking.start_at;
  return when ? formatBookingDateTime(when) : "Scheduling in progress";
};

export const STATUS_STYLES: Record<string, string> = {
  requested: "bg-accent text-accent-foreground",
  pending_payment: "bg-highlight text-highlight-foreground",
  awaiting_payment: "bg-electric text-electric-foreground",
  confirmed: "bg-secondary text-secondary-foreground",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-accent text-accent-foreground",
  refunded: "bg-clay text-clay-foreground",
};

export const STATUS_LABELS: Record<string, string> = {
  requested: "Request received",
  pending_payment: "Payment ready",
  awaiting_payment: "Payment ready",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  refunded: "Refunded",
};
