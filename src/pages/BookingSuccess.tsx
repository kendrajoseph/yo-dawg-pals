import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2, PawPrint } from "lucide-react";
import { formatBookingSchedule, formatPriceWithDecimals, STATUS_LABELS } from "@/lib/booking";

type Booking = {
  id: string;
  status: string;
  total_cents: number;
  deposit_cents: number;
  payment_amount_cents: number | null;
  extra_time_fee_cents: number;
  late_pickup_fee_cents: number;
  notes: string | null;
  booking_kind?: string | null;
  requested_date?: string | null;
  requested_window_label?: string | null;
  scheduled_start_at?: string | null;
  start_at: string;
  services: { name: string; slug: string; payment_mode?: string | null } | null;
  service_variants: { name: string; payment_mode?: string | null } | null;
  pets: { name: string } | null;
};

const BookingSuccess = () => {
  const db = supabase as any;
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    let attempts = 0;
    let intervalId: number | undefined;

    const fetchOnce = async () => {
      const { data } = await db
        .from("bookings")
        .select("id, status, total_cents, deposit_cents, payment_amount_cents, extra_time_fee_cents, late_pickup_fee_cents, notes, booking_kind, requested_date, requested_window_label, scheduled_start_at, start_at, services(name, slug, payment_mode), service_variants(name, payment_mode), pets(name)")
        .eq("id", id)
        .single();
      if (cancelled) return null;
      setBooking((data as Booking) ?? null);
      setLoading(false);
      return (data as Booking) ?? null;
    };

    (async () => {
      const initial = await fetchOnce();
      if (sessionId && initial && ["pending_payment", "awaiting_payment"].includes(initial.status)) {
        intervalId = window.setInterval(async () => {
          attempts += 1;
          const next = await fetchOnce();
          if (!next || !["pending_payment", "awaiting_payment"].includes(next.status) || attempts >= 10) {
            if (intervalId) window.clearInterval(intervalId);
          }
        }, 1500);
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [db, id, sessionId, user]);

  const waitingForWebhook = !!sessionId && ["pending_payment", "awaiting_payment"].includes(booking?.status ?? "");
  const paymentMode = booking?.service_variants?.payment_mode ?? booking?.services?.payment_mode ?? null;
  const isFreeService = paymentMode === "free";
  const showPaymentBox = !!booking && !isFreeService;
  const showNextStepBox = !!booking && !isFreeService;

  const getPaymentHeading = () => {
    if (!booking) return "Payment";
    if (booking.status === "requested") return "Payment";
    if (booking.payment_amount_cents != null) return "Paid / due now";
    return "Status";
  };

  const getPaymentValue = () => {
    if (!booking) return "";
    if (booking.status === "requested") return "Pending approval";
    if (booking.payment_amount_cents != null) {
      return formatPriceWithDecimals(booking.payment_amount_cents ?? booking.deposit_cents);
    }

    return STATUS_LABELS[booking.status] ?? booking.status;
  };

  const getHeadline = () => {
    if (!booking) return "";
    if (waitingForWebhook) return "Confirming…";
    if (booking.status === "requested") return "Request received!";
    if (booking.status === "awaiting_payment") return "Schedule ready.";
    if (booking.status === "confirmed") return booking.booking_kind === "requested" ? "Request confirmed!" : "Booking confirmed!";
    return STATUS_LABELS[booking.status] ?? booking.status;
  };

  const getBodyCopy = () => {
    if (!booking) return "";
    if (waitingForWebhook) return "Hang tight while payment finalises.";
    if (booking.status === "requested") return "Thank you for your request — we’ll be in touch soon.";
    if (booking.status === "awaiting_payment" || booking.status === "pending_payment") return "Anneke has approved the match and confirmed the final time. Payment is the last step before it is fully locked in.";
    if (booking.status === "confirmed") return "Everything is locked in and ready to go.";
    return `Status: ${STATUS_LABELS[booking.status] ?? booking.status}.`;
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-20">
        <Link to="/account" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to account
        </Link>
        {loading ? (
          <p className="text-center text-muted-foreground">Loading…</p>
        ) : !booking ? (
          <Card className="border-4 border-primary p-8 text-center shadow-pop">
            <p className="font-tag text-2xl text-clay">Booking not found.</p>
            <Button asChild className="mt-4"><Link to="/account">Go to account</Link></Button>
          </Card>
        ) : (
          <Card className="-rotate-1 border-4 border-primary p-8 text-center shadow-pop sm:p-12">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-secondary-foreground shadow-pop">
              {waitingForWebhook ? <Loader2 className="h-8 w-8 animate-spin" /> : <Check className="h-8 w-8" />}
            </div>
            <span className="mt-4 inline-block rotate-2 font-tag text-2xl text-clay">good boy.</span>
            <h1 className="mt-1 font-display text-4xl uppercase text-primary sm:text-5xl">{getHeadline()}</h1>
            <p className="mt-3 text-foreground/80">
              <span className="font-display uppercase">{booking.service_variants?.name ?? booking.services?.name}</span> for <span className="font-tag text-xl text-clay">{booking.pets?.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">{formatBookingSchedule(booking)}</p>

            <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
              <div className="border-2 border-primary bg-card p-3">
                <div className="font-display text-xs uppercase text-muted-foreground">Total</div>
                <div className="font-display text-2xl">{formatPriceWithDecimals(booking.total_cents)}</div>
              </div>
              {showPaymentBox && (
                <div className="border-2 border-primary bg-highlight p-3">
                  <div className="font-display text-xs uppercase">{getPaymentHeading()}</div>
                  <div className="font-display text-2xl text-clay">{getPaymentValue()}</div>
                </div>
              )}
              {(booking.extra_time_fee_cents > 0 || booking.late_pickup_fee_cents > 0) && (
                <div className="border-2 border-primary bg-card p-3 sm:col-span-2">
                  <div className="font-display text-xs uppercase text-muted-foreground">Approved fee adjustments</div>
                  <div className="mt-1 text-sm text-foreground/80">
                    {booking.extra_time_fee_cents > 0 ? `${formatPriceWithDecimals(booking.extra_time_fee_cents)} extra time` : ""}
                    {booking.extra_time_fee_cents > 0 && booking.late_pickup_fee_cents > 0 ? " · " : ""}
                    {booking.late_pickup_fee_cents > 0 ? `${formatPriceWithDecimals(booking.late_pickup_fee_cents)} late pickup` : ""}
                  </div>
                </div>
              )}
            </div>

            {showNextStepBox && (
              <div className="mt-6 border-2 border-dashed border-primary/40 bg-muted p-3 text-left text-xs text-muted-foreground">
                <span className="font-display uppercase text-foreground">Next step:</span> {getBodyCopy()}
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild className="bg-primary font-display uppercase shadow-pop-accent"><Link to="/account">View my bookings</Link></Button>
              <Button asChild variant="outline" className="border-2 border-primary font-display uppercase"><Link to="/account/pets"><PawPrint className="h-4 w-4" /> My pets</Link></Button>
            </div>
          </Card>
        )}
      </section>
      <SiteFooter />
    </main>
  );
};

export default BookingSuccess;
