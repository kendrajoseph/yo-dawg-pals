import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { BookingCheckout } from "@/components/BookingCheckout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { formatBookingSchedule, formatPriceWithDecimals, STATUS_LABELS } from "@/lib/booking";
import { getStripeEnvironment } from "@/lib/stripe";

type Booking = {
  id: string;
  status: string;
  booking_kind?: string | null;
  requested_date?: string | null;
  requested_window_label?: string | null;
  scheduled_start_at?: string | null;
  start_at: string;
  payment_amount_cents: number | null;
  total_cents: number;
  extra_time_fee_cents: number;
  late_pickup_fee_cents: number;
  services: { name: string; slug: string; payment_mode: "full" | "deposit" | "free" } | null;
  service_variants: { name: string; payment_mode: "full" | "deposit" | "free" } | null;
  pets: { name: string } | null;
};

const PAYABLE_STATUSES = ["pending_payment", "awaiting_payment"];

const Checkout = () => {
  const db = supabase as any;
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data } = await db
        .from("bookings")
        .select("id, status, booking_kind, requested_date, requested_window_label, scheduled_start_at, start_at, payment_amount_cents, total_cents, extra_time_fee_cents, late_pickup_fee_cents, services(name, slug, payment_mode), service_variants(name, payment_mode), pets(name)")
        .eq("id", id)
        .single();
      setBooking((data as Booking) ?? null);
      setLoadingBooking(false);
    })();
  }, [db, id, user]);

  useEffect(() => {
    if (!booking || confirming) return;
    if (booking.service_variants?.payment_mode === "free" && ["pending_payment", "awaiting_payment"].includes(booking.status)) {
      setConfirming(true);
      (async () => {
        await supabase.functions.invoke("create-checkout", {
          body: { bookingId: booking.id, environment: getStripeEnvironment() },
        });
        window.location.href = `/booking/${booking.id}/success`;
      })();
    }
  }, [booking, confirming]);

  if (loading || loadingBooking) {
    return (
      <main className="min-h-screen bg-background">
        <SiteNav />
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-clay" />
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="min-h-screen bg-background texture-grain">
        <SiteNav />
        <section className="mx-auto max-w-xl px-5 py-20 text-center">
          <Card className="border-4 border-primary p-8 shadow-pop">
            <p className="font-tag text-2xl text-clay">Booking not found.</p>
            <Button asChild className="mt-4"><Link to="/account">Back to account</Link></Button>
          </Card>
        </section>
        <SiteFooter />
      </main>
    );
  }

  if (!PAYABLE_STATUSES.includes(booking.status)) {
    return (
      <main className="min-h-screen bg-background texture-grain">
        <SiteNav />
        <section className="mx-auto max-w-xl px-5 py-20 text-center">
          <Card className="border-4 border-primary p-8 shadow-pop">
            <p className="font-tag text-2xl text-clay">
              {booking.status === "requested" ? "This request isn't ready for payment yet." : `This booking is already ${STATUS_LABELS[booking.status] ?? booking.status}.`}
            </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {booking.status === "requested"
                  ? "Your request is still being reviewed. Payment opens once it is approved."
                  : "You can see the latest details in your account."}
              </p>
            <Button asChild className="mt-4 font-display uppercase">
              <Link to="/account">Back to account</Link>
            </Button>
          </Card>
        </section>
        <SiteFooter />
      </main>
    );
  }

  const due = booking.payment_amount_cents ?? 0;
  const displayName = booking.service_variants?.name ?? booking.services?.name;

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to account
        </Link>
        <span className="mt-3 inline-block -rotate-2 font-tag text-2xl text-tag">last step</span>
        <h1 className="font-display text-5xl text-primary sm:text-6xl spray-glow">
          Pay & <span className="text-gradient-sunrise">confirm.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground/75">
          Your request has been reviewed and the details below are now ready for payment.
        </p>

        <Card className="mt-6 border-4 border-primary p-5 shadow-pop sm:p-6">
          <dl className="divide-y-2 divide-primary/15 border-2 border-primary bg-card text-sm">
            <div className="flex items-center justify-between p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Service</dt>
              <dd className="font-display text-base uppercase">{displayName}</dd>
            </div>
            <div className="flex items-center justify-between p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">When</dt>
              <dd className="font-display text-right text-base uppercase">{formatBookingSchedule(booking)}</dd>
            </div>
            <div className="flex items-center justify-between p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">For</dt>
              <dd className="font-display text-base uppercase">{booking.pets?.name}</dd>
            </div>
            {booking.extra_time_fee_cents > 0 && (
              <div className="flex items-center justify-between p-3">
                <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Extra time</dt>
                <dd className="font-display text-base uppercase">{formatPriceWithDecimals(booking.extra_time_fee_cents)}</dd>
              </div>
            )}
            {booking.late_pickup_fee_cents > 0 && (
              <div className="flex items-center justify-between p-3">
                <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Late pickup</dt>
                <dd className="font-display text-base uppercase">{formatPriceWithDecimals(booking.late_pickup_fee_cents)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Total</dt>
              <dd className="font-display text-base uppercase">{formatPriceWithDecimals(booking.total_cents)}</dd>
            </div>
            <div className="flex items-center justify-between bg-highlight p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Due now</dt>
              <dd className="font-display text-lg uppercase text-clay">{formatPriceWithDecimals(due)}</dd>
            </div>
          </dl>
        </Card>

        <div className="mt-6">
          <BookingCheckout bookingId={booking.id} returnUrl={`${window.location.origin}/booking/${booking.id}/success?session_id={CHECKOUT_SESSION_ID}`} />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">Payments are processed securely. Any approved extra time or late pickup fees are already included above.</p>
      </section>
      <SiteFooter />
    </main>
  );
};

export default Checkout;
