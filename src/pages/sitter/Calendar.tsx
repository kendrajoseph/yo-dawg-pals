import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { SitterPageHeader } from "@/components/sitter/SitterPageHeader";
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
  requested_date: string | null;
  requested_window_label: string | null;
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
        .select("id, customer_id, start_at, end_at, scheduled_start_at, scheduled_end_at, requested_date, requested_window_label, status, pets(name), services(name)")
        .eq("sitter_id", user.id)
        .or(`and(start_at.gte.${range.start.toISOString()},start_at.lte.${range.end.toISOString()}),and(requested_date.gte.${format(range.start, "yyyy-MM-dd")},requested_date.lte.${format(range.end, "yyyy-MM-dd")})`)
        .not("status", "in", "(cancelled,refunded)")
        .order("start_at", { ascending: true });
      if (cancelled) return;
      const rows = (data ?? []) as any[];
      const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean)));
      let nameById = new Map<string, string | null>();
      if (customerIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", customerIds);
        nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      setBookings(rows.map((r) => ({ ...r, profiles: { full_name: nameById.get(r.customer_id) ?? null } })) as any);
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
      const dateRef = b.status === "requested"
        ? b.requested_date ?? format(new Date(b.start_at), "yyyy-MM-dd")
        : format(new Date(b.scheduled_start_at ?? b.start_at), "yyyy-MM-dd");
      const list = m.get(dateRef) ?? [];
      list.push(b);
      m.set(dateRef, list);
    }
    return m;
  }, [bookings]);

  const selectedBookings = selected
    ? byDay.get(format(selected, "yyyy-MM-dd")) ?? []
    : [];

  return (
    <SitterShell action={
      <Button size="sm" asChild><Link to="/book"><Plus className="mr-1.5 h-4 w-4" />New booking</Link></Button>
    }>
      <SitterPageHeader
        back={{ to: "/sitter", label: "Back to dashboard" }}
        title="Calendar"
        description="Confirmed bookings (solid) and pending requests (dashed). Manage availability in Settings."
      />
      <div className="mb-6 flex justify-end">
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
                    {list.slice(0, 3).map((b) => {
                      const isRequested = b.status === "requested";
                      const timeLabel = isRequested
                        ? (b.requested_window_label ?? "Pending")
                        : format(new Date(b.scheduled_start_at ?? b.start_at), "h:mm a");
                      return (
                        <div
                          key={b.id}
                          className={cn(
                            "truncate rounded px-1.5 py-0.5 text-[10px]",
                            isRequested
                              ? "border border-dashed border-amber-400 bg-amber-50 text-amber-900"
                              : "bg-primary/10 text-primary",
                          )}
                          title={isRequested ? "Pending request — tap to review" : undefined}
                        >
                          {timeLabel} {b.pets?.name}
                        </div>
                      );
                    })}
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
                    ) : list.map((b) => {
                      const isRequested = b.status === "requested";
                      return (
                        <div
                          key={b.id}
                          className={cn(
                            "rounded px-1.5 py-1 text-[11px]",
                            isRequested
                              ? "border border-dashed border-amber-400 bg-amber-50 text-amber-900"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          <div className="font-medium">
                            {isRequested
                              ? (b.requested_window_label ?? "Pending")
                              : format(new Date(b.scheduled_start_at ?? b.start_at), "h:mm a")}
                          </div>
                          <div className="truncate">{b.pets?.name}</div>
                        </div>
                      );
                    })}
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
      {bookings.map((b) => {
        const isRequested = b.status === "requested";
        const href = isRequested ? `/sitter/requests/${b.id}` : `/sitter/bookings/${b.id}`;
        return (
          <li key={b.id} className="py-1">
            <Link
              to={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted",
                isRequested && "ring-1 ring-dashed ring-amber-400/60",
              )}
            >
              <div className="w-20 text-right">
                {isRequested ? (
                  <>
                    <div className="font-display text-sm text-amber-900">{b.requested_window_label ?? "Pending"}</div>
                    <div className="text-[11px] text-muted-foreground">Tap to review</div>
                  </>
                ) : (
                  <>
                    <div className="font-display text-sm text-primary">{format(new Date(b.scheduled_start_at ?? b.start_at), "h:mm a")}</div>
                    <div className="text-[11px] text-muted-foreground">{format(new Date(b.scheduled_end_at ?? b.end_at), "h:mm a")}</div>
                  </>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{b.services?.name ?? "Service"}</div>
                <div className="truncate text-xs text-muted-foreground">{b.profiles?.full_name ?? "Client"} · {b.pets?.name ?? "Pet"}</div>
              </div>
              <Badge
                variant="outline"
                className={cn("capitalize", isRequested && "border-amber-400 bg-amber-50 text-amber-900")}
              >
                {b.status.replace(/_/g, " ")}
              </Badge>
            </Link>
          </li>
        );
      })}
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
