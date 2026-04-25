import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Booking = {
  id: string;
  start_at: string;
  end_at: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  status: string;
  pets: { name: string } | null;
  services: { name: string } | null;
  profiles: { full_name: string | null } | null;
};

type View = "month" | "week" | "day";

export default function SitterCalendar() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [view, setView] = useState<View>("month");
  const [selected, setSelected] = useState<Date | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const range = getRange(anchor, view);
    const load = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, start_at, end_at, scheduled_start_at, scheduled_end_at, status, pets(name), services(name), profiles:customer_id(full_name)")
        .eq("sitter_id", user.id)
        .gte("start_at", range.start.toISOString())
        .lte("start_at", range.end.toISOString())
        .not("status", "in", "(cancelled,refunded,requested)")
        .order("start_at", { ascending: true });
      if (cancelled) return;
      setBookings((data ?? []) as any);
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id, anchor, view]);

  const days = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(anchor));
      const end = endOfWeek(endOfMonth(anchor));
      const arr: Date[] = [];
      let d = start;
      while (d <= end) { arr.push(d); d = addDays(d, 1); }
      return arr;
    }
    if (view === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    }
    return [anchor];
  }, [anchor, view]);

  const byDay = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = format(new Date(b.scheduled_start_at ?? b.start_at), "yyyy-MM-dd");
      const list = m.get(key) ?? [];
      list.push(b);
      m.set(key, list);
    }
    return m;
  }, [bookings]);

  const selectedBookings = selected
    ? byDay.get(format(selected, "yyyy-MM-dd")) ?? []
    : [];

  return (
    <SitterShell action={
      <Button size="sm" asChild><Link to="/sitter-classic#schedule"><Plus className="mr-1.5 h-4 w-4" />New booking</Link></Button>
    }>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-primary">Calendar</h1>
          <p className="text-sm text-muted-foreground">Confirmed bookings only — manage availability in Settings.</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Card className="border border-border p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setAnchor(view === "month" ? subMonths(anchor, 1) : addDays(anchor, view === "week" ? -7 : -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-display text-lg text-primary">
            {view === "day" ? format(anchor, "EEEE, MMM d, yyyy") : format(anchor, "MMMM yyyy")}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setAnchor(view === "month" ? addMonths(anchor, 1) : addDays(anchor, view === "week" ? 7 : 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {view === "month" && (
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border text-sm">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="bg-muted px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>
            ))}
            {days.map((d) => {
              const list = byDay.get(format(d, "yyyy-MM-dd")) ?? [];
              const isToday = isSameDay(d, new Date());
              const inMonth = isSameMonth(d, anchor);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelected(d)}
                  className={cn(
                    "min-h-[88px] bg-card p-1.5 text-left transition-colors hover:bg-muted",
                    !inMonth && "bg-card/50 text-muted-foreground",
                    isToday && "ring-2 ring-inset ring-primary/40",
                  )}
                >
                  <div className={cn("text-xs font-medium", isToday && "text-primary")}>{format(d, "d")}</div>
                  <div className="mt-1 space-y-0.5">
                    {list.slice(0, 3).map((b) => (
                      <div key={b.id} className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        {format(new Date(b.scheduled_start_at ?? b.start_at), "h:mm a")} {b.pets?.name}
                      </div>
                    ))}
                    {list.length > 3 && <div className="text-[10px] text-muted-foreground">+{list.length - 3} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {view === "week" && (
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const list = byDay.get(format(d, "yyyy-MM-dd")) ?? [];
              const isToday = isSameDay(d, new Date());
              return (
                <button key={d.toISOString()} onClick={() => setSelected(d)} className={cn("rounded-md border border-border bg-card p-2 text-left", isToday && "ring-2 ring-primary/40")}>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{format(d, "EEE")}</div>
                  <div className="font-display text-lg text-primary">{format(d, "d")}</div>
                  <div className="mt-2 space-y-1">
                    {list.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground">—</div>
                    ) : list.map((b) => (
                      <div key={b.id} className="rounded bg-primary/10 px-1.5 py-1 text-[11px] text-primary">
                        <div className="font-medium">{format(new Date(b.scheduled_start_at ?? b.start_at), "h:mm a")}</div>
                        <div className="truncate">{b.pets?.name}</div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {view === "day" && (
          <DayList bookings={byDay.get(format(anchor, "yyyy-MM-dd")) ?? []} />
        )}
      </Card>

      {selected && view !== "day" && (
        <Card className="mt-4 border border-border p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-primary">{format(selected, "EEEE, MMM d")}</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>
          </div>
          <DayList bookings={selectedBookings} />
        </Card>
      )}
    </SitterShell>
  );
}

function DayList({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="Nothing scheduled" description="Confirmed bookings will appear here." />;
  }
  return (
    <ul className="divide-y divide-border">
      {bookings.map((b) => (
        <li key={b.id} className="flex items-center gap-3 py-3">
          <div className="w-20 text-right">
            <div className="font-display text-sm text-primary">{format(new Date(b.scheduled_start_at ?? b.start_at), "h:mm a")}</div>
            <div className="text-[11px] text-muted-foreground">{format(new Date(b.scheduled_end_at ?? b.end_at), "h:mm a")}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{b.services?.name ?? "Service"}</div>
            <div className="truncate text-xs text-muted-foreground">{b.profiles?.full_name ?? "Client"} · {b.pets?.name ?? "Pet"}</div>
          </div>
          <Badge variant="outline" className="capitalize">{b.status.replace(/_/g, " ")}</Badge>
        </li>
      ))}
    </ul>
  );
}

function getRange(anchor: Date, view: View) {
  if (view === "month") {
    return { start: startOfWeek(startOfMonth(anchor)), end: endOfWeek(endOfMonth(anchor)) };
  }
  if (view === "week") {
    const s = startOfWeek(anchor);
    return { start: s, end: addDays(s, 7) };
  }
  return { start: anchor, end: addDays(anchor, 1) };
}
