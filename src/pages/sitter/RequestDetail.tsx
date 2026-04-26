import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, PawPrint, User as UserIcon, Clock, Tag } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { approveBooking, declineBooking, setPetServiceFit, type DeclineReasonCategory, type DeclineSuggestion } from "@/lib/approveBooking";
import { formatCents } from "@/lib/invoices";

type Booking = {
  id: string;
  customer_id: string;
  pet_id: string;
  service_id: string;
  status: string;
  booking_kind: string | null;
  requested_date: string | null;
  requested_end_date: string | null;
  requested_window_label: string | null;
  requested_window_start_minute: number | null;
  requested_window_end_minute: number | null;
  recurrence_label: string | null;
  request_group_label: string | null;
  request_group_id: string | null;
  notes: string | null;
  internal_notes: string | null;
  group_assignment_label: string | null;
  base_price_cents: number | null;
  total_cents: number | null;
  pets: { id: string; name: string; species: string; photo_url: string | null } | null;
  services: {
    id: string;
    name: string;
    slug: string;
    duration_minutes: number;
    price_cents: number;
    payment_mode: "full" | "deposit" | "free";
    requires_pet_approval: boolean;
    extra_time_fee_cents: number | null;
    extra_time_increment_minutes: number | null;
    late_pickup_fee_cents: number | null;
  } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

type FitDecision = { id: string; status: "pending" | "approved" | "declined"; notes: string | null };

const minutesToTime = (minutes: number | null | undefined, fallback = "09:00"): string => {
  if (minutes == null) return fallback;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const dollars = (cents: number) => (cents / 100).toFixed(2);

export default function SitterRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [fit, setFit] = useState<FitDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"approve" | "decline" | "fit-approve" | "fit-decline" | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineCategory, setDeclineCategory] = useState<DeclineReasonCategory | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSendEmail, setDeclineSendEmail] = useState(true);
  const [declineSendSms, setDeclineSendSms] = useState(false);
  // Alternative-time slots
  const [altSlots, setAltSlots] = useState<Array<{ date: string; label: string }>>([
    { date: "", label: "" },
  ]);
  // Alternative service
  const [altServiceSlug, setAltServiceSlug] = useState<string>("");

  // Editable approval form
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");
  const [priceDollars, setPriceDollars] = useState("0.00");
  const [extraMinutes, setExtraMinutes] = useState(0);
  const [latePickup, setLatePickup] = useState(false);
  const [groupLabel, setGroupLabel] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const reload = async () => {
    if (!id || !user?.id) return;
    setLoading(true);
    const { data: b, error: bErr } = await supabase
      .from("bookings")
      .select(
        "id, customer_id, pet_id, service_id, status, booking_kind, requested_date, requested_end_date, requested_window_label, requested_window_start_minute, requested_window_end_minute, recurrence_label, request_group_label, request_group_id, notes, internal_notes, group_assignment_label, base_price_cents, total_cents, pets(id, name, species, photo_url), services(id, name, slug, duration_minutes, price_cents, payment_mode, requires_pet_approval, extra_time_fee_cents, extra_time_increment_minutes, late_pickup_fee_cents)",
      )
      .eq("id", id)
      .eq("sitter_id", user.id)
      .maybeSingle();

    if (bErr) {
      console.error("[RequestDetail] booking fetch failed", bErr);
    }

    // profiles is not joined via FK on bookings.customer_id (which references auth.users),
    // so fetch the customer profile separately.
    let customerProfile: { full_name: string | null; phone: string | null } | null = null;
    if (b?.customer_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", b.customer_id)
        .maybeSingle();
      customerProfile = (p as any) ?? null;
    }

    setBooking(b ? ({ ...b, profiles: customerProfile } as any) : null);

    if (b?.pet_id && b?.service_id) {
      const { data: f } = await supabase
        .from("sitter_pet_approvals")
        .select("id, status, notes")
        .eq("sitter_id", user.id)
        .eq("pet_id", b.pet_id)
        .eq("service_id", b.service_id)
        .maybeSingle();
      setFit((f as any) ?? { id: "", status: "pending", notes: null });
    }
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  // Seed the form whenever a booking loads
  useEffect(() => {
    if (!booking) return;
    setDate(booking.requested_date ?? format(new Date(), "yyyy-MM-dd"));
    setEndDate(booking.requested_end_date ?? booking.requested_date ?? format(new Date(), "yyyy-MM-dd"));
    setStart(minutesToTime(booking.requested_window_start_minute, "09:00"));
    const fallbackEnd =
      booking.requested_window_end_minute ??
      (booking.requested_window_start_minute != null
        ? booking.requested_window_start_minute + (booking.services?.duration_minutes ?? 30)
        : null);
    setEnd(minutesToTime(fallbackEnd, "09:30"));
    setPriceDollars(dollars(booking.base_price_cents ?? booking.services?.price_cents ?? 0));
    setExtraMinutes(0);
    setLatePickup(false);
    setGroupLabel(booking.request_group_label ?? booking.group_assignment_label ?? "");
    setInternalNotes(booking.internal_notes ?? "");
  }, [booking]);

  const service = booking?.services;
  const requiresFit = !!service?.requires_pet_approval;
  const fitOk = !requiresFit || fit?.status === "approved";

  const computedFees = useMemo(() => {
    if (!service) return { extraFee: 0, lateFee: 0, total: 0 };
    const base = Math.round(parseFloat(priceDollars || "0") * 100) || 0;
    const extraFee =
      service.extra_time_fee_cents && service.extra_time_increment_minutes
        ? Math.ceil(extraMinutes / service.extra_time_increment_minutes) * service.extra_time_fee_cents
        : 0;
    const lateFee = latePickup ? service.late_pickup_fee_cents ?? 0 : 0;
    return { extraFee, lateFee, total: base + extraFee + lateFee, base };
  }, [service, priceDollars, extraMinutes, latePickup]);

  const handleApprove = async () => {
    if (!booking || !service || !user) return;
    if (requiresFit && fit?.status !== "approved") {
      toast({
        title: "Approve the pet for this service first",
        description: "This service requires a fit decision before the booking can be approved.",
        variant: "destructive",
      });
      return;
    }
    setWorking("approve");
    const result = await approveBooking({
      bookingId: booking.id,
      sitterId: user.id,
      serviceSlug: service.slug,
      serviceDurationMinutes: service.duration_minutes,
      paymentMode: service.payment_mode,
      date,
      startTime: start,
      endTime: end,
      endDate: service.slug === "boarding" ? endDate : undefined,
      approvedBasePriceCents: computedFees.base ?? 0,
      extraTimeMinutes: extraMinutes,
      extraTimeFeeCents: computedFees.extraFee,
      latePickupFeeCents: computedFees.lateFee,
      groupLabel: groupLabel || null,
      internalNotes: internalNotes || null,
      appUrl: window.location.origin,
    });
    setWorking(null);
    if (!result.ok) {
      toast({ title: "Couldn't approve", description: result.error, variant: "destructive" });
      return;
    }
    toast({
      title: result.status === "confirmed" ? "Request confirmed" : "Payment opened",
      description:
        result.notificationMessage ??
        (result.status === "confirmed" ? "Confirmation sent to the client." : "Payment alert sent to the client."),
    });
    navigate("/sitter/inbox");
  };

  const reasonLabelFor = (cat: DeclineReasonCategory | null): string | undefined => {
    switch (cat) {
      case "schedule_conflict": return "Schedule conflict";
      case "pack_full": return "Pack is full";
      case "service_mismatch": return "Different service would suit better";
      case "pet_not_ready": return "Pet isn't ready for this service";
      case "out_of_area": return "Outside service area";
      case "other": return "Other";
      default: return undefined;
    }
  };

  const followUpKind = (cat: DeclineReasonCategory | null): "times" | "service" | "none" => {
    if (cat === "schedule_conflict" || cat === "pack_full") return "times";
    if (cat === "service_mismatch" || cat === "pet_not_ready") return "service";
    return "none";
  };

  const recommendedServices = useMemo(() => {
    // Curated alternatives the sitter offers, excluding the requested service
    const all = [
      { slug: "solo-walk", name: "Solo Walk", hint: "1-on-1 attention, easier on reactive or anxious pups" },
      { slug: "group-walk", name: "Group Walk", hint: "Social pack walk for confident, well-socialised dogs" },
      { slug: "training", name: "Training", hint: "Work on leash skills, recall, or behaviour first" },
      { slug: "walk", name: "Dog Walking", hint: "Standard neighbourhood walk" },
      { slug: "sitting", name: "Pet Sitting", hint: "In-home visits instead of a walk" },
      { slug: "boarding", name: "Boarding", hint: "Overnight stay" },
      { slug: "meet-and-greet", name: "Meet & Greet", hint: "Free intro before booking the real thing" },
    ];
    return all.filter((s) => s.slug !== service?.slug);
  }, [service?.slug]);

  const buildSuggestion = (): DeclineSuggestion => {
    const kind = followUpKind(declineCategory);
    if (kind === "times") {
      const slots = altSlots
        .filter((s) => s.date.trim().length > 0)
        .map((s) => ({ date: s.date, label: s.label.trim() || undefined }));
      return slots.length ? { kind: "alternative_times", slots } : { kind: "none" };
    }
    if (kind === "service" && altServiceSlug) {
      const svc = recommendedServices.find((s) => s.slug === altServiceSlug);
      if (svc) {
        return {
          kind: "alternative_service",
          serviceSlug: svc.slug,
          serviceName: svc.name,
          explanation: declineReason.trim() || svc.hint,
        };
      }
    }
    return { kind: "none" };
  };

  const resetDecline = () => {
    setDeclineCategory(null);
    setDeclineReason("");
    setAltSlots([{ date: "", label: "" }]);
    setAltServiceSlug("");
    setDeclineSendEmail(true);
    setDeclineSendSms(false);
  };

  const handleDecline = async () => {
    if (!booking) return;
    if (!declineCategory) {
      toast({ title: "Pick a reason", description: "Choose what to tell the client.", variant: "destructive" });
      return;
    }
    setWorking("decline");
    const suggestion = buildSuggestion();
    const result = await declineBooking(booking.id, {
      reason: declineReason,
      reasonCategory: declineCategory,
      reasonLabel: reasonLabelFor(declineCategory),
      suggestion,
      sendEmail: declineSendEmail,
      sendSms: declineSendSms,
    });
    setWorking(null);
    if (!result.ok) {
      toast({ title: "Couldn't decline", description: result.error, variant: "destructive" });
      return;
    }
    const notes: string[] = [];
    if (declineSendEmail) notes.push(result.emailSent ? "Email sent." : (result.emailError || "Email not sent."));
    if (declineSendSms) notes.push(result.smsSent ? "SMS sent." : (result.smsError || "SMS not sent."));
    toast({
      title: "Request declined",
      description: notes.join(" ") || undefined,
    });
    setDeclineOpen(false);
    resetDecline();
    navigate("/sitter/inbox");
  };

  const handleFit = async (status: "approved" | "declined") => {
    if (!booking || !user) return;
    setWorking(status === "approved" ? "fit-approve" : "fit-decline");
    const r = await setPetServiceFit(user.id, booking.pet_id, booking.service_id, status,
      status === "approved" ? "Good fit for this service." : "Not a fit for this service right now.");
    setWorking(null);
    if (!r.ok) {
      toast({ title: "Couldn't save fit decision", description: r.error, variant: "destructive" });
      return;
    }
    toast({ title: status === "approved" ? "Pet approved for this service" : "Pet declined for this service" });
    void reload();
  };

  if (loading) {
    return (
      <SitterShell>
        <div className="p-6 text-sm text-muted-foreground">Loading request…</div>
      </SitterShell>
    );
  }

  if (!booking) {
    return (
      <SitterShell>
        <EmptyState
          title="Request not found"
          description="It may have been cancelled, declined, or already approved."
        />
        <div className="mt-4">
          <Button variant="outline" asChild><Link to="/sitter/inbox"><ArrowLeft className="mr-2 h-4 w-4" />Back to inbox</Link></Button>
        </div>
      </SitterShell>
    );
  }

  const isRequested = booking.status === "requested";

  return (
    <SitterShell>
      <Link to="/sitter/inbox" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />Back to inbox
      </Link>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-primary">Booking request</h1>
          <p className="text-sm text-muted-foreground">
            {booking.profiles?.full_name ?? "Client"} · {booking.services?.name ?? "Service"} for {booking.pets?.name ?? "pet"}
          </p>
        </div>
        <Badge variant={isRequested ? "secondary" : "outline"} className="capitalize">
          {booking.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Summary */}
      <Card className="mb-4 border border-border p-5 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Item icon={<UserIcon className="h-4 w-4" />} label="Client" value={booking.profiles?.full_name ?? "—"} />
          <Item icon={<PawPrint className="h-4 w-4" />} label="Pet" value={`${booking.pets?.name ?? "—"} (${booking.pets?.species ?? "—"})`} />
          <Item
            icon={<Clock className="h-4 w-4" />}
            label="Requested"
            value={
              booking.requested_date
                ? `${format(new Date(booking.requested_date), "EEE, MMM d, yyyy")}${booking.requested_window_label ? ` · ${booking.requested_window_label}` : ""}`
                : "Date TBD"
            }
          />
          <Item
            icon={<Tag className="h-4 w-4" />}
            label="Recurrence / group"
            value={booking.recurrence_label ?? booking.request_group_label ?? "Single visit"}
          />
        </div>
        {booking.notes && (
          <>
            <Separator className="my-4" />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Client notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{booking.notes}</p>
            </div>
          </>
        )}
      </Card>

      {/* Pet fit */}
      {requiresFit && (
        <Card className={`mb-4 border p-5 shadow-soft ${fitOk ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {fitOk ? <CheckCircle2 className="h-5 w-5 text-emerald-700" /> : <AlertTriangle className="h-5 w-5 text-amber-700" />}
              <div>
                <h3 className="font-display text-base text-primary">Pet fit decision</h3>
                <p className="text-sm text-foreground/80">
                  {fitOk
                    ? `${booking.pets?.name ?? "This pet"} is approved for ${booking.services?.name}.`
                    : `Decide whether ${booking.pets?.name ?? "this pet"} is a fit for ${booking.services?.name} before approving the request.`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFit("declined")}
                disabled={working === "fit-decline"}
              >
                <XCircle className="mr-1.5 h-4 w-4" />Decline fit
              </Button>
              <Button
                size="sm"
                onClick={() => handleFit("approved")}
                disabled={working === "fit-approve"}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />Approve fit
              </Button>
            </div>
          </div>
          <div className="mt-2">
            <Button variant="ghost" size="sm" asChild className="px-0 text-xs text-muted-foreground hover:text-foreground">
              <Link to={`/sitter/pets/${booking.pet_id}`}>Open full pet profile →</Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Approval form */}
      {isRequested ? (
        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-1 font-display text-lg text-primary">Approve & schedule</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Confirm the exact times, override the price if needed, and add any internal notes. The client gets the right notification automatically.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {service?.slug === "boarding" && (
              <Field label="End date">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            )}
            <Field label="Start">
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} disabled={service?.slug === "boarding"} />
            </Field>
            <Field label="End">
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={service?.slug === "boarding"} />
            </Field>
            <Field label="Approved base price (CAD)">
              <Input
                inputMode="decimal"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                placeholder="32.00"
              />
            </Field>
            {service?.extra_time_fee_cents ? (
              <Field label={`Extra minutes (+$${(service.extra_time_fee_cents / 100).toFixed(2)} per ${service.extra_time_increment_minutes ?? 1} min)`}>
                <Input
                  type="number"
                  min={0}
                  step={service.extra_time_increment_minutes ?? 1}
                  value={extraMinutes}
                  onChange={(e) => setExtraMinutes(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
            ) : null}
            {service?.late_pickup_fee_cents ? (
              <Field label="Late pickup fee">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={latePickup} onChange={(e) => setLatePickup(e.target.checked)} />
                  Apply ${(service.late_pickup_fee_cents / 100).toFixed(2)}
                </label>
              </Field>
            ) : null}
            {service?.slug === "group-walk" && (
              <Field label="Group / pack label">
                <Input value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} placeholder="e.g. Calm midday crew" />
              </Field>
            )}
            <div className="md:col-span-2">
              <Field label="Internal notes (only visible to you)">
                <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={3} />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3">
            <div className="text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
              <div className="font-display text-xl text-primary">{formatCents(computedFees.total)}</div>
              <div className="text-xs text-muted-foreground">
                Base {formatCents(computedFees.base ?? 0)}
                {computedFees.extraFee ? ` + extra ${formatCents(computedFees.extraFee)}` : ""}
                {computedFees.lateFee ? ` + late ${formatCents(computedFees.lateFee)}` : ""}
                {service?.payment_mode === "deposit" ? " · 25% deposit charged on approval" : ""}
                {service?.payment_mode === "free" ? " · no charge" : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { resetDecline(); setDeclineOpen(true); }} disabled={!!working}>
                <XCircle className="mr-1.5 h-4 w-4" />Decline
              </Button>
              <Button onClick={handleApprove} disabled={!!working || !fitOk}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {working === "approve" ? "Approving…" : service?.payment_mode === "free" ? "Confirm" : "Approve & open payment"}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border border-border p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">
            This booking is no longer in the requested state — it's now <span className="font-medium">{booking.status.replace(/_/g, " ")}</span>.
          </p>
          <div className="mt-3">
            <Button variant="outline" asChild>
              <Link to="/sitter/calendar">View on calendar</Link>
            </Button>
          </div>
        </Card>
      )}

      <Dialog open={declineOpen} onOpenChange={(o) => { if (!working) setDeclineOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this request?</DialogTitle>
            <DialogDescription>
              The booking will be cancelled. You can add an optional note explaining why — it'll be included in the message to the client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Reason (optional)</Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={4}
                maxLength={800}
                placeholder="e.g. The midday group is full that day. Try Thursday morning?"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notify client via</Label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={declineSendEmail}
                  onCheckedChange={(v) => setDeclineSendEmail(v === true)}
                />
                <span>Email</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={declineSendSms}
                  onCheckedChange={(v) => setDeclineSendSms(v === true)}
                />
                <span>SMS (only if client opted in)</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={!!working}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDecline} disabled={!!working}>
              {working === "decline" ? "Declining…" : "Decline request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SitterShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Item({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
