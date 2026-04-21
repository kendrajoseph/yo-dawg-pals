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

export const STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-highlight text-highlight-foreground",
  confirmed: "bg-secondary text-secondary-foreground",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-accent text-accent-foreground",
  refunded: "bg-clay text-clay-foreground",
};

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting deposit",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  refunded: "Refunded",
};
