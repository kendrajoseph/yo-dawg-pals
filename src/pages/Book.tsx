import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, PawPrint, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAYS, formatPriceWithDecimals, minutesToTime } from "@/lib/booking";

type Service = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  unit_label: string | null;
  payment_mode: "full" | "deposit" | "free";
  stripe_price_id: string | null;
};

type Pet = { id: string; name: string; breed: string | null; photo_url: string | null };
type Avail = { id: string; sitter_id: string; weekday: number; start_minute: number; end_minute: number };
type AvailService = { availability_id: string; service_id: string };
type Blocked = { sitter_id: string; blocked_date: string };
type Booking = {
  sitter_id: string;
  start_at: string;
  end_at: string;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  status: string;
};
type WalkWindow = {
  id: string;
  sitter_id: string;
  service_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  window_label: string;
  sort_order: number;
};

const STEPS = ["Service", "Schedule", "Pet", "Review"] as const;
const WALK_REQUEST_SLUGS = new Set(["solo-walk", "group-walk"]);

const Book = () => {
  const db = supabase as any;
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const presetSlug = params.get("service");

  const [services, setServices] = useState<Service[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [availability, setAvailability] = useState<Avail[]>([]);
  const [availServices, setAvailServices] = useState<AvailService[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [existing, setExisting] = useState<Booking[]>([]);
  const [walkWindows, setWalkWindows] = useState<WalkWindow[]>([]);
  const [sitterId, setSitterId] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [slot, setSlot] = useState<number | null>(null);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: a }, { data: bd }, { data: avs }, { data: ww }] = await Promise.all([
        db.from("services").select("*").eq("is_active", true).order("sort_order"),
        db.from("availability").select("id, sitter_id, weekday, start_minute, end_minute"),
        db.from("blocked_dates").select("sitter_id, blocked_date"),
        db.from("availability_services").select("availability_id, service_id"),
        db
          .from("walk_windows")
          .select("id, sitter_id, service_id, weekday, start_minute, end_minute, window_label, sort_order")
          .order("sort_order"),
      ]);

      setServices((s ?? []) as Service[]);
      setAvailability((a ?? []) as Avail[]);
      setBlocked((bd ?? []) as Blocked[]);
      setAvailServices((avs ?? []) as AvailService[]);
      setWalkWindows((ww ?? []) as WalkWindow[]);

      const sid = (a ?? [])[0]?.sitter_id ?? (ww ?? [])[0]?.sitter_id ?? null;
      setSitterId(sid);

      if (sid) {
        const { data: bk } = await db
          .from("bookings")
          .select("sitter_id, start_at, end_at, scheduled_start_at, scheduled_end_at, status")
          .eq("sitter_id", sid)
          .in("status", ["pending_payment", "awaiting_payment", "confirmed", "requested"]);
        setExisting((bk ?? []) as Booking[]);
      }

      if (presetSlug && s) {
        const found = s.find((x: Service) => x.slug === presetSlug);
        if (found) setServiceId(found.id);
      }
    })();
  }, [db, presetSlug]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, name, breed, photo_url")
        .eq("owner_id", user.id)
        .order("created_at");
      setPets((data ?? []) as Pet[]);
    })();
  }, [user]);

  const service = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [serviceId, services]);
  const isWalkRequest = !!service && WALK_REQUEST_SLUGS.has(service.slug);
  const isGroupWalk = service?.slug === "group-walk";
  const isSoloWalk = service?.slug === "solo-walk";

  const slotServiceMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of availServices) {
      if (!map.has(row.availability_id)) map.set(row.availability_id, new Set());
      map.get(row.availability_id)?.add(row.service_id);
    }
    return map;
  }, [availServices]);

  const availabilityForService = useMemo(() => {
    if (!service) return availability;
    return availability.filter((row) => slotServiceMap.get(row.id)?.has(service.id));
  }, [availability, service, slotServiceMap]);

  const walkWindowsForService = useMemo(() => {
    if (!service) return [];
    return walkWindows
      .filter((row) => row.service_id === service.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.start_minute - b.start_minute);
  }, [service, walkWindows]);

  const windowOptions = useMemo(() => {
    if (!date || !service || !isWalkRequest || !sitterId) return [];
    return walkWindowsForService.filter((row) => row.sitter_id === sitterId && row.weekday === date.getDay());
  }, [date, isWalkRequest, service, sitterId, walkWindowsForService]);

  const selectedWindow = useMemo(() => windowOptions.find((row) => row.id === windowId) ?? null, [windowId, windowOptions]);

  const slots = useMemo<number[]>(() => {
    if (!date || !service || !sitterId || isWalkRequest) return [];
    const weekday = date.getDay();
    const dayBlocks = availabilityForService.filter((row) => row.sitter_id === sitterId && row.weekday === weekday);
    if (dayBlocks.length === 0) return [];

    const isBlockedDay = blocked.some(
      (row) => row.sitter_id === sitterId && isSameDay(new Date(`${row.blocked_date}T12:00:00`), date),
    );
    if (isBlockedDay) return [];

    const duration = service.duration_minutes;
    const output: number[] = [];

    for (const block of dayBlocks) {
      for (let minute = block.start_minute; minute + duration <= block.end_minute; minute += 30) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const slotStart = new Date(start.getTime() + minute * 60_000);
        const slotEnd = new Date(slotStart.getTime() + duration * 60_000);
        if (slotStart.getTime() < Date.now() + 60 * 60_000) continue;

        const conflict = existing.some((booking) => {
          const bookingStart = new Date(booking.scheduled_start_at ?? booking.start_at).getTime();
          const bookingEnd = new Date(booking.scheduled_end_at ?? booking.end_at).getTime();
          return slotStart.getTime() < bookingEnd && slotEnd.getTime() > bookingStart;
        });

        if (!conflict) output.push(minute);
      }
    }

    return output;
  }, [availabilityForService, blocked, date, existing, isWalkRequest, service, sitterId]);

  const computePaymentAmount = (svc: Service) => {
    if (svc.payment_mode === "free") return 0;
    if (svc.payment_mode === "full") return svc.price_cents;
    return Math.round(svc.price_cents * 0.25);
  };

  const getDayDisabled = (day: Date) => {
    const today = startOfDay(new Date());
    if (day < today) return true;
    if (day > addDays(today, 60)) return true;
    if (!sitterId || !service) return true;

    const isBlockedDay = blocked.some(
      (row) => row.sitter_id === sitterId && isSameDay(new Date(`${row.blocked_date}T12:00:00`), day),
    );
    if (isBlockedDay) return true;

    if (isWalkRequest) {
      return !walkWindowsForService.some((row) => row.sitter_id === sitterId && row.weekday === day.getDay());
    }

    return !availabilityForService.some((row) => row.sitter_id === sitterId && row.weekday === day.getDay());
  };

  const next = () => {
    if (step === 0 && !serviceId) return toast({ title: "Pick a service", variant: "destructive" });
    if (step === 1 && !date) return toast({ title: "Pick a date", variant: "destructive" });
    if (step === 1 && isWalkRequest && !selectedWindow) {
      return toast({ title: "Choose a preferred window", variant: "destructive" });
    }
    if (step === 1 && !isWalkRequest && slot === null) {
      return toast({ title: "Pick a time", variant: "destructive" });
    }
    if (step === 2 && !petId) return toast({ title: "Pick a pet", variant: "destructive" });
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const back = () => setStep((current) => Math.max(current - 1, 0));

  const sendRequestReceivedEmail = async (bookingId: string) => {
    const { error } = await db.functions.invoke("booking-workflow", {
      body: { action: "request_received", bookingId },
    });
    if (error) console.warn("request email failed", error);
  };

  const submit = async () => {
    if (!user || !service || !date || !sitterId || !petId) return;
    if (isWalkRequest && !selectedWindow) return;
    if (!isWalkRequest && slot === null) return;

    setSubmitting(true);

    const depositCents = service.payment_mode === "deposit"
      ? Math.round(service.price_cents * 0.25)
      : service.payment_mode === "full"
      ? service.price_cents
      : 0;

    let bookingPayload: Record<string, unknown>;

    if (isWalkRequest && selectedWindow) {
      const requestStart = new Date(date);
      requestStart.setHours(0, 0, 0, 0);

      const startAt = new Date(requestStart.getTime() + selectedWindow.start_minute * 60_000).toISOString();
      const endAt = new Date(requestStart.getTime() + selectedWindow.end_minute * 60_000).toISOString();

      bookingPayload = {
        customer_id: user.id,
        sitter_id: sitterId,
        pet_id: petId,
        service_id: service.id,
        start_at: startAt,
        end_at: endAt,
        total_cents: service.price_cents,
        deposit_cents: depositCents,
        payment_amount_cents: computePaymentAmount(service),
        notes: notes || null,
        status: isSoloWalk ? "pending_payment" : "requested",
        booking_kind: "requested",
        requested_date: format(date, "yyyy-MM-dd"),
        requested_window_label: selectedWindow.window_label,
        requested_window_start_minute: selectedWindow.start_minute,
        requested_window_end_minute: selectedWindow.end_minute,
      };
    } else {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const startAt = new Date(dayStart.getTime() + (slot ?? 0) * 60_000).toISOString();
      const endAt = new Date(dayStart.getTime() + ((slot ?? 0) + service.duration_minutes) * 60_000).toISOString();

      bookingPayload = {
        customer_id: user.id,
        sitter_id: sitterId,
        pet_id: petId,
        service_id: service.id,
        start_at: startAt,
        end_at: endAt,
        scheduled_start_at: startAt,
        scheduled_end_at: endAt,
        total_cents: service.price_cents,
        deposit_cents: depositCents,
        payment_amount_cents: computePaymentAmount(service),
        notes: notes || null,
        status: "pending_payment",
        booking_kind: "instant",
      };
    }

    const { data, error } = await db.from("bookings").insert(bookingPayload).select("id").single();
    setSubmitting(false);

    if (error || !data?.id) {
      toast({ title: "Couldn't book", description: error?.message ?? "Please try again.", variant: "destructive" });
      return;
    }

    if (isWalkRequest) {
      await sendRequestReceivedEmail(data.id);
      if (isGroupWalk) {
        navigate(`/booking/${data.id}/success`);
        return;
      }
    }

    navigate(`/booking/${data.id}/checkout`);
  };

  useEffect(() => {
    if (!authLoading && !user && step >= 2) {
      navigate("/auth", { state: { from: `${location.pathname}${location.search}` } });
    }
  }, [authLoading, location.pathname, location.search, navigate, step, user]);

  useEffect(() => {
    setSlot(null);
    setWindowId(null);
    setDate(undefined);
  }, [serviceId]);

  const reviewCopy = (() => {
    if (!service) return "";
    if (isGroupWalk) {
      return "No payment yet — Anneke reviews fit, sets the exact walk time, and sends your payment link once the group is ready.";
    }
    if (isSoloWalk) {
      return "Payment holds your request now, then Anneke confirms the exact solo walk time afterward.";
    }
    if (service.payment_mode === "free") {
      return "No payment needed — your meet & greet will be confirmed instantly.";
    }
    if (service.payment_mode === "full") {
      return "Full payment is collected at booking. Free cancellation up to 24h before your service.";
    }
    return "A 25% deposit is collected now to lock in your slot. Balance is due after the service. Free cancellation up to 24h before.";
  })();

  const submitLabel = !service
    ? "Continue"
    : isGroupWalk
    ? "Submit request"
    : service.payment_mode === "free"
    ? "Book now"
    : "Continue to payment";

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <span className="inline-block -rotate-2 font-tag text-2xl text-tag">lock it in</span>
        <h1 className="font-display text-5xl text-primary sm:text-6xl spray-glow">
          Book a <span className="text-gradient-sunrise">service.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          Meet & greets, sits, and boarding book with exact times. Solo and group walks start with a request window so Anneke can make the final call on timing and compatibility.
        </p>

        <ol className="mt-6 grid grid-cols-4 gap-2">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={cn(
                "border-2 border-primary px-2 py-2 text-center font-display text-xs uppercase tracking-tight transition-all",
                index < step
                  ? "bg-secondary text-secondary-foreground shadow-pop"
                  : index === step
                  ? "-rotate-1 bg-accent text-accent-foreground shadow-pop-sm"
                  : "bg-card text-muted-foreground",
              )}
            >
              <span className="hidden sm:inline">{index + 1}. </span>
              {label}
            </li>
          ))}
        </ol>

        {isWalkRequest && (
          <div className="mt-6 border-2 border-primary bg-highlight px-4 py-3 text-sm text-highlight-foreground shadow-pop-sm">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {isSoloWalk
                  ? "Premium one-on-one walk. Choose your preferred window and Anneke will confirm the exact time after payment."
                  : "Choose your preferred group-walk window. Anneke matches compatible dogs, sets the final timing, and only then asks for payment."}
              </p>
            </div>
          </div>
        )}

        <Card className="mt-6 border-4 border-primary p-5 shadow-pop-lg sm:p-6">
          {step === 0 && (
            <div>
              <h2 className="font-display text-2xl uppercase">Pick a service</h2>
              <RadioGroup value={serviceId ?? ""} onValueChange={setServiceId} className="mt-4 grid gap-3">
                {services.map((svc) => (
                  <label
                    key={svc.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 border-2 border-primary p-4 transition-colors",
                      serviceId === svc.id ? "bg-highlight" : "bg-card hover:bg-muted",
                    )}
                  >
                    <RadioGroupItem value={svc.id} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-display text-xl uppercase">{svc.name}</span>
                        <span className="font-display text-2xl text-clay">
                          {formatPriceWithDecimals(svc.price_cents)}
                          <span className="ml-1 text-xs opacity-70">{svc.unit_label}</span>
                        </span>
                      </div>
                      <p className="text-sm text-foreground/75">{svc.description}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {svc.duration_minutes} min
                      </p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-display text-2xl uppercase">{isWalkRequest ? "Pick a date & preferred window" : "Pick a date & time"}</h2>
              {!sitterId && <p className="mt-3 text-sm text-clay">No availability is set yet — check back soon.</p>}
              <div className="mt-4 grid gap-6 md:grid-cols-[auto,1fr]">
                <div className="border-2 border-primary bg-card">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(nextDate) => {
                      setDate(nextDate);
                      setSlot(null);
                      setWindowId(null);
                    }}
                    disabled={getDayDisabled}
                    className={cn("pointer-events-auto p-3")}
                  />
                </div>
                <div>
                  <p className="font-display text-sm uppercase text-muted-foreground">
                    {date ? format(date, "EEEE, MMM d") : "Select a date"}
                  </p>

                  {isWalkRequest ? (
                    <>
                      <p className="mt-2 max-w-md text-sm text-foreground/75">
                        {isSoloWalk
                          ? "Solo requests happen around Anneke's group blocks, so you pick the window and she confirms the final exact time."
                          : "Group walks are matched thoughtfully — pick the window you prefer and Anneke decides the final group and exact timing."}
                      </p>
                      {date && windowOptions.length === 0 && (
                        <p className="mt-2 text-sm text-clay">No request windows are open for this day.</p>
                      )}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {windowOptions.map((window) => {
                          const active = windowId === window.id;
                          return (
                            <button
                              key={window.id}
                              type="button"
                              onClick={() => setWindowId(window.id)}
                              className={cn(
                                "border-2 border-primary p-3 text-left transition-all",
                                active ? "bg-tag text-tag-foreground shadow-pop-accent" : "bg-card hover:-translate-y-0.5 hover:bg-muted",
                              )}
                            >
                              <div className="font-display text-base uppercase">{window.window_label}</div>
                              <div className={cn("mt-1 text-xs", active ? "text-tag-foreground/80" : "text-muted-foreground")}>
                                {minutesToTime(window.start_minute)}–{minutesToTime(window.end_minute)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      {date && slots.length === 0 && <p className="mt-2 text-sm text-clay">No times open this day.</p>}
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((minute) => (
                          <button
                            key={minute}
                            type="button"
                            onClick={() => setSlot(minute)}
                            className={cn(
                              "border-2 border-primary px-2 py-2 font-display text-xs uppercase transition-all",
                              slot === minute
                                ? "-translate-y-0.5 bg-tag text-tag-foreground shadow-pop-accent"
                                : "bg-card hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground",
                            )}
                          >
                            {minutesToTime(minute)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-2xl uppercase">Who's coming?</h2>
              {pets.length === 0 ? (
                <Card className="mt-4 -rotate-1 border-2 border-primary bg-highlight p-6 text-center shadow-pop">
                  <PawPrint className="mx-auto h-8 w-8 text-clay" />
                  <p className="mt-2 font-tag text-xl text-clay">no pets on file yet</p>
                  <Button asChild className="mt-3 font-display uppercase">
                    <Link to="/account/pets">Add a pet</Link>
                  </Button>
                </Card>
              ) : (
                <RadioGroup value={petId ?? ""} onValueChange={setPetId} className="mt-4 grid gap-3 sm:grid-cols-2">
                  {pets.map((pet) => (
                    <label
                      key={pet.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 border-2 border-primary p-3",
                        petId === pet.id ? "bg-highlight" : "bg-card hover:bg-muted",
                      )}
                    >
                      <RadioGroupItem value={pet.id} />
                      <div className="h-12 w-12 overflow-hidden border-2 border-primary bg-muted">
                        {pet.photo_url ? (
                          <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center">
                            <PawPrint className="h-5 w-5 opacity-40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-display text-lg uppercase leading-tight">{pet.name}</div>
                        <div className="text-xs text-muted-foreground">{pet.breed}</div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}
              <div className="mt-5">
                <Label>Notes for your sitter (optional)</Label>
                <Textarea
                  rows={3}
                  maxLength={500}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Anything we should know — leashes, food times, meds, harnesses, building access."
                />
              </div>
            </div>
          )}

          {step === 3 && service && date && petId && (isWalkRequest ? !!selectedWindow : slot !== null) && (
            <div>
              <h2 className="font-display text-2xl uppercase">Review</h2>
              <dl className="mt-4 divide-y-2 divide-primary/15 border-2 border-primary bg-card text-sm">
                <Row label="Service" value={service.name} />
                <Row
                  label={isWalkRequest ? "Preferred window" : "When"}
                  value={
                    isWalkRequest && selectedWindow
                      ? `${format(date, "EEE, MMM d")} · ${selectedWindow.window_label}`
                      : `${format(date, "EEE, MMM d")} · ${minutesToTime(slot ?? 0)}`
                  }
                />
                <Row
                  label={isWalkRequest ? "Window range" : "Duration"}
                  value={
                    isWalkRequest && selectedWindow
                      ? `${minutesToTime(selectedWindow.start_minute)}–${minutesToTime(selectedWindow.end_minute)}`
                      : `${service.duration_minutes} min`
                  }
                />
                <Row label="Pet" value={pets.find((pet) => pet.id === petId)?.name ?? ""} />
                <Row label="Total" value={formatPriceWithDecimals(service.price_cents)} />
                {isGroupWalk ? (
                  <Row label="Due now" value="No payment yet" accent />
                ) : service.payment_mode === "deposit" ? (
                  <Row label="Due now (25% deposit)" value={formatPriceWithDecimals(computePaymentAmount(service))} accent />
                ) : service.payment_mode === "full" ? (
                  <Row label="Due now" value={formatPriceWithDecimals(computePaymentAmount(service))} accent />
                ) : (
                  <Row label="Due now" value="Free" accent />
                )}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">{reviewCopy}</p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} className="bg-accent font-display uppercase text-accent-foreground shadow-pop-sm transition-transform hover:-translate-y-0.5">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting} className="bg-tag font-display uppercase text-tag-foreground shadow-pop-accent transition-transform hover:-translate-y-0.5">
                {submitting ? "Saving…" : <>{submitLabel} <Check className="h-4 w-4" /></>}
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-6 inline-flex -rotate-1 items-center gap-2 font-tag text-lg text-tag">
          <CalendarDays className="h-4 w-4" /> showing the next 60 days · schedule controlled by Anneke
        </p>
      </section>
      <SiteFooter />
    </main>
  );
};

const Row = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={cn("flex items-center justify-between p-3", accent && "bg-highlight")}>
    <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className={cn("font-display text-base uppercase", accent && "text-clay text-lg")}>{value}</dd>
  </div>
);

export default Book;
