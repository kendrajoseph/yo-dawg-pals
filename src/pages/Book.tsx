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
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, MoonStar, PawPrint, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAYS, formatPriceWithDecimals, minutesToTime } from "@/lib/booking";

type ServiceVariant = {
  id: string;
  service_id: string;
  slug: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  unit_label: string | null;
  payment_mode: "full" | "deposit" | "free";
  sort_order: number;
};

type Service = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scheduling_mode: "instant" | "request" | "boarding";
  approval_required: boolean;
  requires_pet_approval: boolean;
  turnaround_buffer_minutes: number;
  extra_time_fee_cents: number | null;
  extra_time_increment_minutes: number | null;
  late_pickup_fee_cents: number | null;
  boarding_checkin_minute: number | null;
  boarding_checkout_minute: number | null;
  max_capacity: number;
  variants: ServiceVariant[];
};

type Pet = { id: string; name: string; breed: string | null; photo_url: string | null };
type Avail = { id: string; sitter_id: string; weekday: number; start_minute: number; end_minute: number; max_bookings: number };
type AvailService = { availability_id: string; service_id: string };
type Blocked = { sitter_id: string; blocked_date: string };
type Booking = {
  sitter_id: string;
  booking_kind: string;
  requested_date?: string | null;
  requested_window_label?: string | null;
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
  max_bookings: number;
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
  const [variantId, setVariantId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [slot, setSlot] = useState<number | null>(null);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: serviceRows }, { data: variantRows }, { data: a }, { data: bd }, { data: avs }, { data: ww }] = await Promise.all([
        db
          .from("services")
          .select(
            "id, slug, name, description, scheduling_mode, approval_required, requires_pet_approval, turnaround_buffer_minutes, extra_time_fee_cents, extra_time_increment_minutes, late_pickup_fee_cents, boarding_checkin_minute, boarding_checkout_minute, max_capacity",
          )
          .eq("is_active", true)
          .order("sort_order"),
        db
          .from("service_variants")
          .select("id, service_id, slug, name, duration_minutes, price_cents, unit_label, payment_mode, sort_order")
          .eq("is_active", true)
          .order("sort_order"),
        db.from("availability").select("id, sitter_id, weekday, start_minute, end_minute, max_bookings"),
        db.from("blocked_dates").select("sitter_id, blocked_date"),
        db.from("availability_services").select("availability_id, service_id"),
        db
          .from("walk_windows")
          .select("id, sitter_id, service_id, weekday, start_minute, end_minute, window_label, sort_order, max_bookings")
          .order("sort_order"),
      ]);

      const variantsByService = new Map<string, ServiceVariant[]>();
      for (const row of (variantRows ?? []) as ServiceVariant[]) {
        if (!variantsByService.has(row.service_id)) variantsByService.set(row.service_id, []);
        variantsByService.get(row.service_id)?.push(row);
      }

      const nextServices = ((serviceRows ?? []) as Omit<Service, "variants">[]).map((row) => ({
        ...row,
        variants: (variantsByService.get(row.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
      }));

      setServices(nextServices);
      setAvailability((a ?? []) as Avail[]);
      setBlocked((bd ?? []) as Blocked[]);
      setAvailServices((avs ?? []) as AvailService[]);
      setWalkWindows((ww ?? []) as WalkWindow[]);

      const sid = (a ?? [])[0]?.sitter_id ?? (ww ?? [])[0]?.sitter_id ?? null;
      setSitterId(sid);

      if (sid) {
        const { data: bk } = await db
          .from("bookings")
          .select("sitter_id, booking_kind, requested_date, requested_window_label, start_at, end_at, scheduled_start_at, scheduled_end_at, status")
          .eq("sitter_id", sid)
          .in("status", ["pending_payment", "awaiting_payment", "confirmed", "requested"]);
        setExisting((bk ?? []) as Booking[]);
      }

      if (presetSlug && nextServices.length > 0) {
        const foundService = nextServices.find((service) => service.slug === presetSlug || service.variants.some((variant) => variant.slug === presetSlug));
        if (foundService) {
          setServiceId(foundService.id);
          const foundVariant = foundService.variants.find((variant) => variant.slug === presetSlug) ?? foundService.variants[0] ?? null;
          setVariantId(foundVariant?.id ?? null);
          return;
        }
      }

      if (!serviceId && nextServices.length > 0) {
        setServiceId(nextServices[0].id);
        setVariantId(nextServices[0].variants[0]?.id ?? null);
      }
    })();
  }, [db, presetSlug]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("pets").select("id, name, breed, photo_url").eq("owner_id", user.id).order("created_at");
      setPets((data ?? []) as Pet[]);
    })();
  }, [user]);

  const service = useMemo(() => services.find((item) => item.id === serviceId) ?? null, [serviceId, services]);
  const selectedVariant = useMemo(() => service?.variants.find((item) => item.id === variantId) ?? service?.variants[0] ?? null, [service, variantId]);
  const isWalkWindowRequest = !!service && WALK_REQUEST_SLUGS.has(service.slug);
  const isBoarding = service?.scheduling_mode === "boarding" || service?.slug === "boarding";
  const isRequestFlow = Boolean(service && (service.scheduling_mode === "request" || service.scheduling_mode === "boarding" || service.approval_required));
  const usesExactSlots = Boolean(service && !isWalkWindowRequest && !isBoarding);

  useEffect(() => {
    if (!service) return;
    if (!selectedVariant) {
      setVariantId(service.variants[0]?.id ?? null);
      return;
    }
    if (!service.variants.some((item) => item.id === selectedVariant.id)) {
      setVariantId(service.variants[0]?.id ?? null);
    }
  }, [selectedVariant, service]);

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
    if (!date || !service || !isWalkWindowRequest || !sitterId) return [];
    return walkWindowsForService.filter((row) => row.sitter_id === sitterId && row.weekday === date.getDay());
  }, [date, isWalkWindowRequest, service, sitterId, walkWindowsForService]);

  const selectedWindow = useMemo(() => windowOptions.find((row) => row.id === windowId) ?? null, [windowId, windowOptions]);

  const requestCountByWindow = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of existing) {
      if (!booking.requested_date || !booking.requested_window_label || booking.status === "cancelled") continue;
      const key = `${booking.requested_date}-${booking.requested_window_label}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [existing]);

  const slots = useMemo<number[]>(() => {
    if (!date || !service || !selectedVariant || !sitterId || !usesExactSlots) return [];
    const weekday = date.getDay();
    const dayBlocks = availabilityForService.filter((row) => row.sitter_id === sitterId && row.weekday === weekday);
    if (dayBlocks.length === 0) return [];

    const isBlockedDay = blocked.some((row) => row.sitter_id === sitterId && isSameDay(new Date(`${row.blocked_date}T12:00:00`), date));
    if (isBlockedDay) return [];

    const duration = selectedVariant.duration_minutes;
    const bufferMinutes = Math.max(service.turnaround_buffer_minutes ?? 0, 30);
    const output: number[] = [];

    for (const block of dayBlocks) {
      for (let minute = block.start_minute; minute + duration <= block.end_minute; minute += 30) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const slotStart = new Date(start.getTime() + minute * 60_000);
        const slotEnd = new Date(slotStart.getTime() + duration * 60_000);
        if (slotStart.getTime() < Date.now() + 60 * 60_000) continue;

        const overlapping = existing.filter((booking) => {
          const bookingStart = new Date(booking.scheduled_start_at ?? booking.start_at).getTime() - bufferMinutes * 60_000;
          const bookingEnd = new Date(booking.scheduled_end_at ?? booking.end_at).getTime() + bufferMinutes * 60_000;
          return slotStart.getTime() < bookingEnd && slotEnd.getTime() > bookingStart;
        }).length;

        if (overlapping < Math.max(block.max_bookings ?? 1, 1)) output.push(minute);
      }
    }

    return output;
  }, [availabilityForService, blocked, date, existing, selectedVariant, service, sitterId, usesExactSlots]);

  const computePaymentAmount = (priceCents: number, paymentMode: ServiceVariant["payment_mode"]) => {
    if (paymentMode === "free") return 0;
    if (paymentMode === "full") return priceCents;
    return Math.round(priceCents * 0.25);
  };

  const getDayDisabled = (day: Date) => {
    const today = startOfDay(new Date());
    if (day < today) return true;
    if (day > addDays(today, 60)) return true;
    if (!sitterId || !service) return true;

    const isBlockedDay = blocked.some((row) => row.sitter_id === sitterId && isSameDay(new Date(`${row.blocked_date}T12:00:00`), day));
    if (isBlockedDay) return true;

    if (isBoarding) return false;
    if (isWalkWindowRequest) {
      return !walkWindowsForService.some((row) => row.sitter_id === sitterId && row.weekday === day.getDay());
    }
    return !availabilityForService.some((row) => row.sitter_id === sitterId && row.weekday === day.getDay());
  };

  const next = () => {
    if (step === 0 && (!serviceId || !selectedVariant)) return toast({ title: "Pick a service option", variant: "destructive" });
    if (step === 1 && !date) return toast({ title: "Pick a date", variant: "destructive" });
    if (step === 1 && isWalkWindowRequest && !selectedWindow) return toast({ title: "Choose a preferred window", variant: "destructive" });
    if (step === 1 && usesExactSlots && slot === null) return toast({ title: "Pick a time", variant: "destructive" });
    if (step === 2 && !petId) return toast({ title: "Pick a pet", variant: "destructive" });
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const back = () => setStep((current) => Math.max(current - 1, 0));

  const submit = async () => {
    if (!user || !service || !selectedVariant || !date || !sitterId || !petId) return;
    if (isWalkWindowRequest && !selectedWindow) return;
    if (usesExactSlots && slot === null) return;

    setSubmitting(true);

    const totalCents = selectedVariant.price_cents;
    const dueNow = computePaymentAmount(totalCents, selectedVariant.payment_mode);
    const depositCents = selectedVariant.payment_mode === "deposit" ? dueNow : selectedVariant.payment_mode === "full" ? totalCents : 0;

    let bookingPayload: Record<string, unknown>;

    if (isWalkWindowRequest && selectedWindow) {
      const requestStart = new Date(date);
      requestStart.setHours(0, 0, 0, 0);

      const startAt = new Date(requestStart.getTime() + selectedWindow.start_minute * 60_000).toISOString();
      const endAt = new Date(requestStart.getTime() + selectedWindow.end_minute * 60_000).toISOString();
      const requestCountKey = `${format(date, "yyyy-MM-dd")}-${selectedWindow.window_label}`;
      if ((requestCountByWindow.get(requestCountKey) ?? 0) >= Math.max(selectedWindow.max_bookings ?? 1, 1)) {
        setSubmitting(false);
        toast({ title: "That window just filled up", description: "Choose another window and try again.", variant: "destructive" });
        return;
      }

      bookingPayload = {
        customer_id: user.id,
        sitter_id: sitterId,
        pet_id: petId,
        service_id: service.id,
        service_variant_id: selectedVariant.id,
        start_at: startAt,
        end_at: endAt,
        total_cents: totalCents,
        base_price_cents: totalCents,
        deposit_cents: depositCents,
        payment_amount_cents: dueNow,
        notes: notes || null,
        status: "requested",
        booking_kind: "requested",
        requested_date: format(date, "yyyy-MM-dd"),
        requested_window_label: selectedWindow.window_label,
        requested_window_start_minute: selectedWindow.start_minute,
        requested_window_end_minute: selectedWindow.end_minute,
      };
    } else if (isBoarding) {
      const checkinMinute = service.boarding_checkin_minute ?? 12 * 60;
      const checkoutMinute = service.boarding_checkout_minute ?? 12 * 60;
      const startAt = new Date(date);
      startAt.setHours(0, 0, 0, 0);
      startAt.setMinutes(checkinMinute);
      const endAt = new Date(addDays(date, 1));
      endAt.setHours(0, 0, 0, 0);
      endAt.setMinutes(checkoutMinute);

      bookingPayload = {
        customer_id: user.id,
        sitter_id: sitterId,
        pet_id: petId,
        service_id: service.id,
        service_variant_id: selectedVariant.id,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        total_cents: totalCents,
        base_price_cents: totalCents,
        deposit_cents: depositCents,
        payment_amount_cents: dueNow,
        notes: notes || null,
        status: "requested",
        booking_kind: "requested",
        requested_date: format(date, "yyyy-MM-dd"),
        requested_window_label: "Noon to noon",
        requested_window_start_minute: checkinMinute,
        requested_window_end_minute: checkoutMinute,
      };
    } else {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const startAt = new Date(dayStart.getTime() + (slot ?? 0) * 60_000).toISOString();
      const endAt = new Date(dayStart.getTime() + ((slot ?? 0) + selectedVariant.duration_minutes) * 60_000).toISOString();
      const basePayload = {
        customer_id: user.id,
        sitter_id: sitterId,
        pet_id: petId,
        service_id: service.id,
        service_variant_id: selectedVariant.id,
        start_at: startAt,
        end_at: endAt,
        total_cents: totalCents,
        base_price_cents: totalCents,
        deposit_cents: depositCents,
        payment_amount_cents: dueNow,
        notes: notes || null,
      };

      bookingPayload = {
        ...basePayload,
        status: "requested",
        booking_kind: "requested",
        requested_date: format(date, "yyyy-MM-dd"),
        requested_window_label: `${minutesToTime(slot ?? 0)}–${minutesToTime((slot ?? 0) + selectedVariant.duration_minutes)}`,
        requested_window_start_minute: slot,
        requested_window_end_minute: (slot ?? 0) + selectedVariant.duration_minutes,
      };
    }

    const { data, error } = await db.from("bookings").insert(bookingPayload).select("id").single();
    setSubmitting(false);

    if (error || !data?.id) {
      toast({ title: "Couldn't book", description: error?.message ?? "Please try again.", variant: "destructive" });
      return;
    }

    navigate(`/booking/${data.id}/success`);
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
    setVariantId(service?.variants[0]?.id ?? null);
  }, [serviceId]);

  const reviewCopy = (() => {
    if (!service || !selectedVariant) return "";
    if (isBoarding) {
      return `Boarding is fixed from 12pm to 12pm. Extended hours need Anneke's approval first, and approved extra time or late pickup is billed at ${formatPriceWithDecimals(service.extra_time_fee_cents ?? 0)} per ${(service.extra_time_increment_minutes ?? 30)} minutes.`;
    }
    if (isWalkWindowRequest) {
      return service.slug === "group-walk"
        ? "Anneke reviews dog fit, group compatibility, and the final hour block before she opens payment."
        : "Anneke reviews the request, your dog’s fit, and the final solo time before she opens payment.";
    }
    if (isRequestFlow) {
      return `Anneke reviews this request before it is confirmed. ${service.requires_pet_approval ? "Pet approval is part of the review." : ""}`.trim();
    }
    if (selectedVariant.payment_mode === "free") return "Anneke still confirms the final fit and timing first, then the visit is locked in without payment.";
    if (selectedVariant.payment_mode === "full") return "Anneke confirms the match and final time first, then payment opens to lock the booking in.";
    return "Anneke confirms the match and final time first, then payment opens and the booking is locked in.";
  })();

  const submitLabel = !service || !selectedVariant ? "Continue" : "Send request";

  const feeSummary = service && selectedVariant ? [
    service.turnaround_buffer_minutes ? `${service.turnaround_buffer_minutes}-minute buffer built in` : null,
    service.extra_time_fee_cents && service.extra_time_increment_minutes
      ? `${formatPriceWithDecimals(service.extra_time_fee_cents)} / ${service.extra_time_increment_minutes} min add-on`
      : null,
    service.late_pickup_fee_cents ? `${formatPriceWithDecimals(service.late_pickup_fee_cents)} late pickup fee` : null,
  ].filter(Boolean).join(" · ") : "";

  const serviceSubtitle = service && selectedVariant
    ? isBoarding
      ? `Check-in ${minutesToTime(service.boarding_checkin_minute ?? 12 * 60)} · checkout ${minutesToTime(service.boarding_checkout_minute ?? 12 * 60)} next day`
      : `${selectedVariant.duration_minutes} min${feeSummary ? ` · ${feeSummary}` : ""}`
    : "";

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <span className="inline-block -rotate-2 font-tag text-2xl text-tag">lock it in</span>
        <h1 className="font-display text-5xl text-primary sm:text-6xl spray-glow">
          Book a <span className="text-gradient-sunrise">service.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          Each service now follows its own timing rules, approval flow, and pricing so Anneke can keep the calendar tight and the care quality high.
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

        {service && selectedVariant && isRequestFlow && (
          <div className="mt-6 border-2 border-primary bg-highlight px-4 py-3 text-sm text-highlight-foreground shadow-pop-sm">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {isBoarding
                  ? "Boarding requests are reviewed manually. Anneke confirms fit, keeps boarding to noon-to-noon, and applies any approved add-on or late-pickup fees afterward."
                  : isWalkWindowRequest
                  ? "Request the window that fits best and Anneke will approve the dog, lock the final timing, and only then open payment."
                  : "Pick the date and preferred slot you want — Anneke approves the request before it becomes payable."}
              </p>
            </div>
          </div>
        )}

        <Card className="mt-6 border-4 border-primary p-5 shadow-pop-lg sm:p-6">
          {step === 0 && (
            <div>
              <h2 className="font-display text-2xl uppercase">Pick a service</h2>
              <div className="mt-4 grid gap-4">
                {services.map((svc) => {
                  const activeService = serviceId === svc.id;
                  return (
                    <div key={svc.id} className={cn("border-2 border-primary p-4 transition-colors", activeService ? "bg-highlight" : "bg-card")}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <RadioGroup value={serviceId ?? ""} onValueChange={setServiceId} className="w-full">
                          <div className="flex items-start gap-3">
                            <RadioGroupItem value={svc.id} className="mt-1" />
                            <div className="flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-display text-2xl uppercase">{svc.name}</span>
                                <span className="text-xs uppercase text-muted-foreground">
                                  {svc.approval_required ? "Manual review" : "Instant booking"}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-foreground/75">{svc.description}</p>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {svc.requires_pet_approval && <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Pet approval</span>}
                                {svc.scheduling_mode === "boarding" && <span className="inline-flex items-center gap-1"><MoonStar className="h-3.5 w-3.5" /> Noon to noon</span>}
                                {svc.turnaround_buffer_minutes > 0 && <span>{svc.turnaround_buffer_minutes}-minute buffer</span>}
                              </div>
                            </div>
                          </div>
                        </RadioGroup>
                      </label>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {svc.variants.map((variant) => {
                          const activeVariant = variantId === variant.id;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => {
                                setServiceId(svc.id);
                                setVariantId(variant.id);
                              }}
                              className={cn(
                                "border-2 border-primary p-3 text-left transition-all",
                                activeVariant ? "bg-tag text-tag-foreground shadow-pop-accent" : "bg-card hover:-translate-y-0.5 hover:bg-muted",
                              )}
                            >
                              <div className="font-display text-base uppercase">{variant.name}</div>
                              <div className={cn("mt-1 text-sm", activeVariant ? "text-tag-foreground/80" : "text-foreground/75")}>
                                {formatPriceWithDecimals(variant.price_cents)}
                                <span className="ml-1 text-xs opacity-70">{variant.unit_label}</span>
                              </div>
                              <div className={cn("mt-1 text-xs", activeVariant ? "text-tag-foreground/80" : "text-muted-foreground")}>
                                 {variant.duration_minutes >= 1440 ? "Overnight block" : `${variant.duration_minutes} minutes`} · {variant.payment_mode === "free" ? "No payment" : "Payment opens after Anneke approves"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && service && selectedVariant && (
            <div>
              <h2 className="font-display text-2xl uppercase">
                {isBoarding ? "Pick your drop-off day" : isWalkWindowRequest ? "Pick a day & preferred window" : "Pick a day & time"}
              </h2>
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
                  {serviceSubtitle && <p className="mt-2 max-w-xl text-sm text-foreground/75">{serviceSubtitle}</p>}

                  {isBoarding ? (
                    <div className="mt-4 border-2 border-primary bg-card p-4">
                      <div className="font-display text-lg uppercase text-primary">Boarding timing</div>
                      <p className="mt-2 text-sm text-foreground/75">
                        {date
                          ? `${format(date, "EEE, MMM d")} at ${minutesToTime(service.boarding_checkin_minute ?? 12 * 60)} → ${format(addDays(date, 1), "EEE, MMM d")} at ${minutesToTime(service.boarding_checkout_minute ?? 12 * 60)}`
                          : "Select a day to preview the noon-to-noon stay."}
                      </p>
                      <p className="mt-3 text-xs text-muted-foreground">Extended hours need prior approval. Approved extra time or late pickup is added afterward.</p>
                    </div>
                  ) : isWalkWindowRequest ? (
                    <>
                      {date && windowOptions.length === 0 && <p className="mt-3 text-sm text-clay">No request windows are open for this day.</p>}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {windowOptions.map((window) => {
                          const active = windowId === window.id;
                          const requestCount = requestCountByWindow.get(`${format(date ?? new Date(), "yyyy-MM-dd")}-${window.window_label}`) ?? 0;
                          const remaining = Math.max((window.max_bookings ?? 1) - requestCount, 0);
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
                              <div className={cn("mt-2 text-[11px] uppercase", active ? "text-tag-foreground/80" : "text-muted-foreground")}>
                                {remaining} spot{remaining === 1 ? "" : "s"} left in this block
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      {date && slots.length === 0 && <p className="mt-3 text-sm text-clay">No times open this day.</p>}
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
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

          {step === 2 && service && (
            <div>
              <h2 className="font-display text-2xl uppercase">Who's coming?</h2>
              {service.requires_pet_approval && (
                <div className="mt-3 border-2 border-primary bg-muted px-4 py-3 text-sm text-foreground/75">
                  Anneke reviews pet fit for this service before the booking is confirmed.
                </div>
              )}
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
                <Label>Notes for Anneke (optional)</Label>
                <Textarea
                  rows={3}
                  maxLength={500}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Anything she should know — leash habits, meds, feeding rhythm, pickups, building access, social fit."
                />
              </div>
            </div>
          )}

          {step === 3 && service && selectedVariant && date && petId && (isBoarding || isWalkWindowRequest ? !!selectedWindow || isBoarding : slot !== null) && (
            <div>
              <h2 className="font-display text-2xl uppercase">Review</h2>
              <dl className="mt-4 divide-y-2 divide-primary/15 border-2 border-primary bg-card text-sm">
                <Row label="Service" value={selectedVariant.name} />
                <Row
                  label={isRequestFlow ? "Requested timing" : "When"}
                  value={
                    isBoarding
                      ? `${format(date, "EEE, MMM d")} ${minutesToTime(service.boarding_checkin_minute ?? 12 * 60)} → ${format(addDays(date, 1), "EEE, MMM d")} ${minutesToTime(service.boarding_checkout_minute ?? 12 * 60)}`
                      : isWalkWindowRequest && selectedWindow
                      ? `${format(date, "EEE, MMM d")} · ${selectedWindow.window_label}`
                      : `${format(date, "EEE, MMM d")} · ${minutesToTime(slot ?? 0)}`
                  }
                />
                <Row
                  label={isWalkWindowRequest ? "Window range" : "Duration"}
                  value={
                    isBoarding
                      ? "Noon to noon"
                      : isWalkWindowRequest && selectedWindow
                      ? `${minutesToTime(selectedWindow.start_minute)}–${minutesToTime(selectedWindow.end_minute)}`
                      : `${selectedVariant.duration_minutes} min`
                  }
                />
                <Row label="Pet" value={pets.find((pet) => pet.id === petId)?.name ?? ""} />
                <Row label="Base price" value={formatPriceWithDecimals(selectedVariant.price_cents)} />
                {feeSummary && <Row label="Fee rules" value={feeSummary} />}
                {isRequestFlow ? (
                  <Row label="Due now" value="Nothing until Anneke approves" accent />
                ) : selectedVariant.payment_mode === "deposit" ? (
                  <Row label="Due now (25% deposit)" value={formatPriceWithDecimals(computePaymentAmount(selectedVariant.price_cents, selectedVariant.payment_mode))} accent />
                ) : selectedVariant.payment_mode === "full" ? (
                  <Row label="Due now" value={formatPriceWithDecimals(computePaymentAmount(selectedVariant.price_cents, selectedVariant.payment_mode))} accent />
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
  <div className={cn("flex items-center justify-between gap-4 p-3", accent && "bg-highlight")}>
    <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className={cn("text-right font-display text-base uppercase", accent && "text-clay text-lg")}>{value}</dd>
  </div>
);

export default Book;
