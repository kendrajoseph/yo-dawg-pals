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
import { formatBookingDateTime, formatPriceWithDecimals } from "@/lib/booking";

type B = {
  id: string;
  status: string;
  start_at: string;
  payment_amount_cents: number | null;
  total_cents: number;
  services: { name: string; payment_mode: "full" | "deposit" | "free" } | null;
  pets: { name: string } | null;
};

const Checkout = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [booking, setBooking] = useState<B | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, status, start_at, payment_amount_cents, total_cents, services(name, payment_mode), pets(name)")
        .eq("id", id)
        .single();
      setBooking((data as unknown as B) ?? null);
      setLoadingBooking(false);
    })();
  }, [id, user]);

  // Free service path — call the edge function which will mark it confirmed,
  // then redirect to success.
  useEffect(() => {
    if (!booking || confirming) return;
    if (booking.services?.payment_mode === "free" && booking.status === "pending_payment") {
      setConfirming(true);
      (async () => {
        await supabase.functions.invoke("create-checkout", {
          body: { bookingId: booking.id, environment: import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN?.startsWith("pk_test_") ? "sandbox" : "live" },
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

  if (booking.status !== "pending_payment") {
    return (
      <main className="min-h-screen bg-background texture-grain">
        <SiteNav />
        <section className="mx-auto max-w-xl px-5 py-20 text-center">
          <Card className="border-4 border-primary p-8 shadow-pop">
            <p className="font-tag text-2xl text-clay">This booking is already {booking.status}.</p>
            <Button asChild className="mt-4 font-display uppercase">
              <Link to={`/booking/${booking.id}/success`}>View details</Link>
            </Button>
          </Card>
        </section>
        <SiteFooter />
      </main>
    );
  }

  const due = booking.payment_amount_cents ?? 0;

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <span className="font-tag text-2xl text-tag -rotate-2 inline-block">last step</span>
        <h1 className="font-display text-5xl text-primary sm:text-6xl spray-glow">
          Pay & <span className="text-gradient-spray">confirm.</span>
        </h1>

        <Card className="mt-6 border-4 border-primary p-5 shadow-pop sm:p-6">
          <dl className="divide-y-2 divide-primary/15 border-2 border-primary bg-card text-sm">
            <div className="flex items-center justify-between p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Service</dt>
              <dd className="font-display text-base uppercase">{booking.services?.name}</dd>
            </div>
            <div className="flex items-center justify-between p-3">
              <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">When</dt>
              <dd className="font-display text-base uppercase">{formatBookingDateTime(booking.start_at)}</dd>
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
          Payments are processed securely by Stripe. Free cancellation up to 24h before your service.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
};

export default Checkout;
