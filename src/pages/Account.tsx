import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarPlus, PawPrint, ChevronRight, User } from "lucide-react";
import { formatBookingDateTime, formatPriceWithDecimals, STATUS_LABELS, STATUS_STYLES } from "@/lib/booking";

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  total_cents: number;
  deposit_cents: number;
  notes: string | null;
  services: { name: string } | null;
  pets: { name: string } | null;
};

const Account = () => {
  const { user, isSitter } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, start_at, end_at, status, total_cents, deposit_cents, notes, services(name), pets(name)")
        .eq("customer_id", user.id)
        .order("start_at", { ascending: false });
      setBookings((data ?? []) as unknown as BookingRow[]);
      setLoading(false);
    })();
  }, [user]);

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
            <p className="mt-2 text-sm text-muted-foreground">Lock in a walk, sit or board.</p>
            <Button asChild className="mt-6 font-display uppercase shadow-pop-accent">
              <Link to="/book">Book your first service</Link>
            </Button>
          </Card>
        ) : (
          <div className="mt-4 grid gap-3">
            {bookings.map((b) => (
              <article key={b.id} className="flex flex-col gap-3 border-4 border-primary bg-card p-4 shadow-pop sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl uppercase">{b.services?.name ?? "Service"}</span>
                    <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[b.status] ?? ""}`}>
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground/80">
                    {formatBookingDateTime(b.start_at)} · for <span className="font-tag text-lg text-clay">{b.pets?.name}</span>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-display text-2xl">{formatPriceWithDecimals(b.total_cents)}</div>
                    {b.status === "pending_payment" && (
                      <div className="text-xs text-clay">Deposit {formatPriceWithDecimals(b.deposit_cents)} due</div>
                    )}
                  </div>
                  <ChevronRight className="hidden h-5 w-5 opacity-40 sm:block" />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
};

export default Account;
