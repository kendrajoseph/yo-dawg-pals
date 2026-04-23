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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, MoonStar, PawPrint, Plus, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
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

type RepeatFrequency = "none" | "daily" | "weekly" | "biweekly" | "monthly";

type BundleItem = {
  id: string;
  serviceId: string | null;
  variantId: string | null;
  requestedDate: string;
  requestedEndDate: string;
  slot: number | null;
  windowId: string | null;
  petId: string | null;
  notes: string;
  repeatFrequency: RepeatFrequency;
  repeatDays: number[];
  repeatInterval: number;
};

const STEPS = ["Services", "Schedule", "Pet", "Review"] as const;
const WALK_REQUEST_SLUGS = new Set(["solo-walk", "group-walk"]);
const TERMS_VERSION = "2026-04-22";

const createBundleItem = (seed?: Partial<BundleItem>): BundleItem => ({
  id: crypto.randomUUID(),
  serviceId: null,
  variantId: null,
  requestedDate: "",
  requestedEndDate: "",
  slot: null,
  windowId: null,
  petId: null,
  notes: "",
  repeatFrequency: "none",
  repeatDays: [],
  repeatInterval: 1,
  ...seed,
});

const repeatLabelMap: Record<Exclude<RepeatFrequency, "none">, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

const getRepeatSummary = (item: BundleItem) => {
  if (item.repeatFrequency === "none") return null;

  if (item.repeatFrequency === "daily") {
    return item.repeatInterval > 1 ? `Every ${item.repeatInterval} days` : "Daily";
  }

  if (item.repeatFrequency === "monthly") {
    const day = item.requestedDate ? new Date(`${item.requestedDate}T12:00:00`).getDate() : null;
    return day ? `Monthly on day ${day}` : "Monthly";
  }

  const activeDays = item.repeatDays.length > 0 ? item.repeatDays : (item.requestedDate ? [new Date(`${item.requestedDate}T12:00:00`).getDay()] : []);
  const dayLabel = activeDays.length > 0 ? activeDays.map((day) => DAYS[day]).join(", ") : "selected days";
  return `${repeatLabelMap[item.repeatFrequency]} on ${dayLabel}`;
};

const getBundleSummary = ({
  item,
  service,
  variant,
  pet,
  selectedWindow,
}: {
  item: BundleItem;
  service: Service | null;
  variant: ServiceVariant | null;
  pet: Pet | undefined;
  selectedWindow: WalkWindow | null;
}) => {
  if (!service || !variant) return "Choose a service";
  if (!item.requestedDate) return `${variant.name} · no schedule yet`;

  const dayLabel = format(new Date(`${item.requestedDate}T12:00:00`), "EEE, MMM d");
  const timing = service.slug === "boarding"
    ? `${dayLabel} · ${minutesToTime(service.boarding_checkin_minute ?? 12 * 60)}`
    : WALK_REQUEST_SLUGS.has(service.slug) && selectedWindow
      ? `${dayLabel} · ${selectedWindow.window_label}`
      : item.slot != null
        ? `${dayLabel} · ${minutesToTime(item.slot)}`
        : `${dayLabel} · flexible`;

  const repeatSummary = getRepeatSummary(item);
  return [variant.name, timing, repeatSummary, pet?.name ? `for ${pet.name}` : null].filter(Boolean).join(" · ");
};

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
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [bundleNotes, setBundleNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
    })();
  }, [db]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("pets").select("id, name, breed, photo_url").eq("owner_id", user.id).order("created_at");
      setPets((data ?? []) as Pet[]);
    })();
  }, [user]);

  useEffect(() => {
    if (services.length === 0 || bundleItems.length > 0) return;

    const foundService = presetSlug
      ? services.find((service) => service.slug === presetSlug || service.variants.some((variant) => variant.slug === presetSlug))
      : null;
    const foundVariant = foundService
      ? foundService.variants.find((variant) => variant.slug === presetSlug) ?? foundService.variants[0] ?? null
      : null;

    const initialItem = createBundleItem({
      serviceId: foundService?.id ?? null,
      variantId: foundVariant?.id ?? null,
    });

    setBundleItems([initialItem]);
    setActiveItemId(initialItem.id);
  }, [bundleItems.length, presetSlug, services]);

  useEffect(() => {
    if (!activeItemId && bundleItems[0]) setActiveItemId(bundleItems[0].id);
    if (activeItemId && !bundleItems.some((item) => item.id === activeItemId)) {
      setActiveItemId(bundleItems[0]?.id ?? null);
    }
  }, [activeItemId, bundleItems]);

  useEffect(() => {
    if (!authLoading && !user && step >= 2) {
      navigate("/auth", { state: { from: `${location.pathname}${location.search}` } });
    }
  }, [authLoading, location.pathname, location.search, navigate, step, user]);

  const bundleItemMap = useMemo(() => new Map(bundleItems.map((item) => [item.id, item])), [bundleItems]);
  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const variantMap = useMemo(() => {
    const allVariants = services.flatMap((service) => service.variants);
    return new Map(allVariants.map((variant) => [variant.id, variant]));
  }, [services]);

  const slotServiceMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of availServices) {
      if (!map.has(row.availability_id)) map.set(row.availability_id, new Set());
      map.get(row.availability_id)?.add(row.service_id);
    }
    return map;
  }, [availServices]);

  const activeItem = activeItemId ? bundleItemMap.get(activeItemId) ?? null : bundleItems[0] ?? null;
  const activeService = activeItem?.serviceId ? serviceMap.get(activeItem.serviceId) ?? null : null;
  const activeVariant = activeItem?.variantId ? variantMap.get(activeItem.variantId) ?? null : activeService?.variants[0] ?? null;
  const activeDate = activeItem?.requestedDate ? new Date(`${activeItem.requestedDate}T12:00:00`) : undefined;
  const isActiveWalkWindowRequest = !!activeService && WALK_REQUEST_SLUGS.has(activeService.slug);
  const isActiveBoarding = activeService?.scheduling_mode === "boarding" || activeService?.slug === "boarding";
  const activeUsesExactSlots = Boolean(activeService && !isActiveWalkWindowRequest && !isActiveBoarding);

  const availabilityForActiveService = useMemo(() => {
    if (!activeService) return availability;
    return availability.filter((row) => slotServiceMap.get(row.id)?.has(activeService.id));
  }, [activeService, availability, slotServiceMap]);

  const walkWindowsForActiveService = useMemo(() => {
    if (!activeService) return [];
    return walkWindows
      .filter((row) => row.service_id === activeService.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.start_minute - b.start_minute);
  }, [activeService, walkWindows]);

  const activeWindowOptions = useMemo(() => {
    if (!activeDate || !activeService || !isActiveWalkWindowRequest || !sitterId) return [];
    return walkWindowsForActiveService.filter((row) => row.sitter_id === sitterId && row.weekday === activeDate.getDay());
  }, [activeDate, activeService, isActiveWalkWindowRequest, sitterId, walkWindowsForActiveService]);

  const activeSelectedWindow = useMemo(() => activeWindowOptions.find((row) => row.id === activeItem?.windowId) ?? null, [activeItem?.windowId, activeWindowOptions]);

  const requestCountByWindow = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of existing) {
      if (!booking.requested_date || !booking.requested_window_label || booking.status === "cancelled") continue;
      const key = `${booking.requested_date}-${booking.requested_window_label}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [existing]);

  const activeSlots = useMemo<number[]>(() => {
    if (!activeDate || !activeService || !activeVariant || !sitterId || !activeUsesExactSlots) return [];
    const weekday = activeDate.getDay();
    const dayBlocks = availabilityForActiveService.filter((row) => row.sitter_id === sitterId && row.weekday === weekday);
    if (dayBlocks.length === 0) return [];

    const isBlockedDay = blocked.some((row) => row.sitter_id === sitterId && isSameDay(new Date(`${row.blocked_date}T12:00:00`), activeDate));
    if (isBlockedDay) return [];

    const duration = activeVariant.duration_minutes;
    const bufferMinutes = Math.max(activeService.turnaround_buffer_minutes ?? 0, 30);
    const output: number[] = [];

    for (const block of dayBlocks) {
      for (let minute = block.start_minute; minute + duration <= block.end_minute; minute += 30) {
        const start = new Date(activeDate);
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
  }, [activeDate, activeService, activeUsesExactSlots, activeVariant, availabilityForActiveService, blocked, existing, sitterId]);

  const bundleSummaries = useMemo(
    () =>
      bundleItems.map((item) => {
        const service = item.serviceId ? serviceMap.get(item.serviceId) ?? null : null;
        const variant = item.variantId ? variantMap.get(item.variantId) ?? null : null;
        const pet = pets.find((candidate) => candidate.id === item.petId);
        const selectedWindow = walkWindows.find((window) => window.id === item.windowId) ?? null;
        return {
          item,
          service,
          variant,
          pet,
          selectedWindow,
          summary: getBundleSummary({ item, service, variant, pet, selectedWindow }),
        };
      }),
    [bundleItems, pets, serviceMap, variantMap, walkWindows],
  );

  const patchBundleItem = (itemId: string, patch: Partial<BundleItem>) => {
    setBundleItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const setServiceForItem = (itemId: string, nextServiceId: string) => {
    const nextService = serviceMap.get(nextServiceId);
    patchBundleItem(itemId, {
      serviceId: nextServiceId,
      variantId: nextService?.variants[0]?.id ?? null,
      requestedDate: "",
      requestedEndDate: "",
      slot: null,
      windowId: null,
      repeatFrequency: "none",
      repeatDays: [],
      repeatInterval: 1,
    });
  };

  const setVariantForItem = (itemId: string, nextVariantId: string) => {
    patchBundleItem(itemId, {
      variantId: nextVariantId,
      slot: null,
      windowId: null,
    });
  };

  const addBundleItem = () => {
    const nextItem = createBundleItem();
    setBundleItems((current) => [...current, nextItem]);
    setActiveItemId(nextItem.id);
  };

  const removeBundleItem = (itemId: string) => {
    if (bundleItems.length === 1) return;
    const nextItems = bundleItems.filter((item) => item.id !== itemId);
    setBundleItems(nextItems);
    if (activeItemId === itemId) setActiveItemId(nextItems[0]?.id ?? null);
  };

  const setRequestedDate = (itemId: string, nextDate?: Date) => {
    const dateValue = nextDate ? format(nextDate, "yyyy-MM-dd") : "";
    const weekday = nextDate?.getDay();
    const item = bundleItemMap.get(itemId);
    const nextRepeatDays = item?.repeatFrequency === "weekly" || item?.repeatFrequency === "biweekly"
      ? item.repeatDays.length > 0
        ? item.repeatDays
        : typeof weekday === "number"
          ? [weekday]
          : []
      : item?.repeatDays ?? [];

    patchBundleItem(itemId, {
      requestedDate: dateValue,
      requestedEndDate: item?.repeatFrequency === "none" ? "" : item?.requestedEndDate ?? "",
      repeatDays: nextRepeatDays,
      slot: null,
      windowId: null,
    });
  };

  const toggleRepeatDay = (itemId: string, weekday: number) => {
    const item = bundleItemMap.get(itemId);
    if (!item) return;
    const hasDay = item.repeatDays.includes(weekday);
    const nextDays = hasDay ? item.repeatDays.filter((day) => day !== weekday) : [...item.repeatDays, weekday].sort((a, b) => a - b);
    patchBundleItem(itemId, { repeatDays: nextDays });
  };

  const setRepeatFrequency = (itemId: string, value: RepeatFrequency) => {
    const item = bundleItemMap.get(itemId);
    if (!item) return;
    const dateWeekday = item.requestedDate ? new Date(`${item.requestedDate}T12:00:00`).getDay() : undefined;
    patchBundleItem(itemId, {
      repeatFrequency: value,
      repeatInterval: 1,
      requestedEndDate: value === "none" ? "" : item.requestedEndDate,
      repeatDays:
        value === "weekly" || value === "biweekly"
          ? item.repeatDays.length > 0
            ? item.repeatDays
            : typeof dateWeekday === "number"
              ? [dateWeekday]
              : []
          : [],
    });
  };

  const getDayDisabled = (day: Date) => {
    const today = startOfDay(new Date());
    if (day < today) return true;
    if (day > addDays(today, 120)) return true;
    if (!sitterId || !activeService) return true;

    const isBlockedDay = blocked.some((row) => row.sitter_id === sitterId && isSameDay(new Date(`${row.blocked_date}T12:00:00`), day));
    if (isBlockedDay) return true;

    if (isActiveBoarding) return false;
    if (isActiveWalkWindowRequest) {
      return !walkWindowsForActiveService.some((row) => row.sitter_id === sitterId && row.weekday === day.getDay());
    }
    return !availabilityForActiveService.some((row) => row.sitter_id === sitterId && row.weekday === day.getDay());
  };

  const validateServiceStep = () => {
    if (bundleItems.length === 0) return "Add at least one service request";
    const incomplete = bundleItems.some((item) => !item.serviceId || !item.variantId);
    return incomplete ? "Choose a service and option for each request" : null;
  };

  const validateScheduleStep = () => {
    for (const item of bundleItems) {
      const service = item.serviceId ? serviceMap.get(item.serviceId) ?? null : null;
      if (!service) return "Choose a service for each request first";
      if (!item.requestedDate) return `Add a date for ${service.name}`;
      if (service.slug !== "boarding" && WALK_REQUEST_SLUGS.has(service.slug) && !item.windowId) return `Choose a preferred window for ${service.name}`;
      if (service.slug !== "boarding" && !WALK_REQUEST_SLUGS.has(service.slug) && item.slot == null) return `Choose a time for ${service.name}`;
      if ((item.repeatFrequency === "weekly" || item.repeatFrequency === "biweekly") && item.repeatDays.length === 0) return `Pick repeat days for ${service.name}`;
      if (item.requestedEndDate && item.requestedEndDate < item.requestedDate) return `Repeat end date must be after the first date for ${service.name}`;
      if (service.slug === "boarding" && item.repeatFrequency !== "none") return "Boarding requests are one-off for now";
    }
    return null;
  };

  const validatePetStep = () => {
    for (const item of bundleItems) {
      const service = item.serviceId ? serviceMap.get(item.serviceId) ?? null : null;
      if (!item.petId) return `Choose a pet for ${service?.name ?? "each request"}`;
    }
    return null;
  };

  const next = () => {
    const message = step === 0 ? validateServiceStep() : step === 1 ? validateScheduleStep() : step === 2 ? validatePetStep() : null;
    if (message) return toast({ title: message, variant: "destructive" });
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const back = () => setStep((current) => Math.max(current - 1, 0));

  const buildBookingPayload = (item: BundleItem, position: number, requestGroupId: string) => {
    const service = item.serviceId ? serviceMap.get(item.serviceId) ?? null : null;
    const variant = item.variantId ? variantMap.get(item.variantId) ?? null : null;
    const selectedWindow = item.windowId ? walkWindows.find((window) => window.id === item.windowId) ?? null : null;
    if (!user || !service || !variant || !item.petId || !item.requestedDate || !sitterId) return null;

    const totalCents = variant.price_cents;
    const paymentAmountCents = variant.payment_mode === "free" ? 0 : variant.payment_mode === "deposit" ? Math.round(totalCents * 0.25) : totalCents;
    const depositCents = variant.payment_mode === "deposit" ? paymentAmountCents : variant.payment_mode === "full" ? totalCents : 0;

    let startAt: string;
    let endAt: string;
    let requestedWindowLabel: string;
    let requestedWindowStartMinute: number | null;
    let requestedWindowEndMinute: number | null;

    if (service.slug === "boarding") {
      const checkinMinute = service.boarding_checkin_minute ?? 12 * 60;
      const checkoutMinute = service.boarding_checkout_minute ?? 12 * 60;
      const startDate = new Date(`${item.requestedDate}T00:00:00`);
      startDate.setMinutes(checkinMinute);
      const endDate = new Date(addDays(new Date(`${item.requestedDate}T00:00:00`), 1));
      endDate.setHours(0, 0, 0, 0);
      endDate.setMinutes(checkoutMinute);
      startAt = startDate.toISOString();
      endAt = endDate.toISOString();
      requestedWindowLabel = "Noon to noon";
      requestedWindowStartMinute = checkinMinute;
      requestedWindowEndMinute = checkoutMinute;
    } else if (WALK_REQUEST_SLUGS.has(service.slug) && selectedWindow) {
      const requestStart = new Date(`${item.requestedDate}T00:00:00`);
      const requestEnd = new Date(`${item.requestedDate}T00:00:00`);
      requestStart.setMinutes(selectedWindow.start_minute);
      requestEnd.setMinutes(selectedWindow.end_minute);
      startAt = requestStart.toISOString();
      endAt = requestEnd.toISOString();
      requestedWindowLabel = selectedWindow.window_label;
      requestedWindowStartMinute = selectedWindow.start_minute;
      requestedWindowEndMinute = selectedWindow.end_minute;
    } else {
      const slot = item.slot ?? 0;
      const requestStart = new Date(`${item.requestedDate}T00:00:00`);
      const requestEnd = new Date(`${item.requestedDate}T00:00:00`);
      requestStart.setMinutes(slot);
      requestEnd.setMinutes(slot + variant.duration_minutes);
      startAt = requestStart.toISOString();
      endAt = requestEnd.toISOString();
      requestedWindowLabel = `${minutesToTime(slot)}–${minutesToTime(slot + variant.duration_minutes)}`;
      requestedWindowStartMinute = slot;
      requestedWindowEndMinute = slot + variant.duration_minutes;
    }

    const recurrenceLabel = getRepeatSummary(item);
    const recurrencePattern = item.repeatFrequency === "none"
      ? null
      : {
          frequency: item.repeatFrequency,
          interval: item.repeatInterval,
          weekdays: item.repeatDays,
        };

    return {
      customer_id: user.id,
      sitter_id: sitterId,
      pet_id: item.petId,
      service_id: service.id,
      service_variant_id: variant.id,
      start_at: startAt,
      end_at: endAt,
      total_cents: totalCents,
      base_price_cents: totalCents,
      deposit_cents: depositCents,
      payment_amount_cents: paymentAmountCents,
      notes: item.notes || null,
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
      status: "requested",
      booking_kind: "requested",
      request_group_id: requestGroupId,
      request_group_label: null,
      requested_date: item.requestedDate,
      requested_end_date: item.repeatFrequency === "none" ? null : item.requestedEndDate || null,
      requested_window_label: requestedWindowLabel,
      requested_window_start_minute: requestedWindowStartMinute,
      requested_window_end_minute: requestedWindowEndMinute,
      recurrence_label: recurrenceLabel,
      recurrence_pattern: recurrencePattern,
      bundle_position: position,
    };
  };

  const submit = async () => {
    if (!user || !sitterId) return;
    const serviceError = validateServiceStep();
    const scheduleError = validateScheduleStep();
    const petError = validatePetStep();
    if (serviceError || scheduleError || petError) {
      toast({ title: serviceError ?? scheduleError ?? petError ?? "Please finish the request", variant: "destructive" });
      return;
    }
    if (!acceptedTerms) {
      toast({ title: "Accept the Terms & Conditions to continue", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const { data: groupData, error: groupError } = await db
      .from("booking_request_groups")
      .insert({
        customer_id: user.id,
        sitter_id: sitterId,
        label: null,
        notes: bundleNotes.trim() || null,
        status: "requested",
      })
      .select("id")
      .single();

    if (groupError || !groupData?.id) {
      setSubmitting(false);
      toast({ title: "Couldn't save request", description: groupError?.message ?? "Please try again.", variant: "destructive" });
      return;
    }

    const bookingPayloads = bundleItems
      .map((item, index) => buildBookingPayload(item, index, groupData.id))
      .filter(Boolean);

    const { data, error } = await db.from("bookings").insert(bookingPayloads).select("id");
    setSubmitting(false);

    if (error || !data?.length) {
      toast({ title: "Couldn't save request", description: error?.message ?? "Please try again.", variant: "destructive" });
      return;
    }

    await Promise.all(
      data.map((booking: { id: string }) =>
        Promise.all([
          supabase.functions.invoke("notify-new-booking-request", {
            body: { bookingId: booking.id },
          }),
          supabase.functions.invoke("booking-workflow", {
            body: { bookingId: booking.id, action: "request_received" },
          }),
        ]),
      ),
    );

    navigate(`/booking/${data[0].id}/success${data.length > 1 ? "?bundle=1" : ""}`);
  };

  const reviewCopy = bundleItems.length > 1
    ? "Each service in this request is included in one submission."
    : "Your request details are included below.";

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <span className="inline-block -rotate-2 font-tag text-2xl text-tag">lock it in</span>
        <h1 className="font-display text-5xl text-primary sm:text-6xl spray-glow">
          Build a <span className="text-gradient-sunrise">service request.</span>
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          Mix repeat services and one-off care in one submission, with all your request details gathered in one place.
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

        <Card className="mt-6 border-4 border-primary p-5 shadow-pop-lg sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-display text-2xl uppercase text-primary">Bundle builder</h2>
            </div>
            <Button type="button" onClick={addBundleItem} variant="outline" className="border-2 border-primary font-display uppercase">
              <Plus className="h-4 w-4" /> Add another service
            </Button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {bundleSummaries.map(({ item, service, summary }) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveItemId(item.id)}
                className={cn(
                  "border-2 p-4 text-left transition-all",
                  activeItemId === item.id ? "border-primary bg-highlight shadow-pop-sm" : "border-primary bg-card hover:-translate-y-0.5 hover:bg-muted",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-base uppercase text-primary">{service?.name ?? `Service ${bundleItems.findIndex((candidate) => candidate.id === item.id) + 1}`}</div>
                    <p className="mt-1 text-sm text-foreground/75">{summary}</p>
                  </div>
                  {bundleItems.length > 1 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeBundleItem(item.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          removeBundleItem(item.id);
                        }
                      }}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Remove request"
                    >
                      <Trash2 className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {step === 0 && activeItem && (
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
              <div>
                <h3 className="font-display text-xl uppercase">Pick a service</h3>
                <div className="mt-4 grid gap-4">
                  {services.map((svc) => {
                    const activeServiceCard = activeItem.serviceId === svc.id;
                    return (
                      <div key={svc.id} className={cn("border-2 border-primary p-4 transition-colors", activeServiceCard ? "bg-highlight" : "bg-card")}>
                        <label className="flex cursor-pointer items-start gap-3">
                          <RadioGroup value={activeItem.serviceId ?? ""} onValueChange={(value) => setServiceForItem(activeItem.id, value)} className="w-full">
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
                                  {svc.turnaround_buffer_minutes > 0 && <span>Protected scheduling window</span>}
                                </div>
                              </div>
                            </div>
                          </RadioGroup>
                        </label>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {svc.variants.map((variant) => {
                            const activeVariantCard = activeItem.variantId === variant.id;
                            return (
                              <button
                                key={variant.id}
                                type="button"
                                onClick={() => {
                                  setServiceForItem(activeItem.id, svc.id);
                                  setVariantForItem(activeItem.id, variant.id);
                                }}
                                className={cn(
                                  "border-2 border-primary p-3 text-left transition-all",
                                  activeVariantCard ? "bg-tag text-tag-foreground shadow-pop-accent" : "bg-card hover:-translate-y-0.5 hover:bg-muted",
                                )}
                              >
                                <div className="font-display text-base uppercase">{variant.name}</div>
                                <div className={cn("mt-1 text-sm", activeVariantCard ? "text-tag-foreground/80" : "text-foreground/75")}>
                                  {formatPriceWithDecimals(variant.price_cents)}
                                  <span className="ml-1 text-xs opacity-70">{variant.unit_label}</span>
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

              <div className="space-y-4">
                <div>
                  <Label htmlFor="bundle-notes">Request note (optional)</Label>
                  <Textarea id="bundle-notes" rows={6} value={bundleNotes} onChange={(event) => setBundleNotes(event.target.value)} placeholder="Anything that ties these requests together — travel dates, pickup patterns, or care context." />
                </div>
              </div>
            </div>
          )}

          {step === 1 && activeItem && activeService && activeVariant && (
            <div className="mt-6">
              <h3 className="font-display text-2xl uppercase">
                {isActiveBoarding ? "Pick your drop-off day" : isActiveWalkWindowRequest ? "Pick a day & preferred window" : "Pick a day & time"}
              </h3>
              {!sitterId && <p className="mt-3 text-sm text-clay">No availability is set yet — check back soon.</p>}
              <div className="mt-4 grid gap-6 xl:grid-cols-[auto,1fr]">
                <div className="border-2 border-primary bg-card">
                  <Calendar
                    mode="single"
                    selected={activeDate}
                    onSelect={(nextDate) => setRequestedDate(activeItem.id, nextDate)}
                    disabled={getDayDisabled}
                    className={cn("pointer-events-auto p-3")}
                  />
                </div>
                <div>
                  <p className="font-display text-sm uppercase text-muted-foreground">
                    {activeDate ? format(activeDate, "EEEE, MMM d") : "Select a date"}
                  </p>
                  <p className="mt-2 max-w-xl text-sm text-foreground/75">
                    {isActiveBoarding
                      ? `Check-in ${minutesToTime(activeService.boarding_checkin_minute ?? 12 * 60)} · checkout ${minutesToTime(activeService.boarding_checkout_minute ?? 12 * 60)} next day`
                      : `${activeVariant.duration_minutes} min${activeService.extra_time_fee_cents && activeService.extra_time_increment_minutes ? ` · ${formatPriceWithDecimals(activeService.extra_time_fee_cents)} / ${activeService.extra_time_increment_minutes} min add-on` : ""}`}
                  </p>

                  {isActiveBoarding ? (
                    <div className="mt-4 border-2 border-primary bg-card p-4">
                      <div className="font-display text-lg uppercase text-primary">Boarding timing</div>
                      <p className="mt-2 text-sm text-foreground/75">
                        {activeDate
                          ? `${format(activeDate, "EEE, MMM d")} at ${minutesToTime(activeService.boarding_checkin_minute ?? 12 * 60)} → ${format(addDays(activeDate, 1), "EEE, MMM d")} at ${minutesToTime(activeService.boarding_checkout_minute ?? 12 * 60)}`
                          : "Select a day to preview the noon-to-noon stay."}
                      </p>
                    </div>
                  ) : isActiveWalkWindowRequest ? (
                    <>
                      {activeDate && activeWindowOptions.length === 0 && <p className="mt-3 text-sm text-clay">No request windows are open for this day.</p>}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {activeWindowOptions.map((window) => {
                          const active = activeItem.windowId === window.id;
                          const requestCount = requestCountByWindow.get(`${format(activeDate ?? new Date(), "yyyy-MM-dd")}-${window.window_label}`) ?? 0;
                          const remaining = Math.max((window.max_bookings ?? 1) - requestCount, 0);
                          return (
                            <button
                              key={window.id}
                              type="button"
                              onClick={() => patchBundleItem(activeItem.id, { windowId: window.id })}
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
                      {activeDate && activeSlots.length === 0 && <p className="mt-3 text-sm text-clay">No times open this day.</p>}
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {activeSlots.map((minute) => (
                          <button
                            key={minute}
                            type="button"
                            onClick={() => patchBundleItem(activeItem.id, { slot: minute })}
                            className={cn(
                              "border-2 border-primary px-2 py-2 font-display text-xs uppercase transition-all",
                              activeItem.slot === minute
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

                  {!isActiveBoarding && (
                    <div className="mt-6 space-y-4 border-2 border-primary bg-muted/40 p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="flex-1">
                          <Label>Repeat schedule</Label>
                          <Select value={activeItem.repeatFrequency} onValueChange={(value: RepeatFrequency) => setRepeatFrequency(activeItem.id, value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">One-off request</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="biweekly">Biweekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {activeItem.repeatFrequency !== "none" && (
                          <div className="w-full md:w-48">
                            <Label>Until (optional)</Label>
                            <Input type="date" value={activeItem.requestedEndDate} min={activeItem.requestedDate || undefined} onChange={(event) => patchBundleItem(activeItem.id, { requestedEndDate: event.target.value })} />
                          </div>
                        )}
                      </div>

                      {activeItem.repeatFrequency === "daily" && (
                        <div className="max-w-xs">
                          <Label>Repeat every</Label>
                          <Input type="number" min={1} max={30} value={activeItem.repeatInterval} onChange={(event) => patchBundleItem(activeItem.id, { repeatInterval: Math.max(1, Number(event.target.value) || 1) })} />
                        </div>
                      )}

                      {(activeItem.repeatFrequency === "weekly" || activeItem.repeatFrequency === "biweekly") && (
                        <div>
                          <Label>Repeat on</Label>
                          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                            {DAYS.map((dayLabel, weekday) => {
                              const checked = activeItem.repeatDays.includes(weekday);
                              return (
                                <button
                                  key={dayLabel}
                                  type="button"
                                  onClick={() => toggleRepeatDay(activeItem.id, weekday)}
                                  className={cn(
                                    "border-2 border-primary px-2 py-2 text-xs font-display uppercase transition-all",
                                    checked ? "bg-tag text-tag-foreground shadow-pop-accent" : "bg-card hover:bg-muted",
                                  )}
                                >
                                  {dayLabel}
                                </button>
                              );
                            })}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {activeItem.repeatFrequency === "biweekly" ? "This request repeats every other week on the selected days." : "This request repeats weekly on the selected days."}
                          </p>
                        </div>
                      )}

                      {activeItem.repeatFrequency === "monthly" && activeItem.requestedDate && (
                        <p className="text-xs text-muted-foreground">Monthly repeats use day {new Date(`${activeItem.requestedDate}T12:00:00`).getDate()} of each month.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && activeItem && activeService && (
            <div className="mt-6">
              <h3 className="font-display text-2xl uppercase">Who&apos;s coming?</h3>
              {activeService.requires_pet_approval && (
                <div className="mt-3 border-2 border-primary bg-muted px-4 py-3 text-sm text-foreground/75">
                  Pet fit is reviewed for this service before the booking is confirmed.
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
                <RadioGroup value={activeItem.petId ?? ""} onValueChange={(value) => patchBundleItem(activeItem.id, { petId: value })} className="mt-4 grid gap-3 sm:grid-cols-2">
                  {pets.map((pet) => (
                    <label
                      key={pet.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 border-2 border-primary p-3",
                        activeItem.petId === pet.id ? "bg-highlight" : "bg-card hover:bg-muted",
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
                <Label>Care notes (optional)</Label>
                <Textarea
                  rows={4}
                  maxLength={500}
                  value={activeItem.notes}
                  onChange={(event) => patchBundleItem(activeItem.id, { notes: event.target.value })}
                  placeholder="Anything important to know — leash habits, meds, feeding rhythm, pickups, building access, or social fit."
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6">
              <h3 className="font-display text-2xl uppercase">Review</h3>
              <div className="mt-4 space-y-4">
                {bundleSummaries.map(({ item, service, variant, pet, selectedWindow }) => (
                  <div key={item.id} className="border-2 border-primary bg-card p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-display text-xl uppercase text-primary">{variant?.name ?? service?.name ?? "Service"}</div>
                        <p className="mt-1 text-sm text-foreground/80">{pet?.name ? `For ${pet.name}` : "Pet not selected yet"}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="font-display text-lg uppercase">{variant ? formatPriceWithDecimals(variant.price_cents) : ""}</div>
                      </div>
                    </div>
                    <dl className="mt-4 divide-y-2 divide-primary/15 border-2 border-primary bg-muted/40 text-sm">
                      <div className="flex items-center justify-between gap-4 p-3">
                        <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Requested timing</dt>
                        <dd className="text-right font-display text-base uppercase">
                          {service?.slug === "boarding"
                            ? `${format(new Date(`${item.requestedDate}T12:00:00`), "EEE, MMM d")} · ${minutesToTime(service.boarding_checkin_minute ?? 12 * 60)}`
                            : WALK_REQUEST_SLUGS.has(service?.slug ?? "") && selectedWindow
                              ? `${format(new Date(`${item.requestedDate}T12:00:00`), "EEE, MMM d")} · ${selectedWindow.window_label}`
                              : item.slot != null
                                ? `${format(new Date(`${item.requestedDate}T12:00:00`), "EEE, MMM d")} · ${minutesToTime(item.slot)}`
                                : "Pending schedule"}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 p-3">
                        <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Repeat</dt>
                        <dd className="text-right font-display text-base uppercase">{getRepeatSummary(item) ?? "One-off"}</dd>
                      </div>
                      {item.requestedEndDate && (
                        <div className="flex items-center justify-between gap-4 p-3">
                          <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Through</dt>
                          <dd className="text-right font-display text-base uppercase">{format(new Date(`${item.requestedEndDate}T12:00:00`), "EEE, MMM d")}</dd>
                        </div>
                      )}
                      {item.notes && (
                        <div className="flex items-center justify-between gap-4 p-3">
                          <dt className="font-display text-xs uppercase tracking-wide text-muted-foreground">Notes</dt>
                          <dd className="max-w-[70%] text-right text-sm text-foreground/80">{item.notes}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{reviewCopy}</p>
              <div className="mt-5 rounded-md border border-border bg-muted/40 p-4">
                <label className="flex items-start gap-3 text-sm text-foreground/85">
                  <Checkbox checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} className="mt-0.5" />
                  <span>
                    I have read and agree to the <Link to="/terms" target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">Terms &amp; Conditions</Link>, including the liability, veterinary authorization, cancellation, and release provisions.
                  </span>
                </label>
              </div>
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
              <Button onClick={submit} disabled={submitting || !acceptedTerms} className="bg-tag font-display uppercase text-tag-foreground shadow-pop-accent transition-transform hover:-translate-y-0.5">
                {submitting ? "Saving…" : <>Send request <Check className="h-4 w-4" /></>}
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-6 inline-flex -rotate-1 items-center gap-2 font-tag text-lg text-tag">
          <CalendarDays className="h-4 w-4" /> showing the next 120 days · live booking calendar
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Weekly, biweekly, daily, and monthly repeats are supported for walks and visits. Boarding stays stay one-off for now.</p>
      </section>
      <SiteFooter />
    </main>
  );
};

export default Book;
