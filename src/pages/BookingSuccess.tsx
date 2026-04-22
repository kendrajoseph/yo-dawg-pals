import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, PawPrint } from "lucide-react";
import { formatBookingSchedule, formatPriceWithDecimals, STATUS_LABELS } from "@/lib/booking";

type Booking = {
  id: string;
  status: string;
  total_cents: number;
  deposit_cents: number;
  payment_amount_cents: number | null;
  notes: string | null;
  booking_kind?: string | null;
  requested_date?: string | null;
  requested_window_label?: string | null;
  scheduled_start_at?: string | null;
  start_at: string;
  services: { name: string; slug: string } | null;
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
        .select("id, status, total_cents, deposit_cents, payment_amount_cents, notes, booking_kind, requested_date, requested_window_label, scheduled_start_at, start_at, services(name, slug), pets(name)")
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

  const getHeadline = () => {
    if (!booking) return "";
    if (waitingForWebhook) return "Confirming…";
    if (booking.status === "requested") return "Request received!";
    if (booking.status === "awaiting_payment") return "Schedule ready.";
    if (booking.status === "confirmed") return booking.booking_kind === "requested" ? "Walk confirmed!" : "Booking confirmed!";
    return STATUS_LABELS[booking.status] ?? booking.status;
  };

  const getBodyCopy = () => {
    if (!booking) return "";
    if (waitingForWebhook) return "Hang tight while payment finalises.";
    if (booking.status === "requested") {
      return booking.services?.slug === "group-walk"
        ? "Anneke will review compatibility, set the exact timing, and send payment once the group is ready."
        : "Your request is paid and queued. Anneke will confirm the exact solo walk time shortly.";
    }
    if (booking.status === "awaiting_payment") {
      return "Anneke has set the exact time. As soon as payment comes through, you're fully confirmed.";
    }
    if (booking.status === "confirmed") return "Everything is locked in and ready to go.";
    return `Status: ${STATUS_LABELS[booking.status] ?? booking.status}.`;
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-20">
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
              <span className="font-display uppercase">{booking.services?.name}</span> for <span className="font-tag text-xl text-clay">{booking.pets?.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">{formatBookingSchedule(booking)}</p>

            <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
              <div className="border-2 border-primary bg-card p-3">
                <div className="font-display text-xs uppercase text-muted-foreground">Total</div>
                <div className="font-display text-2xl">{formatPriceWithDecimals(booking.total_cents)}</div>
              </div>
              <div className="border-2 border-primary bg-highlight p-3">
                <div className="font-display text-xs uppercase">
                  {booking.payment_amount_cents ? "Paid / due now" : booking.status === "requested" ? "Payment" : "Status"}
                </div>
                <div className="font-display text-2xl text-clay">
                  {booking.payment_amount_cents
                    ? formatPriceWithDecimals(booking.payment_amount_cents ?? booking.deposit_cents)
                    : booking.status === "requested"
                    ? booking.services?.slug === "group-walk"
                      ? "No payment yet"
                      : "Paid"
                    : STATUS_LABELS[booking.status] ?? booking.status}
                </div>
              </div>
            </div>

            <div className="mt-6 border-2 border-dashed border-primary/40 bg-muted p-3 text-left text-xs text-muted-foreground">
              <span className="font-display uppercase text-foreground">Next step:</span> {getBodyCopy()}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild className="bg-primary font-display uppercase shadow-pop-accent">
                <Link to="/account">View my bookings</Link>
              </Button>
              <Button asChild variant="outline" className="border-2 border-primary font-display uppercase">
                <Link to="/account/pets"><PawPrint className="h-4 w-4" /> My pets</Link>
              </Button>
            </div>
          </Card>
        )}
      </section>
      <SiteFooter />
    </main>
  );
};

export default BookingSuccess;
