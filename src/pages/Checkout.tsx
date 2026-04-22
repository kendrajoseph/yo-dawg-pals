import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { BookingCheckout } from "@/components/BookingCheckout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
  services: { name: string; slug: string; payment_mode: "full" | "deposit" | "free" } | null;
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
        .select("id, status, booking_kind, requested_date, requested_window_label, scheduled_start_at, start_at, payment_amount_cents, total_cents, services(name, slug, payment_mode), pets(name)")
        .eq("id", id)
        .single();
      setBooking((data as Booking) ?? null);
      setLoadingBooking(false);
    })();
  }, [db, id, user]);

  useEffect(() => {
    if (!booking || confirming) return;
    if (booking.services?.payment_mode === "free" && booking.status === "pending_payment") {
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
                ? "Anneke is still locking in the exact timing. You'll get a payment prompt once everything is set."
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
  const isApprovedGroupWalk = booking.status === "awaiting_payment";

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <span className="inline-block -rotate-2 font-tag text-2xl text-tag">last step</span>
        <h1 className="font-display text-5xl text-primary sm:text-6xl spray-glow">
          Pay & <span className="text-gradient-sunrise">confirm.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground/75">
          {isApprovedGroupWalk
            ? "Anneke has set the exact walk time and matched the group — this payment locks it in."
            : "Secure payment keeps your booking moving and lands the final confirmation in your account."}
        </p>

        <Card className="mt-6 border-4 border-primary p-5 shadow-pop sm:p-6">
          <dl className="divide-y-2 divide-primary/15 border-2 border-primary bg-card text-sm">
            <div className="flex items-center justify-between p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Service</dt>
              <dd className="font-display text-base uppercase">{booking.services?.name}</dd>
            </div>
            <div className="flex items-center justify-between p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">When</dt>
              <dd className="font-display text-base uppercase">{formatBookingSchedule(booking)}</dd>
            </div>
            <div className="flex items-center justify-between p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">For</dt>
              <dd className="font-display text-base uppercase">{booking.pets?.name}</dd>
            </div>
            <div className="flex items-center justify-between bg-highlight p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Due now</dt>
              <dd className="font-display text-lg uppercase text-clay">{formatPriceWithDecimals(due)}</dd>
            </div>
          </dl>
        </Card>

        <div className="mt-6">
          <BookingCheckout
            bookingId={booking.id}
            returnUrl={`${window.location.origin}/booking/${booking.id}/success?session_id={CHECKOUT_SESSION_ID}`}
          />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Payments are processed securely. Free cancellation up to 24h before your service unless otherwise noted.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
};

export default Checkout;
