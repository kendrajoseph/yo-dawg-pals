import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { addDays, differenceInCalendarDays, format, isSameDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CalendarDays, Check, MoonStar, PawPrint, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAYS, formatPriceWithDecimals, minutesToTime, applySiblingDiscount, calculateBoardingTotalCents } from "@/lib/booking";

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
  sibling_discount_percent?: number;
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
  requestedEndDate: string; // for boarding: pick-up date; for repeats: until date
  slot: number | null;
  windowId: string | null;
  petIds: string[]; // multi-pet
  notes: string;
  repeatFrequency: RepeatFrequency;
  repeatDays: number[];
};

const STEPS = ["Services", "Schedule", "Pets", "Review"] as const;
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
  petIds: [],
  notes: "",
  repeatFrequency: "none",
  repeatDays: [],
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

  if (item.repeatFrequency === "daily") return "Daily";

  if (item.repeatFrequency === "monthly") {
    const day = item.requestedDate ? new Date(`${item.requestedDate}T12:00:00`).getDate() : null;
    return day ? `Monthly on day ${day}` : "Monthly";
  }

  const activeDays = item.repeatDays.length > 0 ? item.repeatDays : (item.requestedDate ? [new Date(`${item.requestedDate}T12:00:00`).getDay()] : []);
  const dayLabel = activeDays.length > 0 ? activeDays.map((day) => DAYS[day]).join(", ") : "selected days";
  return `${repeatLabelMap[item.repeatFrequency]} on ${dayLabel}`;
};

const getBoardingNights = (item: BundleItem) => {
  if (!item.requestedDate || !item.requestedEndDate) return 1;
  const start = new Date(`${item.requestedDate}T00:00:00`);
  const end = new Date(`${item.requestedEndDate}T00:00:00`);
  const nights = differenceInCalendarDays(end, start);
  return Math.max(1, nights);
};

// Compute the per-pet line totals for a bundle item.
// position = 0,1,2... within same service slug across the entire bundle.
const computeLines = ({
  item,
  service,
  variant,
  pets,
  petPositionStartByService,
}: {
  item: BundleItem;
  service: Service | null;
  variant: ServiceVariant | null;
  pets: Pet[];
  petPositionStartByService: Map<string, number>;
}): Array<{ petId: string; petName: string; cents: number; isSibling: boolean; nights?: number }> => {
  if (!service || !variant) return [];
  const petsForItem = item.petIds
    .map((id) => pets.find((p) => p.id === id))
    .filter((p): p is Pet => Boolean(p));
  if (petsForItem.length === 0) return [];

  // Base price per pet (boarding accounts for nights)
  let basePerPetCents = variant.price_cents;
  let nights: number | undefined;
  if (service.slug === "boarding") {
    nights = getBoardingNights(item);
    const extraNightVariant = (service.variants || []).find((v) => v.slug === "boarding-extra-night");
    const extraCents = extraNightVariant?.price_cents ?? 6000;
    basePerPetCents = calculateBoardingTotalCents(variant.price_cents, extraCents, nights);
  }

  const startPos = petPositionStartByService.get(service.slug) ?? 0;
  const discountPct = variant.sibling_discount_percent ?? 0;

  return petsForItem.map((pet, idx) => {
    const position = startPos + idx;
    const cents = applySiblingDiscount(basePerPetCents, position, discountPct);
    return {
      petId: pet.id,
      petName: pet.name,
      cents,
      isSibling: position > 0 && discountPct > 0,
      nights,
    };
  });
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
  const submittingRef = useRef(false);
  const [confirmation, setConfirmation] = useState<{
    lines: Array<{ serviceName: string; petName: string; timing: string; recurrence?: string | null; priceLabel?: string | null }>;
    totalLabel: string;
    firstBookingId: string | null;
    bundle: boolean;
  } | null>(null);

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
          .select("id, service_id, slug, name, duration_minutes, price_cents, unit_label, payment_mode, sort_order, sibling_discount_percent")
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
        // Hide the "boarding-extra-night" variant from the picker — it's a pricing rule, not a user choice.
        variants: (variantsByService.get(row.id) ?? [])
          .filter((v) => v.slug !== "boarding-extra-night")
          .sort((a, b) => a.sort_order - b.sort_order),
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

  // Persist the in-progress booking draft to localStorage so users coming back
  // from sign up land back where they left off.
  const DRAFT_KEY = "yodawg.bookingDraft.v1";
  const draftLoadedRef = useRef(false);

  // Load draft once when services are available.
  useEffect(() => {
    if (draftLoadedRef.current) return;
    if (services.length === 0) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) { draftLoadedRef.current = true; return; }
      const draft = JSON.parse(raw) as { bundleItems?: BundleItem[]; bundleNotes?: string; step?: number; ts?: number };
      // Drop drafts older than 7 days
      if (draft.ts && Date.now() - draft.ts > 1000 * 60 * 60 * 24 * 7) {
        localStorage.removeItem(DRAFT_KEY);
        draftLoadedRef.current = true;
        return;
      }
      if (Array.isArray(draft.bundleItems) && draft.bundleItems.length > 0) {
        setBundleItems(draft.bundleItems);
        setActiveItemId(draft.bundleItems[0]?.id ?? null);
      }
      if (typeof draft.bundleNotes === "string") setBundleNotes(draft.bundleNotes);
      if (typeof draft.step === "number") setStep(Math.min(Math.max(draft.step, 0), STEPS.length - 1));
    } catch {
      // ignore corrupt draft
    } finally {
      draftLoadedRef.current = true;
    }
  }, [services.length]);

  // Save draft whenever it changes (only after initial load).
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    if (bundleItems.length === 0) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        bundleItems, bundleNotes, step, ts: Date.now(),
      }));
    } catch { /* quota exceeded — ignore */ }
  }, [bundleItems, bundleNotes, step]);

  useEffect(() => {
    if (!authLoading && !user && step >= 2) {
      // Save draft before redirecting so it can be restored after sign up.
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ bundleItems, bundleNotes, step, ts: Date.now() }));
      } catch { /* ignore */ }
      navigate("/auth", { state: { from: `${location.pathname}${location.search}` } });
    }
  }, [authLoading, location.pathname, location.search, navigate, step, user, bundleItems, bundleNotes]);

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
  const activeEndDate = activeItem?.requestedEndDate ? new Date(`${activeItem.requestedEndDate}T12:00:00`) : undefined;
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

  // Pre-compute, for the entire bundle, the position of each pet within each service slug
  // so sibling discount applies correctly across multiple bundle items targeting the same service.
  const positionStartByItem = useMemo(() => {
    const counters = new Map<string, number>();
    const out = new Map<string, Map<string, number>>(); // itemId -> Map(slug -> startPos)
    for (const item of bundleItems) {
      const service = item.serviceId ? serviceMap.get(item.serviceId) ?? null : null;
      if (!service) continue;
      const m = new Map<string, number>();
      m.set(service.slug, counters.get(service.slug) ?? 0);
      out.set(item.id, m);
      counters.set(service.slug, (counters.get(service.slug) ?? 0) + item.petIds.length);
    }
    return out;
  }, [bundleItems, serviceMap]);

  const allLines = useMemo(() => {
    return bundleItems.map((item) => {
      const service = item.serviceId ? serviceMap.get(item.serviceId) ?? null : null;
      const variant = item.variantId ? variantMap.get(item.variantId) ?? null : null;
      const lines = computeLines({
        item,
        service,
        variant,
        pets,
        petPositionStartByService: positionStartByItem.get(item.id) ?? new Map(),
      });
      return { item, service, variant, lines };
    });
  }, [bundleItems, pets, positionStartByItem, serviceMap, variantMap]);

  const grandTotalCents = useMemo(
    () => allLines.reduce((acc, group) => acc + group.lines.reduce((a, l) => a + l.cents, 0), 0),
    [allLines],
  );

  const getBundleSummaryText = (item: BundleItem, service: Service | null, variant: ServiceVariant | null) => {
    if (!service || !variant) return "Choose a service";
    if (!item.requestedDate) return `${variant.name} · no schedule yet`;
    const dayLabel = format(new Date(`${item.requestedDate}T12:00:00`), "EEE, MMM d");
    const window = walkWindows.find((w) => w.id === item.windowId) ?? null;
    const timing = service.slug === "boarding"
      ? `${dayLabel} → ${item.requestedEndDate ? format(new Date(`${item.requestedEndDate}T12:00:00`), "EEE, MMM d") : "?"} (${getBoardingNights(item)} night${getBoardingNights(item) === 1 ? "" : "s"})`
      : WALK_REQUEST_SLUGS.has(service.slug) && window
        ? `${dayLabel} · ${window.window_label}`
        : item.slot != null
          ? `${dayLabel} · ${minutesToTime(item.slot)}`
          : `${dayLabel} · flexible`;
    const repeatSummary = getRepeatSummary(item);
    const petCount = item.petIds.length;
    const petLabel = petCount > 0 ? `${petCount} pet${petCount === 1 ? "" : "s"}` : "no pet yet";
    return [variant.name, timing, repeatSummary, petLabel].filter(Boolean).join(" · ");
  };

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

    // For boarding, default pick-up to next day if not set or now invalid.
    const service = item?.serviceId ? serviceMap.get(item.serviceId) : null;
    let nextEnd = item?.requestedEndDate ?? "";
    if (service?.slug === "boarding" && nextDate) {
      const oneNight = format(addDays(nextDate, 1), "yyyy-MM-dd");
      if (!nextEnd || nextEnd <= dateValue) nextEnd = oneNight;
    } else if (item?.repeatFrequency === "none") {
      nextEnd = "";
    }

    patchBundleItem(itemId, {
      requestedDate: dateValue,
      requestedEndDate: nextEnd,
      repeatDays: nextRepeatDays,
      slot: null,
      windowId: null,
    });
  };

  const setBoardingPickup = (itemId: string, nextDate?: Date) => {
    const dateValue = nextDate ? format(nextDate, "yyyy-MM-dd") : "";
    patchBundleItem(itemId, { requestedEndDate: dateValue });
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

  const togglePetForItem = (itemId: string, petId: string) => {
    const item = bundleItemMap.get(itemId);
    if (!item) return;
    const has = item.petIds.includes(petId);
    patchBundleItem(itemId, {
      petIds: has ? item.petIds.filter((id) => id !== petId) : [...item.petIds, petId],
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

  const getBoardingPickupDisabled = (day: Date) => {
    const today = startOfDay(new Date());
    if (day < today) return true;
    if (!activeItem?.requestedDate) return true;
    const drop = new Date(`${activeItem.requestedDate}T00:00:00`);
    if (day <= drop) return true;
    if (!sitterId) return true;
    const isBlockedDay = blocked.some((row) => row.sitter_id === sitterId && isSameDay(new Date(`${row.blocked_date}T12:00:00`), day));
    return isBlockedDay;
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
      if (service.slug === "boarding") {
        if (!item.requestedEndDate) return `Add a pick-up date for ${service.name}`;
        if (item.requestedEndDate <= item.requestedDate) return `Pick-up must be after drop-off for ${service.name}`;
        if (item.repeatFrequency !== "none") return "Boarding stays use a drop-off and pick-up date instead of a recurring schedule.";
      } else {
        if (WALK_REQUEST_SLUGS.has(service.slug) && !item.windowId) return `Choose a preferred window for ${service.name}`;
        if (!WALK_REQUEST_SLUGS.has(service.slug) && item.slot == null) return `Choose a time for ${service.name}`;
        if ((item.repeatFrequency === "weekly" || item.repeatFrequency === "biweekly") && item.repeatDays.length === 0) return `Pick repeat days for ${service.name}`;
        if (item.requestedEndDate && item.requestedEndDate < item.requestedDate) return `Repeat end date must be after the first date for ${service.name}`;
      }
    }
    return null;
  };

  const validatePetStep = () => {
    for (const item of bundleItems) {
      const service = item.serviceId ? serviceMap.get(item.serviceId) ?? null : null;
      if (item.petIds.length === 0) return `Choose at least one pet for ${service?.name ?? "each request"}`;
    }
    return null;
  };

  const next = () => {
    const message = step === 0 ? validateServiceStep() : step === 1 ? validateScheduleStep() : step === 2 ? validatePetStep() : null;
    if (message) return toast({ title: message, variant: "destructive" });
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const back = () => setStep((current) => Math.max(current - 1, 0));

  const buildBookingPayload = (
    item: BundleItem,
    petId: string,
    totalCents: number,
    bundlePosition: number,
    requestGroupId: string,
  ) => {
    const service = item.serviceId ? serviceMap.get(item.serviceId) ?? null : null;
    const variant = item.variantId ? variantMap.get(item.variantId) ?? null : null;
    const selectedWindow = item.windowId ? walkWindows.find((window) => window.id === item.windowId) ?? null : null;
    if (!user || !service || !variant || !item.requestedDate || !sitterId) return null;

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
      const endDate = new Date(`${item.requestedEndDate || item.requestedDate}T00:00:00`);
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
          weekdays: item.repeatDays,
        };

    return {
      customer_id: user.id,
      sitter_id: sitterId,
      pet_id: petId,
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
      requested_end_date: service.slug === "boarding"
        ? item.requestedEndDate || null
        : item.repeatFrequency === "none" ? null : item.requestedEndDate || null,
      requested_window_label: requestedWindowLabel,
      requested_window_start_minute: requestedWindowStartMinute,
      requested_window_end_minute: requestedWindowEndMinute,
      recurrence_label: recurrenceLabel,
      recurrence_pattern: recurrencePattern,
      bundle_position: bundlePosition,
    };
  };

  const submit = async () => {
    if (!user || !sitterId) return;
    if (submittingRef.current) return; // hard guard against double-click / StrictMode double-fire
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

    submittingRef.current = true;
    setSubmitting(true);

    try {
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
        throw new Error(groupError?.message ?? "Couldn't create request group");
      }

      // Build one booking row per (bundle item × pet), with sibling discount applied.
      const payloads: any[] = [];
      let bundlePosition = 0;
      for (const group of allLines) {
        for (const line of group.lines) {
          const payload = buildBookingPayload(group.item, line.petId, line.cents, bundlePosition++, groupData.id);
          if (payload) payloads.push(payload);
        }
      }

      if (payloads.length === 0) {
        throw new Error("Please pick at least one pet for each service.");
      }

      const { data, error } = await db.from("bookings").insert(payloads).select("id");
      if (error || !data?.length) {
        throw new Error(error?.message ?? "Couldn't save request");
      }

      // Build email summary lines from in-memory data (so we don't need to round-trip).
      const emailLines = allLines.flatMap(({ item, service, variant, lines }) => {
        if (!service || !variant) return [];
        const dateLabel = item.requestedDate ? format(new Date(`${item.requestedDate}T12:00:00`), "EEE, MMM d") : "TBD";
        const window = walkWindows.find((w) => w.id === item.windowId) ?? null;
        const baseTiming = service.slug === "boarding" && item.requestedEndDate
          ? `${dateLabel} → ${format(new Date(`${item.requestedEndDate}T12:00:00`), "EEE, MMM d")} · ${getBoardingNights(item)} night${getBoardingNights(item) === 1 ? "" : "s"}`
          : window
            ? `${dateLabel} · ${window.window_label}`
            : item.slot != null
              ? `${dateLabel} · ${minutesToTime(item.slot)}`
              : dateLabel;
        const recurrence = getRepeatSummary(item);
        return lines.map((line) => ({
          serviceName: variant.name,
          petName: line.isSibling ? `${line.petName} (sibling 50% off)` : line.petName,
          timing: baseTiming,
          recurrence,
          priceLabel: formatPriceWithDecimals(line.cents),
        }));
      });
      const totalLabel = formatPriceWithDecimals(grandTotalCents);

      // ONE email + ONE sitter notification per request group.
      const firstBookingId = data[0].id as string;
      await Promise.all([
        supabase.functions.invoke("notify-new-booking-request", {
          body: { bookingId: firstBookingId, requestGroupId: groupData.id, bookingCount: data.length },
        }),
        supabase.functions.invoke("booking-workflow", {
          body: {
            bookingId: firstBookingId,
            action: "request_received",
            requestGroupId: groupData.id,
            lines: emailLines,
            totalLabel,
            notes: bundleNotes.trim() || null,
          },
        }),
      ]);

      // Show warm confirmation modal instead of navigating immediately.
      setConfirmation({
        lines: emailLines,
        totalLabel,
        firstBookingId,
        bundle: data.length > 1,
      });
    } catch (err: any) {
      toast({ title: "Couldn't save request", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const reviewCopy = bundleItems.length > 1
    ? "Each service in this request is included in one submission."
    : "Your request details are included below.";

  const closeConfirmation = (goToBooking: boolean) => {
    const id = confirmation?.firstBookingId;
    const wasBundle = confirmation?.bundle;
    setConfirmation(null);
    if (goToBooking && id) {
      navigate(`/booking/${id}/success${wasBundle ? "?bundle=1" : ""}`);
    } else {
      navigate("/account");
    }
  };

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
              <p className="mt-1 text-xs text-muted-foreground">All prices include tax.</p>
            </div>
            <Button type="button" onClick={addBundleItem} variant="outline" className="border-2 border-primary font-display uppercase">
              <Plus className="h-4 w-4" /> Add another service
            </Button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {bundleItems.map((item) => {
              const service = item.serviceId ? serviceMap.get(item.serviceId) ?? null : null;
              const variant = item.variantId ? variantMap.get(item.variantId) ?? null : null;
              return (
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
                      <div className="font-display text-base uppercase text-primary">{service?.name ?? `Service ${bundleItems.findIndex((c) => c.id === item.id) + 1}`}</div>
                      <p className="mt-1 text-sm text-foreground/75">{getBundleSummaryText(item, service, variant)}</p>
                    </div>
                    {bundleItems.length > 1 && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => { event.stopPropagation(); removeBundleItem(item.id); }}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); removeBundleItem(item.id); } }}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Remove request"
                      >
                        <Trash2 className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
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
                                </div>
                                <p className="mt-2 text-sm text-foreground/75">{svc.description}</p>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {svc.scheduling_mode === "boarding" && <span className="inline-flex items-center gap-1"><MoonStar className="h-3.5 w-3.5" /> Noon to noon</span>}
                                  <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Tax included</span>
                                </div>
                              </div>
                            </div>
                          </RadioGroup>
                        </label>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {svc.variants.map((variant) => {
                            const activeVariantCard = activeItem.variantId === variant.id;
                            const showFromPrefix = svc.slug === "boarding";
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
                                  {showFromPrefix ? "From " : ""}{formatPriceWithDecimals(variant.price_cents)}
                                  <span className="ml-1 text-xs opacity-70">{variant.unit_label}</span>
                                </div>
                                {svc.slug === "boarding" && (
                                  <div className={cn("mt-1 text-[11px]", activeVariantCard ? "text-tag-foreground/80" : "text-muted-foreground")}>
                                    +$60 each additional night
                                  </div>
                                )}
                                {(variant.sibling_discount_percent ?? 0) > 0 && (
                                  <div className={cn("mt-1 text-[11px]", activeVariantCard ? "text-tag-foreground/80" : "text-muted-foreground")}>
                                    50% off each sibling
                                  </div>
                                )}
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
                {isActiveBoarding ? "Pick drop-off and pick-up days" : isActiveWalkWindowRequest ? "Pick a day & preferred window" : "Pick a day & time"}
              </h3>
              {!sitterId && <p className="mt-3 text-sm text-clay">No availability is set yet — check back soon.</p>}

              {isActiveBoarding ? (
                <div className="mt-4 grid gap-6 xl:grid-cols-2">
                  <div>
                    <p className="font-display text-sm uppercase text-muted-foreground">Drop-off</p>
                    <div className="mt-2 border-2 border-primary bg-card">
                      <Calendar
                        mode="single"
                        selected={activeDate}
                        onSelect={(nextDate) => setRequestedDate(activeItem.id, nextDate)}
                        disabled={getDayDisabled}
                        className={cn("pointer-events-auto p-3")}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Check-in {minutesToTime(activeService.boarding_checkin_minute ?? 12 * 60)}.</p>
                  </div>
                  <div>
                    <p className="font-display text-sm uppercase text-muted-foreground">Pick-up</p>
                    <div className="mt-2 border-2 border-primary bg-card">
                      <Calendar
                        mode="single"
                        selected={activeEndDate}
                        onSelect={(nextDate) => setBoardingPickup(activeItem.id, nextDate)}
                        disabled={getBoardingPickupDisabled}
                        className={cn("pointer-events-auto p-3")}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Checkout {minutesToTime(activeService.boarding_checkout_minute ?? 12 * 60)}.</p>
                  </div>
                  {activeItem.requestedDate && activeItem.requestedEndDate && (
                    <div className="border-2 border-primary bg-highlight p-4 xl:col-span-2">
                      <div className="font-display text-lg uppercase text-primary">
                        {getBoardingNights(activeItem)} night{getBoardingNights(activeItem) === 1 ? "" : "s"} · {format(new Date(`${activeItem.requestedDate}T12:00:00`), "EEE, MMM d")} → {format(new Date(`${activeItem.requestedEndDate}T12:00:00`), "EEE, MMM d")}
                      </div>
                      <p className="mt-1 text-sm text-foreground/75">
                        {formatPriceWithDecimals(activeVariant.price_cents)} first night + ${(((services.find((s)=>s.slug==="boarding")?.variants.find((v)=>v.slug==="boarding-extra-night") as any)?.price_cents ?? 6000) / 100).toFixed(2)} × {getBoardingNights(activeItem) - 1} additional night{getBoardingNights(activeItem) - 1 === 1 ? "" : "s"} = {formatPriceWithDecimals(calculateBoardingTotalCents(activeVariant.price_cents, ((services.find((s)=>s.slug==="boarding")?.variants.find((v)=>v.slug==="boarding-extra-night") as any)?.price_cents ?? 6000), getBoardingNights(activeItem)))} per pet (tax included).
                      </p>
                    </div>
                  )}
                </div>
              ) : (
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
                      {`${activeVariant.duration_minutes} min${activeService.extra_time_fee_cents && activeService.extra_time_increment_minutes ? ` · ${formatPriceWithDecimals(activeService.extra_time_fee_cents)} / ${activeService.extra_time_increment_minutes} min add-on` : ""}`}
                    </p>

                    {isActiveWalkWindowRequest ? (
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
                              <SelectItem value="biweekly">Biweekly (every other week)</SelectItem>
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
                            {activeItem.repeatFrequency === "biweekly" ? "Repeats every other week on the selected days." : "Repeats weekly on the selected days."}
                          </p>
                        </div>
                      )}

                      {activeItem.repeatFrequency === "monthly" && activeItem.requestedDate && (
                        <p className="text-xs text-muted-foreground">Monthly repeats use day {new Date(`${activeItem.requestedDate}T12:00:00`).getDate()} of each month.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && activeItem && activeService && (
            <div className="mt-6">
              <h3 className="font-display text-2xl uppercase">Who&apos;s coming?</h3>
              <p className="mt-1 text-sm text-foreground/75">Pick one or more pets — siblings get 50% off on group walks and boarding.</p>
              {pets.length === 0 ? (
                <Card className="mt-4 -rotate-1 border-2 border-primary bg-highlight p-6 text-center shadow-pop">
                  <PawPrint className="mx-auto h-8 w-8 text-clay" />
                  <p className="mt-2 font-tag text-xl text-clay">no pets on file yet</p>
                  <Button asChild className="mt-3 font-display uppercase">
                    <Link to="/account/pets">Add a pet</Link>
                  </Button>
                </Card>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {pets.map((pet) => {
                    const checked = activeItem.petIds.includes(pet.id);
                    return (
                      <label
                        key={pet.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 border-2 border-primary p-3",
                          checked ? "bg-highlight" : "bg-card hover:bg-muted",
                        )}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => togglePetForItem(activeItem.id, pet.id)} />
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
                    );
                  })}
                </div>
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
                {allLines.map(({ item, service, variant, lines }) => (
                  <div key={item.id} className="border-2 border-primary bg-card p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-display text-xl uppercase text-primary">{variant?.name ?? service?.name ?? "Service"}</div>
                        <p className="mt-1 text-sm text-foreground/80">
                          {service?.slug === "boarding" && item.requestedDate && item.requestedEndDate
                            ? `${format(new Date(`${item.requestedDate}T12:00:00`), "EEE, MMM d")} → ${format(new Date(`${item.requestedEndDate}T12:00:00`), "EEE, MMM d")} · ${getBoardingNights(item)} night${getBoardingNights(item) === 1 ? "" : "s"}`
                            : item.requestedDate
                              ? `${format(new Date(`${item.requestedDate}T12:00:00`), "EEE, MMM d")}${item.windowId ? ` · ${walkWindows.find((w) => w.id === item.windowId)?.window_label ?? ""}` : item.slot != null ? ` · ${minutesToTime(item.slot)}` : ""}`
                              : "Pending schedule"}
                          {getRepeatSummary(item) ? ` · ${getRepeatSummary(item)}` : ""}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-4 divide-y-2 divide-primary/15 border-2 border-primary bg-muted/40 text-sm">
                      {lines.length === 0 && (
                        <li className="p-3 text-muted-foreground">No pets selected for this service.</li>
                      )}
                      {lines.map((line) => (
                        <li key={line.petId} className="flex items-center justify-between gap-4 p-3">
                          <span className="font-display text-base">
                            {line.petName}
                            {line.isSibling && <span className="ml-2 text-xs uppercase text-clay">sibling 50% off</span>}
                          </span>
                          <span className="font-display text-base">{formatPriceWithDecimals(line.cents)}</span>
                        </li>
                      ))}
                    </ul>
                    {item.notes && (
                      <p className="mt-3 text-xs text-muted-foreground"><span className="font-display uppercase">Notes:</span> {item.notes}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 border-2 border-primary bg-highlight p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-lg uppercase text-primary">Estimated total if approved</span>
                  <span className="font-display text-3xl text-primary">{formatPriceWithDecimals(grandTotalCents)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">All prices include tax. You won't be charged until Anneke confirms your request.</p>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">{reviewCopy}</p>

              <div className="mt-5 rounded-md border border-border bg-muted/40 p-4">
                <label className="flex items-start gap-3 text-sm text-foreground/85">
                  <Checkbox checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} className="mt-0.5" />
                  <span>
                    I agree to the <Link to="/terms" target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">Terms &amp; Conditions</Link>. All prices include tax. Submitting a request doesn't charge my card — Anneke will review and be in touch.
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
                {submitting ? "Sending…" : <>Submit request <Check className="h-4 w-4" /></>}
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-6 inline-flex -rotate-1 items-center gap-2 font-tag text-lg text-tag">
          <CalendarDays className="h-4 w-4" /> showing the next 120 days · live booking calendar
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Weekly, biweekly, daily, and monthly repeats are supported for walks and visits. Boarding stays use a drop-off and pick-up date.</p>
      </section>
      <SiteFooter />

      <Dialog open={!!confirmation} onOpenChange={(open) => { if (!open) closeConfirmation(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase text-primary">Thanks — your request is in! 🐾</DialogTitle>
            <DialogDescription>
              Anneke will personally review your request and be in touch soon — keep an eye on your inbox for a confirmation email.
            </DialogDescription>
          </DialogHeader>

          {confirmation && (
            <div className="space-y-3">
              <ul className="divide-y divide-border rounded-md border border-border bg-muted/40 text-sm">
                {confirmation.lines.map((line, idx) => (
                  <li key={idx} className="flex flex-col gap-0.5 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-display text-sm">{line.serviceName} <span className="text-muted-foreground">· {line.petName}</span></div>
                      <div className="text-xs text-muted-foreground">{line.timing}{line.recurrence ? ` · ${line.recurrence}` : ""}</div>
                    </div>
                    {line.priceLabel && <div className="font-display text-sm text-primary">{line.priceLabel}</div>}
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline justify-between rounded-md border-2 border-primary bg-highlight px-4 py-3">
                <span className="font-display text-sm uppercase text-primary">Estimated total if approved</span>
                <span className="font-display text-xl text-primary">{confirmation.totalLabel}</span>
              </div>
              <p className="text-xs text-muted-foreground">All prices include tax. You won't be charged until Anneke confirms.</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => closeConfirmation(false)}>Close</Button>
            <Button onClick={() => closeConfirmation(true)} className="bg-tag font-display uppercase text-tag-foreground">View my request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Book;
