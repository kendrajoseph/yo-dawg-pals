import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, CalendarHeart } from "lucide-react";
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
import { PersonalEventDialog, type PersonalEventRow } from "@/components/sitter/PersonalEventDialog";

type Booking = {
  id: string;
  start_at: string;
  end_at: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  requested_date: string | null;
  requested_end_date: string | null;
  requested_window_label: string | null;
  status: string;
  pets: { name: string } | null;
  services: { name: string } | null;
  profiles: { full_name: string | null } | null;
};

type DayItem =
  | { kind: "booking"; date: string; booking: Booking; isFirstDay: boolean; isLastDay: boolean; spans: boolean }
  | { kind: "personal"; date: string; event: PersonalEventRow; isFirstDay: boolean; isLastDay: boolean; spans: boolean };

type View = "month" | "week" | "day";

export default function SitterCalendar() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [personalEvents, setPersonalEvents] = useState<PersonalEventRow[]>([]);
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [view, setView] = useState<View>("month");
  const [selected, setSelected] = useState<Date | null>(null);
  const [reload, setReload] = useState(0);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PersonalEventRow | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const range = getRange(anchor, view);
    const load = async () => {
      const startIso = range.start.toISOString();
      const endIso = range.end.toISOString();
      const startDate = format(range.start, "yyyy-MM-dd");
      const endDate = format(range.end, "yyyy-MM-dd");

      // Bookings whose [start_at, end_at] OR requested-date range overlaps the visible range.
      const { data } = await supabase
        .from("bookings")
        .select("id, customer_id, start_at, end_at, scheduled_start_at, scheduled_end_at, requested_date, requested_end_date, requested_window_label, status, pets(name), services(name)")
        .eq("sitter_id", user.id)
        .or(
          `and(start_at.lte.${endIso},end_at.gte.${startIso}),` +
          `and(requested_date.lte.${endDate},requested_end_date.gte.${startDate}),` +
          `and(requested_date.lte.${endDate},requested_date.gte.${startDate})`
        )
        .not("status", "in", "(cancelled,refunded)")
        .order("start_at", { ascending: true });

      const rows = (data ?? []) as any[];
      const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean)));
      let nameById = new Map<string, string | null>();
      if (customerIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", customerIds);
        nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }

      const { data: peData } = await (supabase as any)
        .from("personal_events")
        .select("id, title, notes, start_at, end_at, all_day, category")
        .eq("sitter_id", user.id)
        .lte("start_at", endIso)
        .gte("end_at", startIso)
        .order("start_at", { ascending: true });

      if (cancelled) return;
      setBookings(rows.map((r) => ({ ...r, profiles: { full_name: nameById.get(r.customer_id) ?? null } })) as any);
      setPersonalEvents((peData ?? []) as PersonalEventRow[]);
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id, anchor, view, reload]);

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

  // Expand each booking / personal event into every day it spans.
  const byDay = useMemo(() => {
    const m = new Map<string, DayItem[]>();
    const push = (key: string, item: DayItem) => {
      const list = m.get(key) ?? [];
      list.push(item);
      m.set(key, list);
    };

    for (const b of bookings) {
      const isRequested = b.status === "requested";
      let firstDate: Date;
      let lastDate: Date;
      if (isRequested) {
        if (b.requested_date) {
          firstDate = new Date(`${b.requested_date}T00:00:00`);
          lastDate = b.requested_end_date ? new Date(`${b.requested_end_date}T00:00:00`) : firstDate;
        } else {
          firstDate = startOfDay(new Date(b.start_at));
          lastDate = startOfDay(new Date(b.end_at));
        }
      } else {
        firstDate = startOfDay(new Date(b.scheduled_start_at ?? b.start_at));
        lastDate = startOfDay(new Date(b.scheduled_end_at ?? b.end_at));
      }
      let d = firstDate;
      while (d <= lastDate) {
        const key = format(d, "yyyy-MM-dd");
        const isFirst = isSameDay(d, firstDate);
        const isLast = isSameDay(d, lastDate);
        push(key, { kind: "booking", date: key, booking: b, isFirstDay: isFirst, isLastDay: isLast, spans: !isSameDay(firstDate, lastDate) });
        d = addDays(d, 1);
      }
    }

    for (const e of personalEvents) {
      const firstDate = startOfDay(new Date(e.start_at));
      const lastDate = startOfDay(new Date(e.end_at));
      let d = firstDate;
      while (d <= lastDate) {
        const key = format(d, "yyyy-MM-dd");
        const isFirst = isSameDay(d, firstDate);
        const isLast = isSameDay(d, lastDate);
        push(key, { kind: "personal", date: key, event: e, isFirstDay: isFirst, isLastDay: isLast, spans: !isSameDay(firstDate, lastDate) });
        d = addDays(d, 1);
      }
    }

    return m;
  }, [bookings, personalEvents]);

  const selectedItems = selected ? byDay.get(format(selected, "yyyy-MM-dd")) ?? [] : [];

  const openNewEvent = () => { setEditingEvent(null); setEventDialogOpen(true); };
  const openEditEvent = (e: PersonalEventRow) => { setEditingEvent(e); setEventDialogOpen(true); };
  const onSaved = () => setReload((n) => n + 1);

  return (
    <SitterShell action={
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={openNewEvent}><CalendarHeart className="mr-1.5 h-4 w-4" />Add personal event</Button>
        <Button size="sm" asChild><Link to="/book"><Plus className="mr-1.5 h-4 w-4" />New booking</Link></Button>
      </div>
    }>
      <SitterPageHeader
        back={{ to: "/sitter", label: "Back to dashboard" }}
        title="Calendar"
        description="Confirmed bookings (solid), pending requests (dashed), personal events (lavender). Multi-day stays appear on every day."
      />
      <div className="mb-6 flex justify-end">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="day">Day</TabsTrigger>
          </TabsList>
        </Tabs>
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
                    {list.slice(0, 3).map((it, i) => <ChipCell key={i} item={it} />)}
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
                    {list.length === 0
                      ? <div className="text-[11px] text-muted-foreground">—</div>
                      : list.map((it, i) => <ChipCell key={i} item={it} large />)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {view === "day" && (
          <DayList items={byDay.get(format(anchor, "yyyy-MM-dd")) ?? []} onEditEvent={openEditEvent} />
        )}
      </Card>

      {selected && view !== "day" && (
        <Card className="mt-4 border border-border p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-primary">{format(selected, "EEEE, MMM d")}</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}>
                <Plus className="mr-1 h-3.5 w-3.5" />Personal event
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
          <DayList items={selectedItems} onEditEvent={openEditEvent} />
        </Card>
      )}

      <PersonalEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        defaultDate={selected ?? anchor}
        event={editingEvent}
        onSaved={onSaved}
      />
    </SitterShell>
  );
}

function ChipCell({ item, large }: { item: DayItem; large?: boolean }) {
  if (item.kind === "personal") {
    const e = item.event;
    const time = e.all_day || item.spans
      ? (item.spans ? `${item.isFirstDay ? "Starts" : item.isLastDay ? "Ends" : "•"}` : "All day")
      : format(new Date(e.start_at), "h:mm a");
    return (
      <div className={cn("truncate rounded px-1.5 py-0.5 border-l-2 border-violet-500 bg-violet-50 text-violet-900", large ? "text-[11px]" : "text-[10px]")}>
        <span className="font-medium">{time}</span> {e.title}
      </div>
    );
  }
  const b = item.booking;
  const isRequested = b.status === "requested";
  const span = item.spans;
  let timeLabel: string;
  if (span) {
    timeLabel = item.isFirstDay ? "Starts" : item.isLastDay ? "Ends" : "•";
  } else if (isRequested) {
    timeLabel = b.requested_window_label ?? "Pending";
  } else {
    timeLabel = format(new Date(b.scheduled_start_at ?? b.start_at), "h:mm a");
  }
  return (
    <div
      className={cn(
        "truncate rounded px-1.5 py-0.5",
        large ? "text-[11px]" : "text-[10px]",
        isRequested
          ? "border border-dashed border-amber-400 bg-amber-50 text-amber-900"
          : "bg-primary/10 text-primary",
      )}
    >
      {timeLabel} {b.pets?.name ?? b.services?.name ?? "Booking"}
    </div>
  );
}

function DayList({ items, onEditEvent }: { items: DayItem[]; onEditEvent: (e: PersonalEventRow) => void }) {
  if (items.length === 0) {
    return <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="Nothing scheduled" description="Bookings and personal events will appear here." />;
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((it, idx) => {
        if (it.kind === "personal") {
          const e = it.event;
          const timeText = e.all_day
            ? "All day"
            : it.spans
              ? `${it.isFirstDay ? `Starts ${format(new Date(e.start_at), "h:mm a")}` : it.isLastDay ? `Ends ${format(new Date(e.end_at), "h:mm a")}` : "All day"}`
              : `${format(new Date(e.start_at), "h:mm a")} – ${format(new Date(e.end_at), "h:mm a")}`;
          return (
            <li key={`pe-${e.id}-${idx}`} className="py-1">
              <button onClick={() => onEditEvent(e)} className="flex w-full items-center gap-3 rounded-md border-l-2 border-violet-500 bg-violet-50/60 px-2 py-2 text-left transition-colors hover:bg-violet-100">
                <div className="w-24 text-right">
                  <div className="font-display text-sm text-violet-900">{timeText.split(" ")[0] === "Starts" || timeText.split(" ")[0] === "Ends" ? timeText : timeText.split(" – ")[0]}</div>
                  <div className="text-[11px] text-violet-700">{e.all_day ? "All day" : timeText.includes("–") ? timeText.split(" – ")[1] : ""}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.title}</div>
                  <div className="truncate text-xs text-violet-700/80 capitalize">{e.category}{e.notes ? ` · ${e.notes}` : ""}</div>
                </div>
                <Badge variant="outline" className="border-violet-400 bg-violet-50 text-violet-900">Personal</Badge>
              </button>
            </li>
          );
        }
        const b = it.booking;
        const isRequested = b.status === "requested";
        const href = isRequested ? `/sitter/requests/${b.id}` : `/sitter/bookings/${b.id}`;
        const timeText = it.spans
          ? (it.isFirstDay ? `Starts ${format(new Date(b.scheduled_start_at ?? b.start_at), "h:mm a")}` : it.isLastDay ? `Ends ${format(new Date(b.scheduled_end_at ?? b.end_at), "h:mm a")}` : "Ongoing")
          : isRequested
            ? (b.requested_window_label ?? "Pending")
            : format(new Date(b.scheduled_start_at ?? b.start_at), "h:mm a");
        return (
          <li key={`b-${b.id}-${idx}`} className="py-1">
            <Link to={href} className={cn("flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted", isRequested && "ring-1 ring-dashed ring-amber-400/60")}>
              <div className="w-24 text-right">
                <div className={cn("font-display text-sm", isRequested ? "text-amber-900" : "text-primary")}>{timeText}</div>
                {!it.spans && !isRequested && (
                  <div className="text-[11px] text-muted-foreground">{format(new Date(b.scheduled_end_at ?? b.end_at), "h:mm a")}</div>
                )}
                {it.spans && <div className="text-[11px] text-muted-foreground">multi-day</div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{b.services?.name ?? "Service"}</div>
                <div className="truncate text-xs text-muted-foreground">{b.profiles?.full_name ?? "Client"} · {b.pets?.name ?? "Pet"}</div>
              </div>
              <Badge variant="outline" className={cn("capitalize", isRequested && "border-amber-400 bg-amber-50 text-amber-900")}>
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
