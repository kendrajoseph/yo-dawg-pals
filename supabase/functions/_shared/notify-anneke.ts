// Sends a "new paid booking" notification email to Anneke for a confirmed booking.
// Safe to call after status transitions to "confirmed". Failures are logged but never thrown.
import { createClient } from "npm:@supabase/supabase-js@2";

const formatMoney = (cents?: number | null) => {
  if (cents == null) return "";
  return `$${(cents / 100).toFixed(2)} CAD`;
};

export async function notifyAnnekeOfPaidBooking(bookingId: string) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        "id, customer_id, start_at, end_at, notes, payment_amount_cents, total_cents, services(name, payment_mode), pets(name)"
      )
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      console.warn("notifyAnnekeOfPaidBooking: booking not found", { bookingId, error });
      return;
    }

    // Customer profile + auth email
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", (booking as any).customer_id)
        .maybeSingle(),
      supabase.auth.admin.getUserById((booking as any).customer_id),
    ]);

    const service = (booking as any).services;
    const pet = (booking as any).pets;

    const paymentMode = service?.payment_mode ?? "deposit";
    const paymentTypeLabel =
      paymentMode === "free"
        ? "Free Meet & Greet"
        : paymentMode === "full"
        ? "Paid in full"
        : "Deposit";

    const amountPaid =
      paymentMode === "free"
        ? "$0.00 CAD"
        : formatMoney((booking as any).payment_amount_cents);

    const templateData = {
      customerName: profile?.full_name || authUser?.user?.email || "A customer",
      customerEmail: authUser?.user?.email || "",
      customerPhone: profile?.phone || "",
      petName: pet?.name || "their pet",
      serviceName: service?.name || "a service",
      startAt: (booking as any).start_at,
      endAt: (booking as any).end_at,
      amountPaid,
      paymentType: paymentTypeLabel,
      notes: (booking as any).notes || "",
      bookingId: (booking as any).id,
    };

    const res = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "booking-paid-notification",
        recipientEmail: "anneke@yodawg.ca",
        idempotencyKey: `booking-paid-notify-${bookingId}`,
        templateData,
      },
    });

    if (res.error) {
      console.warn("notifyAnnekeOfPaidBooking: send failed", { bookingId, error: res.error });
    } else {
      console.log("notifyAnnekeOfPaidBooking: enqueued", { bookingId });
    }
  } catch (e) {
    console.error("notifyAnnekeOfPaidBooking: unexpected error", { bookingId, error: e });
  }
}
