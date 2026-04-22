import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarPlus, ChevronRight, CreditCard, PawPrint, User, X } from "lucide-react";
import { formatBookingSchedule, formatPriceWithDecimals, STATUS_LABELS, STATUS_STYLES } from "@/lib/booking";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getStripeEnvironment } from "@/lib/stripe";

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  total_cents: number;
  deposit_cents: number;
  payment_amount_cents: number | null;
  notes: string | null;
  booking_kind?: string | null;
  requested_date?: string | null;
  requested_window_label?: string | null;
  scheduled_start_at?: string | null;
  services: { name: string; slug: string } | null;
  pets: { name: string } | null;
};

const Account = () => {
  const db = supabase as any;
  const { user, isSitter } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await db
      .from("bookings")
      .select("id, start_at, end_at, status, total_cents, deposit_cents, payment_amount_cents, notes, booking_kind, requested_date, requested_window_label, scheduled_start_at, services(name, slug), pets(name)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    setBookings((data ?? []) as BookingRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleCancel = async (booking: BookingRow) => {
    setCancellingId(booking.id);
    const { data, error } = await supabase.functions.invoke("cancel-booking", {
      body: { bookingId: booking.id, environment: getStripeEnvironment() },
    });
    setCancellingId(null);

    if (error) {
      toast({ title: "Couldn't cancel", description: error.message, variant: "destructive" });
      return;
    }

    if (data?.refunded) {
      toast({ title: "Booking cancelled", description: "Your refund is on its way." });
    } else {
      toast({ title: "Booking cancelled", description: "No refund was issued for this cancellation." });
    }
    load();
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <span className="font-tag text-2xl text-clay">your stuff</span>
            <h1 className="font-display text-5xl text-primary sm:text-6xl">My account.</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-2 border-primary font-display uppercase">
              <Link to="/account/profile"><User className="h-4 w-4" /> My profile</Link>
            </Button>
            <Button asChild variant="outline" className="border-2 border-primary font-display uppercase">
              <Link to="/account/pets"><PawPrint className="h-4 w-4" /> My pets</Link>
            </Button>
            <Button asChild className="bg-primary font-display uppercase shadow-pop-accent">
              <Link to="/book"><CalendarPlus className="h-4 w-4" /> Book a service</Link>
            </Button>
            {isSitter && (
              <Button asChild variant="secondary" className="font-display uppercase">
                <Link to="/sitter">Sitter dashboard</Link>
              </Button>
            )}
          </div>
        </div>

        <h2 className="mt-10 font-display text-2xl uppercase text-primary">Bookings</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : bookings.length === 0 ? (
          <Card className="mt-4 -rotate-1 border-4 border-primary p-8 text-center shadow-pop">
            <p className="font-tag text-2xl text-clay">no bookings yet</p>
            <p className="mt-2 text-sm text-muted-foreground">Lock in a walk, sit, board, or meet & greet.</p>
            <Button asChild className="mt-6 font-display uppercase shadow-pop-accent">
              <Link to="/book">Book your first service</Link>
            </Button>
          </Card>
        ) : (
          <div className="mt-4 grid gap-3">
            {bookings.map((booking) => {
              const referenceTime = booking.scheduled_start_at ?? booking.start_at;
              const hoursUntil = (new Date(referenceTime).getTime() - Date.now()) / 36e5;
              const isUpcoming = hoursUntil > 0;
              const canPay = booking.status === "pending_payment" || booking.status === "awaiting_payment";
              const canCancel = isUpcoming && ["requested", "pending_payment", "awaiting_payment", "confirmed"].includes(booking.status);
              const refundEligible = hoursUntil >= 24 && booking.status === "confirmed";
              const helperText = booking.status === "requested"
                ? booking.services?.slug === "group-walk"
                  ? "Anneke is reviewing fit and timing before payment."
                  : "Paid and waiting for Anneke to lock in the exact time."
                : booking.status === "awaiting_payment"
                ? "Anneke has set the exact walk time — payment is ready when you are."
                : null;

              return (
                <article key={booking.id} className="flex flex-col gap-3 border-4 border-primary bg-card p-4 shadow-pop sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xl uppercase">{booking.services?.name ?? "Service"}</span>
                      <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[booking.status] ?? ""}`}>
                        {STATUS_LABELS[booking.status] ?? booking.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground/80">
                      {formatBookingSchedule(booking)} · for <span className="font-tag text-lg text-clay">{booking.pets?.name}</span>
                    </p>
                    {helperText && <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-display text-2xl">{formatPriceWithDecimals(booking.total_cents)}</div>
                      {canPay && (
                        <div className="text-xs text-clay">
                          {formatPriceWithDecimals(booking.payment_amount_cents ?? booking.deposit_cents)} due
                        </div>
                      )}
                    </div>
                    {canPay && (
                      <Button asChild size="sm" className="bg-tag font-display uppercase text-tag-foreground shadow-pop-accent">
                        <Link to={`/booking/${booking.id}/checkout`}><CreditCard className="h-4 w-4" /> Pay</Link>
                      </Button>
                    )}
                    {canCancel && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="border-2 border-primary font-display uppercase">
                            <X className="h-4 w-4" /> Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {refundEligible
                                ? "You'll receive a full refund since this is more than 24 hours away."
                                : booking.status === "requested" || booking.status === "awaiting_payment" || booking.status === "pending_payment"
                                ? "This booking isn't fully confirmed yet, so cancelling will simply release the request."
                                : "Less than 24 hours until your service — per policy, no refund will be issued."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep booking</AlertDialogCancel>
                            <AlertDialogAction disabled={cancellingId === booking.id} onClick={() => handleCancel(booking)}>
                              {cancellingId === booking.id ? "Cancelling…" : "Cancel booking"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <ChevronRight className="hidden h-5 w-5 opacity-40 sm:block" />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
};

export default Account;
