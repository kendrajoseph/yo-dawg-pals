import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarOff, Clock3, ExternalLink, Minus, Pencil, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { DAYS, minutesToTime, minutesToTime24, timeToMinutes } from "@/lib/booking";
import { cn } from "@/lib/utils";

type Service = { id: string; name: string; slug: string };
type Slot = { id: string; weekday: number; start_minute: number; end_minute: number; max_bookings: number };
type WalkWindow = {
  id: string;
  service_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  window_label: string;
  max_bookings: number;
  sort_order: number;
};
type Blocked = { id: string; blocked_date: string; reason: string | null };
type AvailService = { availability_id: string; service_id: string };

const WALK_SLUGS = new Set(["solo-walk", "group-walk"]);

export default function SettingsAvailability() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [windows, setWindows] = useState<WalkWindow[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [availServices, setAvailServices] = useState<AvailService[]>([]);

  // weekly slot form
  const [slotForm, setSlotForm] = useState({ weekday: 1, start: "09:00", end: "12:00", maxBookings: 1, serviceIds: [] as string[] });
  // walk window form
  const [winForm, setWinForm] = useState({ id: "", serviceId: "", weekday: 1, label: "Morning", start: "09:00", end: "11:00", maxBookings: 4 });
  // block form
  const [blockDate, setBlockDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [svcRes, slotsRes, winRes, blockRes, asRes] = await Promise.all([
      supabase.from("services").select("id, name, slug").order("name"),
      supabase.from("availability").select("*").eq("sitter_id", user.id).order("weekday").order("start_minute"),
      supabase.from("walk_windows").select("*").eq("sitter_id", user.id).order("weekday").order("start_minute"),
      supabase.from("blocked_dates").select("*").eq("sitter_id", user.id).order("blocked_date"),
      supabase.from("availability_services").select("availability_id, service_id"),
    ]);
    setServices((svcRes.data ?? []) as Service[]);
    setSlots((slotsRes.data ?? []) as Slot[]);
    setWindows((winRes.data ?? []) as WalkWindow[]);
    setBlocked((blockRes.data ?? []) as Blocked[]);
    setAvailServices((asRes.data ?? []) as AvailService[]);
    if (!winForm.serviceId) {
      const firstWalk = (svcRes.data ?? []).find((s: Service) => WALK_SLUGS.has(s.slug));
      if (firstWalk) setWinForm((c) => ({ ...c, serviceId: firstWalk.id }));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const walkServices = useMemo(() => services.filter((s) => WALK_SLUGS.has(s.slug)), [services]);
  const exactServices = useMemo(() => services.filter((s) => !WALK_SLUGS.has(s.slug)), [services]);

  const tagsBySlot = useMemo(() => {
    const m = new Map<string, Set<string>>();
    availServices.forEach((row) => {
      if (!m.has(row.availability_id)) m.set(row.availability_id, new Set());
      m.get(row.availability_id)!.add(row.service_id);
    });
    return m;
  }, [availServices]);

  // ---- Slots ----
  const addSlot = async () => {
    if (!user) return;
    const start = timeToMinutes(slotForm.start);
    const end = timeToMinutes(slotForm.end);
    if (end <= start) return toast({ title: "End must be after start", variant: "destructive" });
    if (slotForm.serviceIds.length === 0) return toast({ title: "Pick at least one service", variant: "destructive" });

    const { data, error } = await supabase.from("availability").insert({
      sitter_id: user.id, weekday: slotForm.weekday, start_minute: start, end_minute: end, max_bookings: slotForm.maxBookings,
    }).select("id").single();
    if (error || !data) return toast({ title: "Failed", description: error?.message, variant: "destructive" });

    const links = slotForm.serviceIds.map((service_id) => ({ availability_id: data.id, service_id }));
    await supabase.from("availability_services").insert(links);
    toast({ title: "Block added" });
    load();
  };

  const removeSlot = async (id: string) => {
    if (!confirm("Remove this booking block?")) return;
    await supabase.from("availability").delete().eq("id", id);
    load();
  };

  const updateSlotCapacity = async (id: string, next: number) => {
    await supabase.from("availability").update({ max_bookings: Math.max(1, next) }).eq("id", id);
    load();
  };

  const toggleSlotService = async (slotId: string, serviceId: string, on: boolean) => {
    if (on) await supabase.from("availability_services").insert({ availability_id: slotId, service_id: serviceId });
    else await supabase.from("availability_services").delete().eq("availability_id", slotId).eq("service_id", serviceId);
    load();
  };

  // ---- Walk windows ----
  const saveWindow = async () => {
    if (!user || !winForm.serviceId) return;
    const start = timeToMinutes(winForm.start);
    const end = timeToMinutes(winForm.end);
    if (end <= start) return toast({ title: "End must be after start", variant: "destructive" });
    const payload = {
      service_id: winForm.serviceId, weekday: winForm.weekday, start_minute: start, end_minute: end,
      window_label: winForm.label, max_bookings: winForm.maxBookings,
    };
    const { error } = winForm.id
      ? await supabase.from("walk_windows").update(payload).eq("id", winForm.id)
      : await supabase.from("walk_windows").insert({ sitter_id: user.id, ...payload, sort_order: 0 });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: winForm.id ? "Walk window updated" : "Walk window added" });
    setWinForm((c) => ({ ...c, id: "", label: "Morning", start: "09:00", end: "11:00", maxBookings: 4 }));
    load();
  };

  const removeWindow = async (id: string) => {
    if (!confirm("Remove this walk window?")) return;
    await supabase.from("walk_windows").delete().eq("id", id);
    load();
  };

  const updateWindowCapacity = async (id: string, next: number) => {
    await supabase.from("walk_windows").update({ max_bookings: Math.max(1, next) }).eq("id", id);
    load();
  };

  // ---- Blocked dates ----
  const addBlocked = async () => {
    if (!user || !blockDate) return;
    const dateStr = format(blockDate, "yyyy-MM-dd");
    const { error } = await supabase.from("blocked_dates").insert({ sitter_id: user.id, blocked_date: dateStr, reason: blockReason || null });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Date blocked" });
    setBlockDate(undefined);
    setBlockReason("");
    load();
  };

  const removeBlocked = async (id: string) => {
    await supabase.from("blocked_dates").delete().eq("id", id);
    load();
  };

  return (
    <SettingsLayout title="Availability" description="Weekly hours, walk windows, and blocked dates.">
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-dashed border-border bg-muted/30 p-3 shadow-soft">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          Need the AI scheduling assistant? Use the classic editor for natural-language commands.
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/sitter-classic#schedule">Open AI assistant <ExternalLink className="ml-1 h-3 w-3" /></Link>
        </Button>
      </Card>

      <Tabs defaultValue="slots">
        <TabsList>
          <TabsTrigger value="slots">Booking blocks</TabsTrigger>
          <TabsTrigger value="windows">Walk windows</TabsTrigger>
          <TabsTrigger value="blocked">Blocked dates</TabsTrigger>
        </TabsList>

        {/* ----- Booking blocks ----- */}
        <TabsContent value="slots" className="mt-4 space-y-4">
          <Card className="border border-border p-4 shadow-soft">
            <h3 className="font-display text-base text-primary">Add booking block</h3>
            <p className="text-xs text-muted-foreground">Exact-time blocks for sits, boarding, and overflow walks.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,auto,auto,auto,auto] sm:items-end">
              <div>
                <Label>Day</Label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={slotForm.weekday} onChange={(e) => setSlotForm({ ...slotForm, weekday: Number(e.target.value) })}>
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div><Label>Start</Label><Input type="time" value={slotForm.start} onChange={(e) => setSlotForm({ ...slotForm, start: e.target.value })} /></div>
              <div><Label>End</Label><Input type="time" value={slotForm.end} onChange={(e) => setSlotForm({ ...slotForm, end: e.target.value })} /></div>
              <div><Label>Capacity</Label><Input type="number" min={1} value={slotForm.maxBookings} onChange={(e) => setSlotForm({ ...slotForm, maxBookings: Math.max(1, Number(e.target.value) || 1) })} /></div>
              <Button onClick={addSlot}><Plus className="h-4 w-4" /> Add</Button>
            </div>
            <div className="mt-3">
              <Label className="text-xs uppercase text-muted-foreground">Services covered</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {exactServices.map((s) => {
                  const checked = slotForm.serviceIds.includes(s.id);
                  return (
                    <label key={s.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm", checked ? "border-primary bg-card text-primary" : "border-border bg-muted/40")}>
                      <Checkbox checked={checked} onCheckedChange={(v) => setSlotForm((c) => ({ ...c, serviceIds: v === true ? [...new Set([...c.serviceIds, s.id])] : c.serviceIds.filter((id) => id !== s.id) }))} />
                      <span>{s.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="border border-border p-4 shadow-soft">
            <h3 className="mb-3 font-display text-base text-primary">Weekly blocks</h3>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No booking blocks yet.</p>
            ) : (
              <ul className="grid gap-2">
                {slots.map((slot) => {
                  const tagged = tagsBySlot.get(slot.id) ?? new Set<string>();
                  return (
                    <li key={slot.id} className="rounded-md border border-border bg-muted/40 px-3 py-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <span className="text-sm"><span className="font-display uppercase text-primary">{DAYS[slot.weekday]}</span> · {minutesToTime(slot.start_minute)}–{minutesToTime(slot.end_minute)}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-sm">
                            <Clock3 className="h-3.5 w-3.5 text-muted-foreground" /><span>Cap</span>
                            <button onClick={() => updateSlotCapacity(slot.id, slot.max_bookings - 1)}><Minus className="h-3.5 w-3.5" /></button>
                            <span className="font-display text-primary">{slot.max_bookings}</span>
                            <button onClick={() => updateSlotCapacity(slot.id, slot.max_bookings + 1)}><Plus className="h-3.5 w-3.5" /></button>
                          </div>
                          <button onClick={() => removeSlot(slot.id)} aria-label="Remove"><Trash2 className="h-4 w-4 text-destructive" /></button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {exactServices.map((s) => {
                          const on = tagged.has(s.id);
                          return (
                            <button key={s.id} onClick={() => toggleSlotService(slot.id, s.id, !on)} className={cn("rounded-md border px-2 py-1 text-xs", on ? "border-primary bg-card text-primary" : "border-border bg-background text-muted-foreground")}>{on ? "✓ " : ""}{s.name}</button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </TabsContent>

        {/* ----- Walk windows ----- */}
        <TabsContent value="windows" className="mt-4 space-y-4">
          <Card className="border border-border p-4 shadow-soft">
            <h3 className="font-display text-base text-primary">{winForm.id ? "Edit walk window" : "Add walk window"}</h3>
            <p className="text-xs text-muted-foreground">Walk-style services use named windows (Morning, Midday, etc.) instead of fixed slots.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,1fr,auto,auto,auto,auto,auto] sm:items-end">
              <div>
                <Label>Walk type</Label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={winForm.serviceId} onChange={(e) => setWinForm({ ...winForm, serviceId: e.target.value })}>
                  <option value="">Select…</option>
                  {walkServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><Label>Label</Label><Input value={winForm.label} onChange={(e) => setWinForm({ ...winForm, label: e.target.value })} placeholder="Morning" /></div>
              <div>
                <Label>Day</Label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={winForm.weekday} onChange={(e) => setWinForm({ ...winForm, weekday: Number(e.target.value) })}>
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div><Label>Start</Label><Input type="time" value={winForm.start} onChange={(e) => setWinForm({ ...winForm, start: e.target.value })} /></div>
              <div><Label>End</Label><Input type="time" value={winForm.end} onChange={(e) => setWinForm({ ...winForm, end: e.target.value })} /></div>
              <div><Label>Capacity</Label><Input type="number" min={1} value={winForm.maxBookings} onChange={(e) => setWinForm({ ...winForm, maxBookings: Math.max(1, Number(e.target.value) || 1) })} /></div>
              <div className="flex gap-2">
                <Button onClick={saveWindow}><Plus className="h-4 w-4" /> {winForm.id ? "Save" : "Add"}</Button>
                {winForm.id && <Button variant="ghost" onClick={() => setWinForm((c) => ({ ...c, id: "", label: "Morning", start: "09:00", end: "11:00", maxBookings: 4 }))}>Cancel</Button>}
              </div>
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            {walkServices.map((service) => {
              const list = windows.filter((w) => w.service_id === service.id);
              return (
                <Card key={service.id} className="border border-border p-4 shadow-soft">
                  <div className="flex items-center gap-2"><Users className="h-4 w-4 text-clay" /><h4 className="font-display text-sm text-primary">{service.name}</h4></div>
                  {list.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No windows yet.</p> : (
                    <ul className="mt-2 space-y-2">
                      {list.map((w) => (
                        <li key={w.id} className="rounded-md border border-border bg-card px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <button onClick={() => setWinForm({ id: w.id, serviceId: w.service_id, weekday: w.weekday, label: w.window_label, start: minutesToTime24(w.start_minute), end: minutesToTime24(w.end_minute), maxBookings: w.max_bookings })} className="text-left">
                              <div className="font-display text-xs uppercase text-primary">{DAYS[w.weekday]} · {w.window_label}</div>
                              <div className="text-xs text-muted-foreground">{minutesToTime(w.start_minute)}–{minutesToTime(w.end_minute)}</div>
                            </button>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setWinForm({ id: w.id, serviceId: w.service_id, weekday: w.weekday, label: w.window_label, start: minutesToTime24(w.start_minute), end: minutesToTime24(w.end_minute), maxBookings: w.max_bookings })}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                              <button onClick={() => removeWindow(w.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                            <span>Capacity</span>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => updateWindowCapacity(w.id, w.max_bookings - 1)}><Minus className="h-3.5 w-3.5" /></button>
                              <span className="font-display text-primary">{w.max_bookings}</span>
                              <button onClick={() => updateWindowCapacity(w.id, w.max_bookings + 1)}><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ----- Blocked dates ----- */}
        <TabsContent value="blocked" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="border border-border p-4 shadow-soft">
            <h3 className="font-display text-base text-primary">Block a date</h3>
            <div className="mt-3 rounded-md border border-border bg-card">
              <Calendar mode="single" selected={blockDate} onSelect={setBlockDate} disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))} className="p-3 pointer-events-auto" />
            </div>
            <div className="mt-3 space-y-3">
              <div><Label>Reason (optional)</Label><Input value={blockReason} maxLength={100} onChange={(e) => setBlockReason(e.target.value)} placeholder="Vacation, vet, family day…" /></div>
              <Button onClick={addBlocked} disabled={!blockDate}><CalendarOff className="h-4 w-4" /> Block date</Button>
            </div>
          </Card>

          <Card className="border border-border p-4 shadow-soft">
            <h3 className="font-display text-base text-primary">Current closures</h3>
            {blocked.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No blocked dates.</p> : (
              <ul className="mt-3 space-y-2">
                {blocked.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                    <span className="text-sm">
                      <span className="font-display uppercase text-primary">{format(new Date(`${b.blocked_date}T12:00:00`), "EEE, MMM d")}</span>
                      {b.reason && <span className="ml-2 text-muted-foreground">— {b.reason}</span>}
                    </span>
                    <button onClick={() => removeBlocked(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </SettingsLayout>
  );
}
