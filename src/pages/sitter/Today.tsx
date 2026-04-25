import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarPlus, CalendarCheck, CreditCard, Inbox as InboxIcon, MessageSquarePlus, AlertTriangle, Clock3, LogIn, LogOut } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { KpiTile } from "@/components/sitter/KpiTile";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCents } from "@/lib/invoices";
import { toast } from "@/hooks/use-toast";

type TodayBooking = {
  id: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  start_at: string;
  end_at: string;
  status: string;
  pets: { name: string } | null;
  services: { name: string; slug: string | null } | null;
};

type UpdateKind = "pickup" | "dropoff" | "arrived" | "departed";

const kindLabel: Record<UpdateKind, string> = {
  pickup: "Pickup",
  dropoff: "Drop-off",
  arrived: "Arrived",
  departed: "Left",
};

const kindToast: Record<UpdateKind, string> = {
  pickup: "Picked up ✓",
  dropoff: "Dropped off ✓",
  arrived: "Arrival sent ✓",
  departed: "Departure sent ✓",
};

// Choose the two transition events appropriate for each service type.
// - Walks (solo, group, dog walking): Anneke picks the pet up from home and drops them back off → pickup / dropoff
// - Pet sitting (in client's home): Anneke arrives at the client's home and later leaves → arrived / departed
// - Boarding: the client drops the pet off with Anneke and later picks them back up → dropoff / pickup
//   (from the client's perspective these are still drop-off and pick-up events, just inverted in time)
// - Training, meet & greet: in-person session at the client's home → arrived / departed
const eventsForSlug = (slug: string | null | undefined): [UpdateKind, UpdateKind] | null => {
  switch (slug) {
    case "walk":
    case "solo-walk":
    case "group-walk":
      return ["pickup", "dropoff"];
    case "sitting":
    case "training":
    case "meet-and-greet":
      return ["arrived", "departed"];
    case "boarding":
      return ["dropoff", "pickup"];
    default:
      return null;
  }
};

type InboxItem = {
  kind: "request" | "approval";
  id: string;
  title: string;
  subtitle: string;
};

export default function SitterToday() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayBookings, setTodayBookings] = useState<TodayBooking[]>([]);
  const [inboxPreview, setInboxPreview] = useState<InboxItem[]>([]);
  const [outstandingCents, setOutstandingCents] = useState(0);
  const [overdueCents, setOverdueCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updateTarget, setUpdateTarget] = useState<{ booking: TodayBooking; kind: UpdateKind } | null>(null);
  const [updateNote, setUpdateNote] = useState("");
  const [sending, setSending] = useState(false);

  const sendQuickUpdate = async (booking: TodayBooking, kind: UpdateKind, note?: string) => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-booking-update", {
      body: { bookingId: booking.id, kind, note: note?.trim() || undefined, sendSms: true },
    });
    setSending(false);
    if (error) {
      toast({ title: "Couldn't send update", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: kindToast[kind], description: data?.message ?? "Update sent." });
    setUpdateTarget(null);
    setUpdateNote("");
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      const sitterId = user.id;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const [bookingsRes, requestsRes, approvalsRes, invoicesRes] = await Promise.all([
        supabase.from("bookings")
          .select("id, scheduled_start_at, scheduled_end_at, start_at, end_at, status, pets(name), services(name, slug)")
          .eq("sitter_id", sitterId)
          .gte("start_at", start.toISOString())
          .lte("start_at", end.toISOString())
          .not("status", "in", "(cancelled,refunded)")
          .order("start_at", { ascending: true }),
        supabase.from("bookings")
          .select("id, customer_id, services(name), pets(name), requested_date, requested_window_label")
          .eq("sitter_id", sitterId).eq("status", "requested")
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("pet_fit_alerts")
          .select("id, title, message, pet_id, pets:pet_id(name)")
          .eq("is_resolved", false).order("created_at", { ascending: false }).limit(5),
        supabase.from("invoices")
          .select("total_cents, amount_paid_cents, due_date, status")
          .eq("sitter_id", sitterId)
          .in("status", ["sent", "overdue", "partial"]),
      ]);

      if (cancelled) return;

      setTodayBookings((bookingsRes.data ?? []) as any);

      const inbox: InboxItem[] = [];
      for (const r of (requestsRes.data ?? []) as any[]) {
        const when = r.requested_date ? format(new Date(r.requested_date), "MMM d") : "Date TBD";
        inbox.push({
          kind: "request",
          id: r.id,
          title: `New request: ${r.services?.name ?? "Service"} for ${r.pets?.name ?? "pet"}`,
          subtitle: `${when}${r.requested_window_label ? ` · ${r.requested_window_label}` : ""}`,
        });
      }
      for (const a of (approvalsRes.data ?? []) as any[]) {
        inbox.push({
          kind: "approval",
          id: a.id,
          title: `Pet approval: ${a.title}`,
          subtitle: a.pets?.name ?? "Pet review needed",
        });
      }
      setInboxPreview(inbox.slice(0, 5));

      let outstanding = 0;
      let overdue = 0;
      const todayMs = Date.now();
      for (const inv of (invoicesRes.data ?? []) as any[]) {
        const owed = (inv.total_cents ?? 0) - (inv.amount_paid_cents ?? 0);
        outstanding += owed;
        if (inv.due_date && new Date(inv.due_date + "T23:59:59").getTime() < todayMs) overdue += owed;
      }
      setOutstandingCents(outstanding);
      setOverdueCents(overdue);
      setLoading(false);
    };

    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user?.id]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <SitterShell
      action={
        <>
          <Button size="sm" variant="outline" asChild><Link to="/sitter/calendar"><CalendarPlus className="mr-1.5 h-4 w-4" />New booking</Link></Button>
          <Button size="sm" asChild><Link to="/sitter/invoices"><CreditCard className="mr-1.5 h-4 w-4" />New invoice</Link></Button>
        </>
      }
    >
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary sm:text-4xl">{greeting}</h1>
        <p className="text-sm text-muted-foreground">Here's your day at a glance — {format(new Date(), "EEEE, MMM d")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Today's visits" value={loading ? "—" : todayBookings.length} icon={<CalendarCheck className="h-5 w-5" />} />
        <KpiTile label="Outstanding" value={loading ? "—" : formatCents(outstandingCents)} icon={<CreditCard className="h-5 w-5" />} tone="warning" />
        <KpiTile label="Overdue" value={loading ? "—" : formatCents(overdueCents)} icon={<AlertTriangle className="h-5 w-5" />} tone={overdueCents > 0 ? "danger" : "default"} />
        <KpiTile label="Inbox" value={loading ? "—" : inboxPreview.length} icon={<InboxIcon className="h-5 w-5" />} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="border border-border p-5 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-primary">Today's run of show</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/sitter/calendar">Open calendar →</Link></Button>
          </div>
          {todayBookings.length === 0 ? (
            <EmptyState
              icon={<Clock3 className="h-8 w-8" />}
              title="Nothing scheduled today"
              description="Enjoy the quiet, or block off the day in your availability settings."
            />
          ) : (
            <ul className="divide-y divide-border">
              {todayBookings.map((b) => {
                const startAt = new Date(b.scheduled_start_at ?? b.start_at);
                const endAt = new Date(b.scheduled_end_at ?? b.end_at);
                const events = eventsForSlug(b.services?.slug);
                const [startEvent, endEvent] = events ?? [];
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="w-16 text-right">
                      <div className="font-display text-sm text-primary">{format(startAt, "h:mm a")}</div>
                      <div className="text-[11px] text-muted-foreground">{format(endAt, "h:mm a")}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{b.services?.name ?? "Service"}</div>
                      <div className="truncate text-xs text-muted-foreground">{b.pets?.name ?? "Pet"}</div>
                    </div>
                    <Badge variant="outline" className="capitalize">{b.status.replace(/_/g, " ")}</Badge>
                    <div className="flex items-center gap-1">
                      {events ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={(e) => { e.preventDefault(); sendQuickUpdate(b, startEvent!); }}
                            onContextMenu={(e) => { e.preventDefault(); setUpdateTarget({ booking: b, kind: startEvent! }); }}
                            disabled={sending}
                            title={`One-click ${kindLabel[startEvent!].toLowerCase()}. Right-click to add a note.`}
                          >
                            <LogIn className="mr-1 h-3.5 w-3.5" /> {kindLabel[startEvent!]}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={(e) => { e.preventDefault(); sendQuickUpdate(b, endEvent!); }}
                            onContextMenu={(e) => { e.preventDefault(); setUpdateTarget({ booking: b, kind: endEvent! }); }}
                            disabled={sending}
                            title={`One-click ${kindLabel[endEvent!].toLowerCase()}. Right-click to add a note.`}
                          >
                            <LogOut className="mr-1 h-3.5 w-3.5" /> {kindLabel[endEvent!]}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-muted-foreground"
                            onClick={() => setUpdateTarget({ booking: b, kind: startEvent! })}
                            disabled={sending}
                            title="Send with a note"
                          >
                            + note
                          </Button>
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">No status updates for this service</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="border border-border p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-primary">Needs your attention</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/sitter/inbox">Open inbox →</Link></Button>
          </div>
          {inboxPreview.length === 0 ? (
            <EmptyState
              icon={<InboxIcon className="h-7 w-7" />}
              title="Inbox zero"
              description="No requests or approvals waiting."
            />
          ) : (
            <ul className="space-y-2">
              {inboxPreview.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <button
                    onClick={() => navigate("/sitter/inbox")}
                    className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="capitalize">{item.kind}</Badge>
                    </div>
                    <div className="mt-2 text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 border border-border p-5 shadow-soft">
        <h2 className="mb-3 font-display text-xl text-primary">Quick actions</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button variant="outline" className="justify-start" asChild><Link to="/sitter/calendar"><CalendarPlus className="mr-2 h-4 w-4" />New booking</Link></Button>
          <Button variant="outline" className="justify-start" asChild><Link to="/sitter/invoices"><CreditCard className="mr-2 h-4 w-4" />New invoice</Link></Button>
          <Button variant="outline" className="justify-start" asChild><Link to="/sitter/messages"><MessageSquarePlus className="mr-2 h-4 w-4" />Message a client</Link></Button>
          <Button variant="outline" className="justify-start" asChild><Link to="/sitter/settings/availability">Block a date</Link></Button>
        </div>
      </Card>

      <Dialog open={!!updateTarget} onOpenChange={(open) => { if (!open) { setUpdateTarget(null); setUpdateNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {updateTarget?.kind === "pickup" ? "Send pickup update" : "Send drop-off update"}
            </DialogTitle>
            <DialogDescription>
              Sends a text and email to {updateTarget?.booking.pets?.name ?? "the pet"}'s owner. Add an optional note for anything important.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quick-note">Optional note</Label>
            <Textarea
              id="quick-note"
              value={updateNote}
              onChange={(e) => setUpdateNote(e.target.value)}
              placeholder=""
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUpdateTarget(null); setUpdateNote(""); }} disabled={sending}>
              Cancel
            </Button>
            <Button
              onClick={() => updateTarget && sendQuickUpdate(updateTarget.booking, updateTarget.kind, updateNote)}
              disabled={sending}
            >
              {sending ? "Sending…" : "Send update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SitterShell>
  );
}
