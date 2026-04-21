import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, PawPrint, Loader2 } from "lucide-react";
import { formatBookingDateTime, formatPriceWithDecimals, STATUS_LABELS } from "@/lib/booking";

type B = {
  id: string; status: string; total_cents: number; deposit_cents: number;
  payment_amount_cents: number | null;
  start_at: string; notes: string | null;
  services: { name: string } | null;
  pets: { name: string } | null;
};

const BookingSuccess = () => {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { user } = useAuth();
  const [booking, setBooking] = useState<B | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    let attempts = 0;

    const fetchOnce = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, status, total_cents, deposit_cents, payment_amount_cents, start_at, notes, services(name), pets(name)")
        .eq("id", id).single();
      if (cancelled) return null;
      setBooking((data as unknown as B) ?? null);
      setLoading(false);
      return data as unknown as B | null;
    };

    (async () => {
      const initial = await fetchOnce();
      if (sessionId && initial && initial.status === "pending_payment") {
        const interval = setInterval(async () => {
          attempts += 1;
          const b = await fetchOnce();
          if (!b || b.status !== "pending_payment" || attempts >= 10) {
            clearInterval(interval);
          }
        }, 1500);
      }
    })();

    return () => { cancelled = true; };
  }, [id, user, sessionId]);

  const waitingForWebhook = sessionId && booking?.status === "pending_payment";

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-2xl px-5 py-12 sm:px-6 sm:py-20">
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
            <span className="mt-4 inline-block font-tag text-2xl text-clay rotate-2">good boy.</span>
            <h1 className="mt-1 font-display text-4xl uppercase text-primary sm:text-5xl">
              {waitingForWebhook ? "Confirming…" : "Booking confirmed!"}
            </h1>
            <p className="mt-3 text-foreground/80">
              <span className="font-display uppercase">{booking.services?.name}</span> for{" "}
              <span className="font-tag text-xl text-clay">{booking.pets?.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">{formatBookingDateTime(booking.start_at)}</p>

            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="border-2 border-primary bg-card p-3">
                <div className="font-display text-xs uppercase text-muted-foreground">Total</div>
                <div className="font-display text-2xl">{formatPriceWithDecimals(booking.total_cents)}</div>
              </div>
              <div className="border-2 border-primary bg-highlight p-3">
                <div className="font-display text-xs uppercase">Paid</div>
                <div className="font-display text-2xl text-clay">
                  {formatPriceWithDecimals(booking.payment_amount_cents ?? booking.deposit_cents)}
                </div>
              </div>
            </div>

            <div className="mt-6 border-2 border-dashed border-primary/40 bg-muted p-3 text-left text-xs text-muted-foreground">
              <span className="font-display uppercase text-foreground">Status:</span>{" "}
              {STATUS_LABELS[booking.status] ?? booking.status}.
              {booking.status === "confirmed" && " A receipt has been emailed to you."}
              {waitingForWebhook && " Hang tight while we finalise your payment."}
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
