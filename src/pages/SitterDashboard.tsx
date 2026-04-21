import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Check, X, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DAYS, formatBookingDateTime, formatPriceWithDecimals,
  minutesToTime, STATUS_LABELS, STATUS_STYLES, timeToMinutes,
} from "@/lib/booking";

type Avail = { id: string; weekday: number; start_minute: number; end_minute: number };
type Blocked = { id: string; blocked_date: string; reason: string | null };
type Booking = {
  id: string; start_at: string; end_at: string; status: string;
  total_cents: number; deposit_cents: number;
  notes: string | null;
  services: { name: string } | null;
  pets: { name: string } | null;
  profiles: { full_name: string | null } | null;
};

const SitterDashboard = () => {
  const { user } = useAuth();
  const [avail, setAvail] = useState<Avail[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [newAvail, setNewAvail] = useState({ weekday: 1, start: "09:00", end: "17:00" });
  const [blockDate, setBlockDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");

  const load = async () => {
    if (!user) return;
    const [{ data: a }, { data: b }, { data: bk }] = await Promise.all([
      supabase.from("availability").select("*").eq("sitter_id", user.id).order("weekday"),
      supabase.from("blocked_dates").select("*").eq("sitter_id", user.id).order("blocked_date"),
      supabase.from("bookings")
        .select("id, start_at, end_at, status, total_cents, deposit_cents, notes, services(name), pets(name), profiles!bookings_customer_id_fkey(full_name)")
        .eq("sitter_id", user.id).order("start_at", { ascending: true }),
    ]);
    setAvail((a ?? []) as Avail[]);
    setBlocked((b ?? []) as Blocked[]);
    setBookings((bk ?? []) as unknown as Booking[]);
  };
  useEffect(() => { load(); }, [user]);

  const addAvail = async () => {
    if (!user) return;
    const start = timeToMinutes(newAvail.start);
    const end = timeToMinutes(newAvail.end);
    if (end <= start) return toast({ title: "End must be after start", variant: "destructive" });
    const { error } = await supabase.from("availability").insert({
      sitter_id: user.id, weekday: newAvail.weekday, start_minute: start, end_minute: end,
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Availability added" }); load(); }
  };

  const removeAvail = async (id: string) => {
    const { error } = await supabase.from("availability").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else load();
  };

  const addBlocked = async () => {
    if (!user || !blockDate) return;
    const dateStr = format(blockDate, "yyyy-MM-dd");
    const { error } = await supabase.from("blocked_dates").insert({
      sitter_id: user.id, blocked_date: dateStr, reason: blockReason || null,
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { setBlockReason(""); setBlockDate(undefined); load(); }
  };

  const removeBlocked = async (id: string) => {
    await supabase.from("blocked_dates").delete().eq("id", id);
    load();
  };

  const updateBookingStatus = async (id: string, status: "pending_payment" | "confirmed" | "cancelled" | "completed" | "refunded") => {
    const patch: { status: typeof status; paid_at?: string } = { status };
    if (status === "confirmed") patch.paid_at = new Date().toISOString();
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: `Booking ${status}` }); load(); }
  };

  const grouped = useMemo(() => {
    const upcoming = bookings.filter((b) => new Date(b.start_at) > new Date());
    const past = bookings.filter((b) => new Date(b.start_at) <= new Date());
    return { upcoming, past };
  }, [bookings]);

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
        <span className="font-tag text-2xl text-clay -rotate-2 inline-block">control room</span>
        <h1 className="font-display text-5xl text-primary sm:text-6xl">Sitter dashboard.</h1>

        {/* Bookings */}
        <h2 className="mt-10 font-display text-2xl uppercase text-primary">Upcoming bookings</h2>
        {grouped.upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing booked yet.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {grouped.upcoming.map((b) => (
              <article key={b.id} className="border-4 border-primary bg-card p-4 shadow-pop">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xl uppercase">{b.services?.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[b.status] ?? ""}`}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">
                      {formatBookingDateTime(b.start_at)} · {b.profiles?.full_name ?? "Customer"} ·{" "}
                      <span className="font-tag text-lg text-clay">{b.pets?.name}</span>
                    </p>
                    {b.notes && <p className="mt-1 text-xs text-muted-foreground">"{b.notes}"</p>}
                  </div>
                  <div className="flex gap-2">
                    {b.status === "pending_payment" && (
                      <Button size="sm" onClick={() => updateBookingStatus(b.id, "confirmed")}
                        className="bg-secondary font-display uppercase">
                        <Check className="h-4 w-4" /> Confirm
                      </Button>
                    )}
                    {b.status !== "cancelled" && b.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => updateBookingStatus(b.id, "cancelled")}
                        className="border-2 border-primary font-display uppercase">
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    )}
                    {b.status === "confirmed" && (
                      <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(b.id, "completed")}
                        className="font-display uppercase">
                        Mark done
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Availability */}
        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Weekly availability</h2>
        <Card className="mt-3 border-4 border-primary p-4 shadow-pop sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr,auto,auto,auto] sm:items-end">
            <div>
              <Label>Day</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newAvail.weekday}
                onChange={(e) => setNewAvail({ ...newAvail, weekday: Number(e.target.value) })}
              >
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={newAvail.start} onChange={(e) => setNewAvail({ ...newAvail, start: e.target.value })} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={newAvail.end} onChange={(e) => setNewAvail({ ...newAvail, end: e.target.value })} />
            </div>
            <Button onClick={addAvail} className="bg-primary font-display uppercase shadow-pop-accent">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          {avail.length > 0 ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {avail.map((a) => (
                <li key={a.id} className="flex items-center justify-between border-2 border-primary bg-muted px-3 py-2">
                  <span className="text-sm">
                    <span className="font-display uppercase">{DAYS[a.weekday]}</span> · {minutesToTime(a.start_minute)}–{minutesToTime(a.end_minute)}
                  </span>
                  <button onClick={() => removeAvail(a.id)} aria-label="Remove">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No availability yet — customers can't book until you add some.</p>
          )}
        </Card>

        {/* Blocked dates */}
        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Blocked days</h2>
        <Card className="mt-3 border-4 border-primary p-4 shadow-pop sm:p-5">
          <div className="grid gap-4 md:grid-cols-[auto,1fr]">
            <div className="border-2 border-primary bg-card">
              <Calendar mode="single" selected={blockDate} onSelect={setBlockDate}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                className={cn("p-3 pointer-events-auto")} />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={blockReason} maxLength={100} onChange={(e) => setBlockReason(e.target.value)} placeholder="Vacation, vet, etc." />
              <Button onClick={addBlocked} disabled={!blockDate} className="mt-3 bg-primary font-display uppercase shadow-pop-accent">
                <CalendarOff className="h-4 w-4" /> Block date
              </Button>

              {blocked.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {blocked.map((b) => (
                    <li key={b.id} className="flex items-center justify-between border-2 border-primary bg-muted px-3 py-2">
                      <span className="text-sm">
                        <span className="font-display uppercase">{format(new Date(b.blocked_date + "T12:00:00"), "EEE, MMM d")}</span>
                        {b.reason && <span className="ml-2 text-muted-foreground">— {b.reason}</span>}
                      </span>
                      <button onClick={() => removeBlocked(b.id)} aria-label="Remove">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        {/* Past */}
        {grouped.past.length > 0 && (
          <>
            <h2 className="mt-12 font-display text-2xl uppercase text-primary">Past bookings</h2>
            <ul className="mt-3 space-y-2">
              {grouped.past.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-primary bg-card px-3 py-2 text-sm">
                  <span>{formatBookingDateTime(b.start_at)} · {b.services?.name} · {b.pets?.name}</span>
                  <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[b.status] ?? ""}`}>
                    {STATUS_LABELS[b.status] ?? b.status}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <Link to="/account" className="mt-10 inline-block font-tag text-clay text-xl -rotate-1">← back to account</Link>
      </section>
      <SiteFooter />
    </main>
  );
};

export default SitterDashboard;
