import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DAYS,
  formatBookingSchedule,
  STATUS_LABELS,
  STATUS_STYLES,
  timeToMinutes,
} from "@/lib/booking";
import { CalendarOff, Check, Plus, Save, Trash2, Users, X } from "lucide-react";

type Availability = { id: string; weekday: number; start_minute: number; end_minute: number };
type Blocked = { id: string; blocked_date: string; reason: string | null };
type Service = { id: string; name: string; slug: string };
type AvailabilityService = { availability_id: string; service_id: string };
type WalkWindow = {
  id: string;
  service_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  window_label: string;
  sort_order: number;
};
type Booking = {
  id: string;
  customer_id: string;
  status: string;
  notes: string | null;
  booking_kind?: string | null;
  requested_date?: string | null;
  requested_window_label?: string | null;
  requested_window_start_minute?: number | null;
  requested_window_end_minute?: number | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  paid_at?: string | null;
  group_assignment_label?: string | null;
  internal_notes?: string | null;
  start_at: string;
  end_at: string;
  services: { name: string; slug: string } | null;
  pets: { name: string } | null;
};

type Draft = { date: string; start: string; end: string; groupLabel: string; internalNotes: string };

const WALK_SLUGS = new Set(["solo-walk", "group-walk"]);

const formatMinuteTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

const SitterDashboard = () => {
  const db = supabase as any;
  const { user } = useAuth();
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [availabilityServices, setAvailabilityServices] = useState<AvailabilityService[]>([]);
  const [walkWindows, setWalkWindows] = useState<WalkWindow[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [newAvailability, setNewAvailability] = useState({ weekday: 1, start: "09:00", end: "17:00" });
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);
  const [blockDate, setBlockDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");
  const [newWindow, setNewWindow] = useState({ serviceId: "", weekday: 1, label: "Morning", start: "09:00", end: "11:00" });
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, Draft>>({});
  const [savingBookingId, setSavingBookingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;

    const [{ data: avail }, { data: blockedDates }, { data: bookingRows }, { data: serviceRows }, { data: walkWindowRows }] = await Promise.all([
      db.from("availability").select("*").eq("sitter_id", user.id).order("weekday"),
      db.from("blocked_dates").select("*").eq("sitter_id", user.id).order("blocked_date"),
      db
        .from("bookings")
        .select("id, customer_id, start_at, end_at, status, notes, booking_kind, requested_date, requested_window_label, requested_window_start_minute, requested_window_end_minute, scheduled_start_at, scheduled_end_at, paid_at, group_assignment_label, internal_notes, services(name, slug), pets(name)")
        .eq("sitter_id", user.id)
        .order("created_at", { ascending: false }),
      db.from("services").select("id, name, slug").eq("is_active", true).order("sort_order"),
      db.from("walk_windows").select("id, service_id, weekday, start_minute, end_minute, window_label, sort_order").eq("sitter_id", user.id).order("weekday").order("sort_order"),
    ]);

    setAvailability((avail ?? []) as Availability[]);
    setBlocked((blockedDates ?? []) as Blocked[]);
    setBookings((bookingRows ?? []) as Booking[]);
    setServices((serviceRows ?? []) as Service[]);
    setWalkWindows((walkWindowRows ?? []) as WalkWindow[]);

    const customerIds = [...new Set(((bookingRows ?? []) as Booking[]).map((row) => row.customer_id))];
    if (customerIds.length > 0) {
      const { data: profileRows } = await db.from("profiles").select("id, full_name").in("id", customerIds);
      const nextNames = Object.fromEntries(((profileRows ?? []) as { id: string; full_name: string | null }[]).map((row) => [row.id, row.full_name || "Customer"]));
      setProfileNames(nextNames);
    } else {
      setProfileNames({});
    }

    const slotIds = (avail ?? []).map((row: Availability) => row.id);
    if (slotIds.length > 0) {
      const { data: tagged } = await db.from("availability_services").select("availability_id, service_id").in("availability_id", slotIds);
      setAvailabilityServices((tagged ?? []) as AvailabilityService[]);
    } else {
      setAvailabilityServices([]);
    }

    setNewServiceIds((current) => current.length ? current : ((serviceRows ?? []) as Service[]).filter((service) => !WALK_SLUGS.has(service.slug)).map((service) => service.id));
    setNewWindow((current) => ({
      ...current,
      serviceId: current.serviceId || ((serviceRows ?? []) as Service[]).find((service) => WALK_SLUGS.has(service.slug))?.id || "",
    }));
  };

  useEffect(() => {
    load();
  }, [user]);

  const exactSlotServices = useMemo(() => services.filter((service) => !WALK_SLUGS.has(service.slug)), [services]);
  const walkServices = useMemo(() => services.filter((service) => WALK_SLUGS.has(service.slug)), [services]);

  const tagsBySlot = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of availabilityServices) {
      if (!map.has(row.availability_id)) map.set(row.availability_id, new Set());
      map.get(row.availability_id)?.add(row.service_id);
    }
    return map;
  }, [availabilityServices]);

  const requestBookings = useMemo(
    () => bookings.filter((booking) => booking.booking_kind === "requested" && ["requested", "awaiting_payment", "confirmed"].includes(booking.status)),
    [bookings],
  );
  const upcomingExactBookings = useMemo(
    () => bookings.filter((booking) => booking.booking_kind !== "requested" && new Date(booking.start_at) > new Date()),
    [bookings],
  );
  const pastBookings = useMemo(
    () => bookings.filter((booking) => new Date(booking.scheduled_start_at ?? booking.start_at) <= new Date()),
    [bookings],
  );

  const toggleSlotService = async (slotId: string, serviceId: string, enabled: boolean) => {
    if (enabled) {
      const { error } = await db.from("availability_services").insert({ availability_id: slotId, service_id: serviceId });
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
      setAvailabilityServices((current) => [...current, { availability_id: slotId, service_id: serviceId }]);
      return;
    }

    const { error } = await db.from("availability_services").delete().eq("availability_id", slotId).eq("service_id", serviceId);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setAvailabilityServices((current) => current.filter((row) => !(row.availability_id === slotId && row.service_id === serviceId)));
  };

  const addAvailability = async () => {
    if (!user) return;
    const start = timeToMinutes(newAvailability.start);
    const end = timeToMinutes(newAvailability.end);
    if (end <= start) return toast({ title: "End must be after start", variant: "destructive" });
    if (newServiceIds.length === 0) return toast({ title: "Pick at least one service", variant: "destructive" });

    const { data: inserted, error } = await db
      .from("availability")
      .insert({ sitter_id: user.id, weekday: newAvailability.weekday, start_minute: start, end_minute: end })
      .select("id")
      .single();
    if (error || !inserted) return toast({ title: "Failed", description: error?.message, variant: "destructive" });

    const links = newServiceIds.map((serviceId) => ({ availability_id: inserted.id, service_id: serviceId }));
    const { error: linkError } = await db.from("availability_services").insert(links);
    if (linkError) toast({ title: "Slot saved, tagging failed", description: linkError.message, variant: "destructive" });
    else toast({ title: "Availability added" });
    load();
  };

  const removeAvailability = async (id: string) => {
    const { error } = await db.from("availability").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else load();
  };

  const addBlockedDate = async () => {
    if (!user || !blockDate) return;
    const { error } = await db.from("blocked_dates").insert({
      sitter_id: user.id,
      blocked_date: format(blockDate, "yyyy-MM-dd"),
      reason: blockReason || null,
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      setBlockDate(undefined);
      setBlockReason("");
      load();
    }
  };

  const removeBlockedDate = async (id: string) => {
    await db.from("blocked_dates").delete().eq("id", id);
    load();
  };

  const addWalkWindow = async () => {
    if (!user || !newWindow.serviceId) return;
    const start = timeToMinutes(newWindow.start);
    const end = timeToMinutes(newWindow.end);
    if (end <= start) return toast({ title: "End must be after start", variant: "destructive" });

    const nextSortOrder = walkWindows.filter((window) => window.service_id === newWindow.serviceId && window.weekday === newWindow.weekday).length;
    const { error } = await db.from("walk_windows").insert({
      sitter_id: user.id,
      service_id: newWindow.serviceId,
      weekday: newWindow.weekday,
      start_minute: start,
      end_minute: end,
      window_label: newWindow.label,
      sort_order: nextSortOrder,
    });

    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Walk window added" });
      load();
    }
  };

  const removeWalkWindow = async (id: string) => {
    const { error } = await db.from("walk_windows").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else load();
  };

  const updateBookingStatus = async (id: string, status: "cancelled" | "completed") => {
    const { error } = await db.from("bookings").update({ status }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: `Booking ${status}` });
      load();
    }
  };

  const buildDefaultDraft = (booking: Booking): Draft => ({
    date: booking.requested_date ?? format(new Date(booking.start_at), "yyyy-MM-dd"),
    start: booking.requested_window_start_minute != null ? formatMinuteTime(booking.requested_window_start_minute) : "09:00",
    end: booking.requested_window_end_minute != null ? formatMinuteTime(booking.requested_window_end_minute) : "10:00",
    groupLabel: booking.group_assignment_label ?? "",
    internalNotes: booking.internal_notes ?? "",
  });

  const getDraft = (booking: Booking) => scheduleDrafts[booking.id] ?? buildDefaultDraft(booking);

  const patchDraft = (booking: Booking, patch: Partial<Draft>) => {
    setScheduleDrafts((current) => ({
      ...current,
      [booking.id]: { ...buildDefaultDraft(booking), ...(current[booking.id] ?? {}), ...patch },
    }));
  };

  const saveWalkBooking = async (booking: Booking) => {
    const draft = getDraft(booking);
    const startMinute = timeToMinutes(draft.start);
    const endMinute = timeToMinutes(draft.end);
    if (endMinute <= startMinute) return toast({ title: "End must be after start", variant: "destructive" });

    setSavingBookingId(booking.id);
    const startAt = new Date(`${draft.date}T00:00:00`);
    const endAt = new Date(`${draft.date}T00:00:00`);
    startAt.setMinutes(startMinute);
    endAt.setMinutes(endMinute);

    const action = booking.services?.slug === "group-walk" ? "approve_group_walk" : "schedule_solo_walk";
    const { error } = await supabase.functions.invoke("booking-workflow", {
      body: {
        action,
        bookingId: booking.id,
        scheduledStartAt: startAt.toISOString(),
        scheduledEndAt: endAt.toISOString(),
        groupLabel: draft.groupLabel || undefined,
        internalNotes: draft.internalNotes || undefined,
        appUrl: window.location.origin,
      },
    });
    setSavingBookingId(null);

    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: booking.services?.slug === "group-walk" ? "Payment request sent" : "Solo walk confirmed" });
    load();
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
        <span className="inline-block -rotate-2 font-tag text-2xl text-clay">control room</span>
        <h1 className="font-display text-5xl text-primary sm:text-6xl">Sitter dashboard.</h1>
        <p className="mt-3 max-w-3xl text-sm text-foreground/75">
          Walks run on request windows now: you decide the final timing, which dogs fit together, and when a group walk is ready for payment.
        </p>

        <h2 className="mt-10 font-display text-2xl uppercase text-primary">Walk request queue</h2>
        {requestBookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No walk requests waiting right now.</p>
        ) : (
          <div className="mt-3 grid gap-4">
            {requestBookings.map((booking) => {
              const draft = getDraft(booking);
              const isGroup = booking.services?.slug === "group-walk";
              return (
                <Card key={booking.id} className="border-4 border-primary p-4 shadow-pop sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-xl uppercase">{booking.services?.name}</span>
                        <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[booking.status] ?? ""}`}>
                          {STATUS_LABELS[booking.status] ?? booking.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-foreground/80">
                        {profileNames[booking.customer_id] ?? "Customer"} · <span className="font-tag text-lg text-clay">{booking.pets?.name}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">Requested: {formatBookingSchedule(booking)}</p>
                      {booking.notes && <p className="mt-2 text-xs text-muted-foreground">Customer notes: “{booking.notes}”</p>}
                    </div>
                    <div className="text-left lg:text-right">
                      <div className="text-xs text-muted-foreground">
                        {isGroup
                          ? booking.status === "awaiting_payment"
                            ? "Waiting on client payment"
                            : "No payment requested yet"
                          : booking.status === "confirmed"
                          ? "Scheduled and confirmed"
                          : booking.paid_at
                          ? "Paid upfront"
                          : "Waiting on payment"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr,1fr,1fr,1fr,auto] xl:items-end">
                    <div>
                      <Label>Date</Label>
                      <Input value={draft.date} type="date" onChange={(event) => patchDraft(booking, { date: event.target.value })} />
                    </div>
                    <div>
                      <Label>Start</Label>
                      <Input value={draft.start} type="time" onChange={(event) => patchDraft(booking, { start: event.target.value })} />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input value={draft.end} type="time" onChange={(event) => patchDraft(booking, { end: event.target.value })} />
                    </div>
                    <div>
                      <Label>{isGroup ? "Group label" : "Internal note"}</Label>
                      <Input
                        value={isGroup ? draft.groupLabel : draft.internalNotes}
                        onChange={(event) => patchDraft(booking, isGroup ? { groupLabel: event.target.value } : { internalNotes: event.target.value })}
                        placeholder={isGroup ? "Calm midday crew" : "Solo fits around noon pack"}
                      />
                    </div>
                    {booking.status !== "confirmed" && (
                      <Button
                        onClick={() => saveWalkBooking(booking)}
                        disabled={savingBookingId === booking.id || (!isGroup && !booking.paid_at)}
                        className="bg-primary font-display uppercase shadow-pop-accent"
                      >
                        <Save className="h-4 w-4" />
                        {savingBookingId === booking.id ? "Saving…" : isGroup ? "Approve & request payment" : "Confirm time"}
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {booking.status !== "cancelled" && booking.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => updateBookingStatus(booking.id, "cancelled")} className="border-2 border-primary font-display uppercase">
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    )}
                    {booking.status === "confirmed" && (
                      <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(booking.id, "completed")} className="font-display uppercase">
                        <Check className="h-4 w-4" /> Mark done
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Walk request windows</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These are the windows customers can request for solo or group walks — exact times still get assigned later.
        </p>
        <Card className="mt-3 border-4 border-primary p-4 shadow-pop sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr,1fr,auto,auto,auto,auto] md:items-end">
            <div>
              <Label>Walk type</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newWindow.serviceId}
                onChange={(event) => setNewWindow({ ...newWindow, serviceId: event.target.value })}
              >
                {walkServices.map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Label</Label>
              <Input value={newWindow.label} onChange={(event) => setNewWindow({ ...newWindow, label: event.target.value })} placeholder="Morning" />
            </div>
            <div>
              <Label>Day</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newWindow.weekday}
                onChange={(event) => setNewWindow({ ...newWindow, weekday: Number(event.target.value) })}
              >
                {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={newWindow.start} onChange={(event) => setNewWindow({ ...newWindow, start: event.target.value })} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={newWindow.end} onChange={(event) => setNewWindow({ ...newWindow, end: event.target.value })} />
            </div>
            <Button onClick={addWalkWindow} className="bg-primary font-display uppercase shadow-pop-accent">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {walkServices.map((service) => {
              const serviceWindows = walkWindows.filter((window) => window.service_id === service.id);
              return (
                <div key={service.id} className="border-2 border-primary bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-clay" />
                    <h3 className="font-display text-lg uppercase text-primary">{service.name}</h3>
                  </div>
                  {serviceWindows.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No request windows yet.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {serviceWindows.map((window) => (
                        <li key={window.id} className="flex items-center justify-between gap-3 border-2 border-primary bg-muted px-3 py-2">
                          <div>
                            <div className="font-display text-sm uppercase">{DAYS[window.weekday]} · {window.window_label}</div>
                            <div className="text-xs text-muted-foreground">{formatMinuteTime(window.start_minute)}–{formatMinuteTime(window.end_minute)}</div>
                          </div>
                          <button onClick={() => removeWalkWindow(window.id)} aria-label="Remove walk window">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Exact-slot bookings</h2>
        {upcomingExactBookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No upcoming exact-time bookings right now.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {upcomingExactBookings.map((booking) => (
              <article key={booking.id} className="border-4 border-primary bg-card p-4 shadow-pop">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xl uppercase">{booking.services?.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[booking.status] ?? ""}`}>
                        {STATUS_LABELS[booking.status] ?? booking.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">
                      {formatBookingSchedule(booking)} · {profileNames[booking.customer_id] ?? "Customer"} · <span className="font-tag text-lg text-clay">{booking.pets?.name}</span>
                    </p>
                    {booking.notes && <p className="mt-1 text-xs text-muted-foreground">“{booking.notes}”</p>}
                  </div>
                  <div className="flex gap-2">
                    {booking.status !== "cancelled" && booking.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => updateBookingStatus(booking.id, "cancelled")} className="border-2 border-primary font-display uppercase">
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    )}
                    {booking.status === "confirmed" && (
                      <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(booking.id, "completed")} className="font-display uppercase">
                        <Check className="h-4 w-4" /> Mark done
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Weekly availability</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Exact-time services still use bookable calendar slots — walks are handled above with request windows.
        </p>
        <Card className="mt-3 border-4 border-primary p-4 shadow-pop sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr,auto,auto,auto] sm:items-end">
            <div>
              <Label>Day</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newAvailability.weekday}
                onChange={(event) => setNewAvailability({ ...newAvailability, weekday: Number(event.target.value) })}
              >
                {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={newAvailability.start} onChange={(event) => setNewAvailability({ ...newAvailability, start: event.target.value })} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={newAvailability.end} onChange={(event) => setNewAvailability({ ...newAvailability, end: event.target.value })} />
            </div>
            <Button onClick={addAvailability} className="bg-primary font-display uppercase shadow-pop-accent">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          <div className="mt-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Services this slot covers</Label>
            <div className="mt-2 flex flex-wrap gap-3">
              {exactSlotServices.map((service) => {
                const checked = newServiceIds.includes(service.id);
                return (
                  <label key={service.id} className={cn("flex cursor-pointer items-center gap-2 border-2 border-primary px-3 py-1.5 text-sm transition-colors", checked ? "bg-accent text-accent-foreground" : "bg-card hover:bg-muted")}>
                    <Checkbox checked={checked} onCheckedChange={(value) => setNewServiceIds((current) => value === true ? [...new Set([...current, service.id])] : current.filter((id) => id !== service.id))} />
                    <span className="font-display uppercase">{service.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {availability.length > 0 ? (
            <ul className="mt-5 grid gap-2">
              {availability.map((slot) => {
                const tagged = tagsBySlot.get(slot.id) ?? new Set<string>();
                return (
                  <li key={slot.id} className="border-2 border-primary bg-muted px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm">
                        <span className="font-display uppercase">{DAYS[slot.weekday]}</span> · {formatMinuteTime(slot.start_minute)}–{formatMinuteTime(slot.end_minute)}
                      </span>
                      <button onClick={() => removeAvailability(slot.id)} aria-label="Remove slot">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {exactSlotServices.map((service) => {
                        const enabled = tagged.has(service.id);
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggleSlotService(slot.id, service.id, !enabled)}
                            className={cn("border-2 border-primary px-2 py-1 text-xs font-display uppercase transition-colors", enabled ? "bg-secondary text-secondary-foreground" : "bg-card text-muted-foreground hover:bg-card/80")}
                            aria-pressed={enabled}
                          >
                            {enabled ? "✓ " : ""}{service.name}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No exact-time availability yet.</p>
          )}
        </Card>

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Blocked days</h2>
        <Card className="mt-3 border-4 border-primary p-4 shadow-pop sm:p-5">
          <div className="grid gap-4 md:grid-cols-[auto,1fr]">
            <div className="border-2 border-primary bg-card">
              <Calendar mode="single" selected={blockDate} onSelect={setBlockDate} disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))} className={cn("pointer-events-auto p-3")} />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={blockReason} maxLength={100} onChange={(event) => setBlockReason(event.target.value)} placeholder="Vacation, vet, family day…" />
              <Button onClick={addBlockedDate} disabled={!blockDate} className="mt-3 bg-primary font-display uppercase shadow-pop-accent">
                <CalendarOff className="h-4 w-4" /> Block date
              </Button>
              {blocked.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {blocked.map((blockedDate) => (
                    <li key={blockedDate.id} className="flex items-center justify-between border-2 border-primary bg-muted px-3 py-2">
                      <span className="text-sm">
                        <span className="font-display uppercase">{format(new Date(`${blockedDate.blocked_date}T12:00:00`), "EEE, MMM d")}</span>
                        {blockedDate.reason && <span className="ml-2 text-muted-foreground">— {blockedDate.reason}</span>}
                      </span>
                      <button onClick={() => removeBlockedDate(blockedDate.id)} aria-label="Remove blocked date">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        {pastBookings.length > 0 && (
          <>
            <h2 className="mt-12 font-display text-2xl uppercase text-primary">Recent bookings</h2>
            <ul className="mt-3 space-y-2">
              {pastBookings.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-primary bg-card px-3 py-2 text-sm">
                  <span>{formatBookingSchedule(booking)} · {booking.services?.name} · {booking.pets?.name}</span>
                  <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[booking.status] ?? ""}`}>
                    {STATUS_LABELS[booking.status] ?? booking.status}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <Link to="/account" className="mt-10 inline-block -rotate-1 font-tag text-xl text-clay">← back to account</Link>
      </section>
      <SiteFooter />
    </main>
  );
};

export default SitterDashboard;
