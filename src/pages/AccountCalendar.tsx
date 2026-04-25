import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type CalendarBooking = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  services: { name: string } | null;
  service_variants: { name: string } | null;
  pets: { name: string } | null;
};

const ACTIVE_STATUSES = ["confirmed", "completed"] as const;

const AccountCalendar = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, start_at, end_at, status, scheduled_start_at, scheduled_end_at, services(name), service_variants(name), pets(name)"
        )
        .eq("customer_id", user.id)
        .in("status", ACTIVE_STATUSES)
        .order("start_at", { ascending: true });
      if (cancelled) return;
      setBookings((data ?? []) as CalendarBooking[]);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = new Date(d.getTime() + 24 * 3600 * 1000);
    }
    return out;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of bookings) {
      const ref = b.scheduled_start_at ?? b.start_at;
      const key = format(new Date(ref), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [bookings]);

  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  const selectedBookings = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to account
        </Link>
        <div className="mt-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <span className="font-tag text-2xl text-clay">your schedule</span>
            <h1 className="font-display text-5xl text-primary sm:text-6xl">My calendar.</h1>
            <p className="mt-1 text-sm text-muted-foreground">Approved and paid bookings show up here.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor((c) => subMonths(c, 1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-display text-lg uppercase text-primary">{format(cursor, "MMMM yyyy")}</span>
            <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="mt-6 border-4 border-primary p-4 shadow-pop sm:p-6">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-display uppercase text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const inMonth = isSameMonth(d, cursor);
              const isSelected = selected ? isSameDay(d, selected) : false;
              const isToday = isSameDay(d, new Date());
              const dayBookings = byDay.get(key) ?? [];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(d)}
                  className={`aspect-square min-h-14 border p-1 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : isToday
                      ? "border-clay bg-card"
                      : "border-border bg-card hover:bg-muted"
                  } ${inMonth ? "" : "opacity-40"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${isToday ? "text-clay" : "text-foreground"}`}>{format(d, "d")}</span>
                    {dayBookings.length > 0 && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {dayBookings.length}
                      </span>
                    )}
                  </div>
                  {dayBookings.slice(0, 2).map((b) => (
                    <div key={b.id} className="mt-0.5 truncate text-[10px] text-foreground/70">
                      {b.service_variants?.name ?? b.services?.name ?? "Service"}
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="mt-6 border-4 border-primary p-5 shadow-pop sm:p-6">
          <h2 className="font-display text-xl uppercase text-primary">
            {selected ? format(selected, "EEEE, MMM d") : "Pick a day"}
          </h2>
          {loading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          ) : selectedBookings.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing scheduled this day.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {selectedBookings.map((b) => {
                const startAt = new Date(b.scheduled_start_at ?? b.start_at);
                const endAt = new Date(b.scheduled_end_at ?? b.end_at);
                const sameDay = isSameDay(startAt, endAt);
                return (
                  <li key={b.id} className="border border-border bg-muted/40 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-base uppercase text-primary">
                        {b.service_variants?.name ?? b.services?.name ?? "Service"}
                      </span>
                      <span className="font-tag text-lg text-clay">{b.pets?.name}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground/80">
                      {format(startAt, "h:mm a")} – {format(endAt, sameDay ? "h:mm a" : "MMM d, h:mm a")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
      <SiteFooter />
    </main>
  );
};

export default AccountCalendar;
