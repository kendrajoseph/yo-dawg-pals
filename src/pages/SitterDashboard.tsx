import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
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
  formatPriceWithDecimals,
  STATUS_LABELS,
  STATUS_STYLES,
  timeToMinutes,
} from "@/lib/booking";
import {
  CalendarOff,
  Check,
  Clock3,
  MessageSquare,
  Minus,
  MoonStar,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
  X,
} from "lucide-react";

type Availability = { id: string; weekday: number; start_minute: number; end_minute: number; max_bookings: number };
type Blocked = { id: string; blocked_date: string; reason: string | null };
type Service = {
  id: string;
  name: string;
  slug: string;
  payment_mode: "full" | "deposit" | "free";
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
};
type ServiceVariant = {
  id: string;
  service_id: string;
  name: string;
  slug: string;
  duration_minutes: number;
  price_cents: number;
  unit_label: string | null;
  payment_mode: "full" | "deposit" | "free";
};
type AvailabilityService = { availability_id: string; service_id: string };
type WalkWindow = {
  id: string;
  service_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  window_label: string;
  sort_order: number;
  max_bookings: number;
};
type Booking = {
  id: string;
  customer_id: string;
  pet_id: string;
  service_id: string;
  service_variant_id: string | null;
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
  total_cents: number;
  payment_amount_cents: number | null;
  base_price_cents: number | null;
  extra_time_minutes: number;
  extra_time_fee_cents: number;
  late_pickup_fee_cents: number;
  services: { name: string; slug: string; payment_mode: "full" | "deposit" | "free" } | null;
  service_variants: { name: string; duration_minutes: number; price_cents: number; payment_mode: "full" | "deposit" | "free" } | null;
  pets: { id: string; name: string } | null;
};

type PetApproval = {
  id: string;
  pet_id: string;
  service_id: string;
  status: "pending" | "approved" | "declined";
  notes: string | null;
  pets: { name: string } | null;
  services: { name: string } | null;
};

type Draft = {
  date: string;
  endDate: string;
  start: string;
  end: string;
  groupLabel: string;
  internalNotes: string;
  extraTimeMinutes: number;
  latePickup: boolean;
};
type ProfileDetails = { full_name: string; mobile_phone: string | null; sms_opt_in: boolean };
type BookingUpdate = {
  id: string;
  booking_id: string;
  kind: "pickup" | "dropoff" | "note";
  message: string | null;
  sent_via_sms: boolean;
  created_at: string;
};
type UpdateDraft = { note: string; sendSms: boolean };

const WALK_SLUGS = new Set(["solo-walk", "group-walk"]);
const TIME_PRESETS = [
  { label: "Morning", start: "08:00", end: "11:00" },
  { label: "Midday", start: "11:00", end: "14:00" },
  { label: "Afternoon", start: "14:00", end: "17:00" },
  { label: "Evening", start: "17:00", end: "20:00" },
];

const formatMinuteTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const formatUpdateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const updateKindLabel: Record<BookingUpdate["kind"], string> = {
  pickup: "Picked up",
  dropoff: "Dropped off",
  note: "Note sent",
};

const SitterDashboard = () => {
  const db = supabase as any;
  const { user } = useAuth();
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceVariants, setServiceVariants] = useState<ServiceVariant[]>([]);
  const [availabilityServices, setAvailabilityServices] = useState<AvailabilityService[]>([]);
  const [walkWindows, setWalkWindows] = useState<WalkWindow[]>([]);
  const [petApprovals, setPetApprovals] = useState<PetApproval[]>([]);
  const [profileDetails, setProfileDetails] = useState<Record<string, ProfileDetails>>({});
  const [bookingUpdates, setBookingUpdates] = useState<Record<string, BookingUpdate[]>>({});
  const [newAvailability, setNewAvailability] = useState({ weekday: 1, start: "09:00", end: "12:00", maxBookings: 1 });
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);
  const [blockDate, setBlockDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");
  const [newWindow, setNewWindow] = useState({ serviceId: "", weekday: 1, label: "Morning", start: "09:00", end: "11:00", maxBookings: 4 });
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, Draft>>({});
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, UpdateDraft>>({});
  const [savingBookingId, setSavingBookingId] = useState<string | null>(null);
  const [sendingUpdateId, setSendingUpdateId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;

    const [
      { data: avail },
      { data: blockedDates },
      { data: bookingRows },
      { data: serviceRows },
      { data: variantRows },
      { data: walkWindowRows },
      { data: approvalRows },
    ] = await Promise.all([
      db.from("availability").select("*").eq("sitter_id", user.id).order("weekday").order("start_minute"),
      db.from("blocked_dates").select("*").eq("sitter_id", user.id).order("blocked_date"),
      db
        .from("bookings")
        .select("id, customer_id, pet_id, service_id, service_variant_id, start_at, end_at, total_cents, payment_amount_cents, base_price_cents, extra_time_minutes, extra_time_fee_cents, late_pickup_fee_cents, status, notes, booking_kind, requested_date, requested_window_label, requested_window_start_minute, requested_window_end_minute, scheduled_start_at, scheduled_end_at, paid_at, group_assignment_label, internal_notes, services(name, slug, payment_mode), service_variants(name, duration_minutes, price_cents, payment_mode), pets(id, name)")
        .eq("sitter_id", user.id)
        .order("created_at", { ascending: false }),
      db
        .from("services")
        .select("id, name, slug, payment_mode, scheduling_mode, approval_required, requires_pet_approval, turnaround_buffer_minutes, extra_time_fee_cents, extra_time_increment_minutes, late_pickup_fee_cents, boarding_checkin_minute, boarding_checkout_minute, max_capacity")
        .eq("is_active", true)
        .order("sort_order"),
      db
        .from("service_variants")
        .select("id, service_id, name, slug, duration_minutes, price_cents, unit_label, payment_mode")
        .eq("is_active", true)
        .order("sort_order"),
      db.from("walk_windows").select("id, service_id, weekday, start_minute, end_minute, window_label, sort_order, max_bookings").eq("sitter_id", user.id).order("weekday").order("sort_order"),
      db.from("sitter_pet_approvals").select("id, pet_id, service_id, status, notes, pets(name), services(name)").eq("sitter_id", user.id).order("updated_at", { ascending: false }),
    ]);

    const nextAvailability = (avail ?? []) as Availability[];
    const nextBookings = (bookingRows ?? []) as Booking[];
    const nextServices = (serviceRows ?? []) as Service[];

    setAvailability(nextAvailability);
    setBlocked((blockedDates ?? []) as Blocked[]);
    setBookings(nextBookings);
    setServices(nextServices);
    setServiceVariants((variantRows ?? []) as ServiceVariant[]);
    setWalkWindows((walkWindowRows ?? []) as WalkWindow[]);
    setPetApprovals((approvalRows ?? []) as PetApproval[]);

    const customerIds = [...new Set(nextBookings.map((row) => row.customer_id))];
    if (customerIds.length > 0) {
      const { data: profileRows } = await db.from("profiles").select("id, full_name, mobile_phone, sms_opt_in").in("id", customerIds);
      setProfileDetails(
        Object.fromEntries(
          ((profileRows ?? []) as { id: string; full_name: string | null; mobile_phone?: string | null; sms_opt_in?: boolean | null }[]).map((row) => [
            row.id,
            {
              full_name: row.full_name || "Customer",
              mobile_phone: row.mobile_phone ?? null,
              sms_opt_in: Boolean(row.sms_opt_in),
            },
          ]),
        ),
      );
    } else {
      setProfileDetails({});
    }

    if (nextBookings.length > 0) {
      const { data: updatesRows } = await db
        .from("booking_updates")
        .select("id, booking_id, kind, message, sent_via_sms, created_at")
        .in("booking_id", nextBookings.map((booking) => booking.id))
        .order("created_at", { ascending: false });

      const groupedUpdates = ((updatesRows ?? []) as BookingUpdate[]).reduce<Record<string, BookingUpdate[]>>((acc, update) => {
        acc[update.booking_id] = [...(acc[update.booking_id] ?? []), update];
        return acc;
      }, {});
      setBookingUpdates(groupedUpdates);
    } else {
      setBookingUpdates({});
    }

    const slotIds = nextAvailability.map((row) => row.id);
    if (slotIds.length > 0) {
      const { data: tagged } = await db.from("availability_services").select("availability_id, service_id").in("availability_id", slotIds);
      setAvailabilityServices((tagged ?? []) as AvailabilityService[]);
    } else {
      setAvailabilityServices([]);
    }

    setNewServiceIds((current) => current.length ? current : nextServices.filter((service) => !WALK_SLUGS.has(service.slug)).map((service) => service.id));
    setNewWindow((current) => ({
      ...current,
      serviceId: current.serviceId || nextServices.find((service) => WALK_SLUGS.has(service.slug))?.id || "",
    }));
  };

  useEffect(() => {
    load();
  }, [user]);

  const exactSlotServices = useMemo(() => services.filter((service) => !WALK_SLUGS.has(service.slug)), [services]);
  const walkServices = useMemo(() => services.filter((service) => WALK_SLUGS.has(service.slug)), [services]);
  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const variantMap = useMemo(() => new Map(serviceVariants.map((variant) => [variant.id, variant])), [serviceVariants]);

  const tagsBySlot = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of availabilityServices) {
      if (!map.has(row.availability_id)) map.set(row.availability_id, new Set());
      map.get(row.availability_id)?.add(row.service_id);
    }
    return map;
  }, [availabilityServices]);

  const requestBookings = useMemo(() => bookings.filter((booking) => booking.booking_kind === "requested" && ["requested", "awaiting_payment", "confirmed"].includes(booking.status)), [bookings]);
  const upcomingExactBookings = useMemo(() => bookings.filter((booking) => booking.booking_kind !== "requested" && new Date(booking.start_at) > new Date()), [bookings]);
  const careUpdateBookings = useMemo(
    () => bookings
      .filter((booking) => booking.status === "confirmed" && new Date(booking.scheduled_start_at ?? booking.start_at) > new Date(Date.now() - 12 * 60 * 60 * 1000))
      .sort((a, b) => new Date(b.scheduled_start_at ?? b.start_at).getTime() - new Date(a.scheduled_start_at ?? a.start_at).getTime()),
    [bookings],
  );
  const pastBookings = useMemo(() => bookings.filter((booking) => new Date(booking.scheduled_start_at ?? booking.start_at) <= new Date()), [bookings]);

  const pendingPetApprovals = useMemo(() => {
    const seen = new Set<string>();
    const derived = requestBookings.flatMap((booking) => {
      const approval = petApprovals.find((item) => item.pet_id === booking.pet_id && item.service_id === booking.service_id);
      const service = serviceMap.get(booking.service_id);
      if (!service?.requires_pet_approval) return [];
      const key = `${booking.pet_id}-${booking.service_id}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        key,
        petId: booking.pet_id,
        petName: booking.pets?.name ?? "Pet",
        serviceId: booking.service_id,
        serviceName: booking.services?.name ?? "Service",
        status: approval?.status ?? "pending",
        notes: approval?.notes ?? null,
      }];
    });
    return derived;
  }, [petApprovals, requestBookings, serviceMap]);

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
      .insert({ sitter_id: user.id, weekday: newAvailability.weekday, start_minute: start, end_minute: end, max_bookings: newAvailability.maxBookings })
      .select("id")
      .single();
    if (error || !inserted) return toast({ title: "Failed", description: error?.message, variant: "destructive" });

    const links = newServiceIds.map((serviceId) => ({ availability_id: inserted.id, service_id: serviceId }));
    const { error: linkError } = await db.from("availability_services").insert(links);
    if (linkError) toast({ title: "Slot saved, tagging failed", description: linkError.message, variant: "destructive" });
    else toast({ title: "Availability added" });
    load();
  };

  const updateAvailabilityCapacity = async (id: string, next: number) => {
    const { error } = await db.from("availability").update({ max_bookings: Math.max(1, next) }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else load();
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
      max_bookings: newWindow.maxBookings,
    });

    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Walk window added" });
      load();
    }
  };

  const updateWalkWindowCapacity = async (id: string, next: number) => {
    const { error } = await db.from("walk_windows").update({ max_bookings: Math.max(1, next) }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else load();
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

  const buildDefaultDraft = (booking: Booking): Draft => {
    const service = serviceMap.get(booking.service_id);
    const variant = booking.service_variant_id ? variantMap.get(booking.service_variant_id) : null;
    const boardingStart = service?.boarding_checkin_minute ?? 12 * 60;
    const boardingEnd = service?.boarding_checkout_minute ?? 12 * 60;
    return {
      date: booking.requested_date ?? format(new Date(booking.start_at), "yyyy-MM-dd"),
      endDate: service?.slug === "boarding" ? format(addDays(new Date(booking.requested_date ?? booking.start_at), 1), "yyyy-MM-dd") : booking.requested_date ?? format(new Date(booking.start_at), "yyyy-MM-dd"),
      start: booking.requested_window_start_minute != null ? formatMinuteTime(booking.requested_window_start_minute) : formatMinuteTime(service?.slug === "boarding" ? boardingStart : timeToMinutes("09:00")),
      end: booking.requested_window_end_minute != null ? formatMinuteTime(booking.requested_window_end_minute) : formatMinuteTime(service?.slug === "boarding" ? boardingEnd : (variant?.duration_minutes ?? 60) + timeToMinutes("09:00")),
      groupLabel: booking.group_assignment_label ?? "",
      internalNotes: booking.internal_notes ?? "",
      extraTimeMinutes: booking.extra_time_minutes ?? 0,
      latePickup: Boolean(booking.late_pickup_fee_cents),
    };
  };

  const getDraft = (booking: Booking) => scheduleDrafts[booking.id] ?? buildDefaultDraft(booking);
  const patchDraft = (booking: Booking, patch: Partial<Draft>) => {
    setScheduleDrafts((current) => ({
      ...current,
      [booking.id]: { ...buildDefaultDraft(booking), ...(current[booking.id] ?? {}), ...patch },
    }));
  };

  const getUpdateDraft = (bookingId: string): UpdateDraft => updateDrafts[bookingId] ?? { note: "", sendSms: true };
  const patchUpdateDraft = (bookingId: string, patch: Partial<UpdateDraft>) => {
    setUpdateDrafts((current) => ({
      ...current,
      [bookingId]: { ...getUpdateDraft(bookingId), ...patch },
    }));
  };

  const setPetApproval = async (petId: string, serviceId: string, status: PetApproval["status"], notes?: string) => {
    if (!user) return;
    const { error } = await db.from("sitter_pet_approvals").upsert({
      sitter_id: user.id,
      pet_id: petId,
      service_id: serviceId,
      status,
      notes: notes ?? null,
    }, { onConflict: "sitter_id,pet_id,service_id" });
    if (error) toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    else load();
  };

  const approveRequest = async (booking: Booking) => {
    if (!user) return;
    const draft = getDraft(booking);
    const service = serviceMap.get(booking.service_id);
    const variant = booking.service_variant_id ? variantMap.get(booking.service_variant_id) : null;
    if (!service || !variant) return toast({ title: "Missing service details", variant: "destructive" });

    const petApproval = petApprovals.find((item) => item.pet_id === booking.pet_id && item.service_id === booking.service_id);
    if (service.requires_pet_approval && petApproval?.status !== "approved") {
      return toast({ title: "Approve the pet first", description: "This service needs a fit decision before it can be approved.", variant: "destructive" });
    }

    const startMinute = timeToMinutes(draft.start);
    const endMinute = timeToMinutes(draft.end);
    if (endMinute <= startMinute && service.slug !== "boarding") return toast({ title: "End must be after start", variant: "destructive" });

    setSavingBookingId(booking.id);
    const startAt = new Date(`${draft.date}T00:00:00`);
    startAt.setMinutes(startMinute);
    const endAt = new Date(`${(service.slug === "boarding" ? draft.endDate : draft.date)}T00:00:00`);
    endAt.setMinutes(service.slug === "boarding" ? timeToMinutes(draft.end) : endMinute);

    const extraTimeMinutes = Math.max(0, draft.extraTimeMinutes);
    const extraTimeFeeCents = service.extra_time_fee_cents && service.extra_time_increment_minutes
      ? Math.ceil(extraTimeMinutes / service.extra_time_increment_minutes) * service.extra_time_fee_cents
      : 0;
    const latePickupFeeCents = draft.latePickup ? service.late_pickup_fee_cents ?? 0 : 0;
    const totalCents = (variant.price_cents ?? booking.base_price_cents ?? booking.total_cents) + extraTimeFeeCents + latePickupFeeCents;
    const paymentAmount = variant.payment_mode === "free" ? 0 : variant.payment_mode === "deposit" ? Math.round(totalCents * 0.25) : totalCents;
    const nextStatus = variant.payment_mode === "free" ? "confirmed" : "awaiting_payment";

    const { error } = await db.from("bookings").update({
      scheduled_start_at: startAt.toISOString(),
      scheduled_end_at: endAt.toISOString(),
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      group_assignment_label: draft.groupLabel || null,
      internal_notes: draft.internalNotes || null,
      extra_time_minutes: extraTimeMinutes,
      extra_time_fee_cents: extraTimeFeeCents,
      late_pickup_fee_cents: latePickupFeeCents,
      total_cents: totalCents,
      payment_amount_cents: paymentAmount,
      status: nextStatus,
    }).eq("id", booking.id);

    setSavingBookingId(null);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: nextStatus === "confirmed" ? "Request confirmed" : "Ready for payment" });
    load();
  };

  const declineRequest = async (booking: Booking) => {
    const { error } = await db.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      const service = serviceMap.get(booking.service_id);
      if (service?.requires_pet_approval) {
        await setPetApproval(booking.pet_id, booking.service_id, "declined", "Not a fit for this service right now.");
      } else {
        load();
      }
    }
  };

  const sendOwnerUpdate = async (booking: Booking, kind: "pickup" | "dropoff" | "note") => {
    const draft = getUpdateDraft(booking.id);
    setSendingUpdateId(`${booking.id}-${kind}`);
    const { data, error } = await supabase.functions.invoke("send-booking-update", {
      body: {
        bookingId: booking.id,
        kind,
        note: draft.note || undefined,
        sendSms: draft.sendSms,
      },
    });
    setSendingUpdateId(null);

    if (error) {
      toast({ title: "Couldn't send update", description: error.message, variant: "destructive" });
      return;
    }

    patchUpdateDraft(booking.id, { note: "" });
    toast({
      title: data?.smsSent ? "Update sent" : "Update saved",
      description: data?.message || (data?.smsSent ? "The owner received a text update." : "The update was logged without sending a text."),
    });
    load();
  };

  const summary = {
    requests: requestBookings.filter((booking) => booking.status === "requested").length,
    awaitingPayment: requestBookings.filter((booking) => booking.status === "awaiting_payment").length,
    approvals: pendingPetApprovals.filter((item) => item.status === "pending").length,
    blockedDays: blocked.length,
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <span className="inline-block -rotate-2 font-tag text-2xl text-clay">control room</span>
        <h1 className="font-display text-5xl text-primary sm:text-6xl">Sitter dashboard.</h1>
        <p className="mt-3 max-w-4xl text-sm text-foreground/75">
          One place to review pet fit, shape the day by service, cap each block, and approve requests without relying on broad open-ended hours.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {[
            ["Requests to review", String(summary.requests)],
            ["Ready for payment", String(summary.awaitingPayment)],
            ["Pet approvals", String(summary.approvals)],
            ["Blocked dates", String(summary.blockedDays)],
          ].map(([label, value]) => (
            <Card key={label} className="border-4 border-primary p-4 shadow-pop">
              <div className="text-xs uppercase text-muted-foreground">{label}</div>
              <div className="mt-2 font-display text-4xl text-primary">{value}</div>
            </Card>
          ))}
        </div>

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Service playbook</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id} className="border-4 border-primary p-4 shadow-pop-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl uppercase text-primary">{service.name}</h3>
                  <p className="mt-1 text-xs uppercase text-muted-foreground">
                    {service.scheduling_mode === "boarding" ? "Boarding review" : service.approval_required ? "Manual approval" : "Instant booking"}
                  </p>
                </div>
                {service.requires_pet_approval && <ShieldCheck className="h-5 w-5 text-clay" />}
              </div>
              <div className="mt-3 space-y-1 text-sm text-foreground/75">
                <p>Buffer: {service.turnaround_buffer_minutes} min</p>
                <p>Capacity limit: {service.max_capacity}</p>
                {service.extra_time_fee_cents && service.extra_time_increment_minutes && (
                  <p>Add-on: {formatPriceWithDecimals(service.extra_time_fee_cents)} / {service.extra_time_increment_minutes} min</p>
                )}
                {service.late_pickup_fee_cents && <p>Late pickup: {formatPriceWithDecimals(service.late_pickup_fee_cents)}</p>}
                {service.slug === "boarding" && (
                  <p>Noon-to-noon: {minutesToTime(service.boarding_checkin_minute ?? 12 * 60)} → {minutesToTime(service.boarding_checkout_minute ?? 12 * 60)}</p>
                )}
              </div>
            </Card>
          ))}
        </div>

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Pet fit approvals</h2>
        {pendingPetApprovals.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No pets waiting for a fit decision.</p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {pendingPetApprovals.map((approval) => (
              <Card key={approval.key} className="border-4 border-primary p-4 shadow-pop-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-xl uppercase text-primary">{approval.petName}</div>
                    <div className="text-sm text-foreground/75">{approval.serviceName}</div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-display uppercase ${approval.status === "approved" ? "bg-secondary text-secondary-foreground" : approval.status === "declined" ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground"}`}>
                    {approval.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setPetApproval(approval.petId, approval.serviceId, "approved", "Good fit for this service.")} className="bg-primary font-display uppercase shadow-pop-accent">
                    <Check className="h-4 w-4" /> Approve pet
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPetApproval(approval.petId, approval.serviceId, "declined", "Not a fit for this service right now.")} className="border-2 border-primary font-display uppercase">
                    <X className="h-4 w-4" /> Not a fit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Approval queue</h2>
        {requestBookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No requests waiting right now.</p>
        ) : (
          <div className="mt-3 grid gap-4">
            {requestBookings.map((booking) => {
              const draft = getDraft(booking);
              const service = serviceMap.get(booking.service_id);
              const variant = booking.service_variant_id ? variantMap.get(booking.service_variant_id) : null;
              const owner = profileDetails[booking.customer_id];
              const approval = petApprovals.find((item) => item.pet_id === booking.pet_id && item.service_id === booking.service_id);
              const isBoarding = service?.slug === "boarding";
              const extraFee = service?.extra_time_fee_cents && service.extra_time_increment_minutes
                ? Math.ceil(Math.max(0, draft.extraTimeMinutes) / service.extra_time_increment_minutes) * service.extra_time_fee_cents
                : 0;
              const lateFee = draft.latePickup ? service?.late_pickup_fee_cents ?? 0 : 0;
              const projectedTotal = (variant?.price_cents ?? booking.base_price_cents ?? booking.total_cents) + extraFee + lateFee;
              return (
                <Card key={booking.id} className="border-4 border-primary p-4 shadow-pop sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-xl uppercase">{variant?.name ?? booking.services?.name}</span>
                        <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[booking.status] ?? ""}`}>
                          {STATUS_LABELS[booking.status] ?? booking.status}
                        </span>
                        {service?.requires_pet_approval && approval && (
                          <span className={`px-2 py-0.5 text-xs font-display uppercase ${approval.status === "approved" ? "bg-secondary text-secondary-foreground" : approval.status === "declined" ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground"}`}>
                            Pet {approval.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-foreground/80">
                        {owner?.full_name ?? "Customer"} · <span className="font-tag text-lg text-clay">{booking.pets?.name}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">Requested: {formatBookingSchedule(booking)}</p>
                      {booking.notes && <p className="mt-2 text-xs text-muted-foreground">Customer notes: “{booking.notes}”</p>}
                    </div>
                    <div className="rounded-xl border-2 border-primary bg-muted px-3 py-2 text-sm">
                      <div className="font-display uppercase text-primary">Projected total</div>
                      <div className="mt-1 font-display text-2xl">{formatPriceWithDecimals(projectedTotal)}</div>
                      <div className="text-xs text-muted-foreground">
                        {variant?.payment_mode === "deposit" ? `${formatPriceWithDecimals(Math.round(projectedTotal * 0.25))} due after approval` : variant?.payment_mode === "free" ? "No payment due" : `${formatPriceWithDecimals(projectedTotal)} due after approval`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6 xl:items-end">
                    <div>
                      <Label>{isBoarding ? "Check-in day" : "Date"}</Label>
                      <Input value={draft.date} type="date" onChange={(event) => patchDraft(booking, { date: event.target.value, ...(isBoarding ? { endDate: format(addDays(new Date(`${event.target.value}T00:00:00`), 1), "yyyy-MM-dd") } : {}) })} />
                    </div>
                    {isBoarding && (
                      <div>
                        <Label>Checkout day</Label>
                        <Input value={draft.endDate} type="date" onChange={(event) => patchDraft(booking, { endDate: event.target.value })} />
                      </div>
                    )}
                    <div>
                      <Label>{isBoarding ? "Check-in" : "Start"}</Label>
                      <Input value={draft.start} type="time" onChange={(event) => patchDraft(booking, { start: event.target.value })} />
                    </div>
                    <div>
                      <Label>{isBoarding ? "Checkout" : "End"}</Label>
                      <Input value={draft.end} type="time" onChange={(event) => patchDraft(booking, { end: event.target.value })} />
                    </div>
                    <div>
                      <Label>{booking.services?.slug === "group-walk" ? "Group label" : "Internal note"}</Label>
                      <Input
                        value={booking.services?.slug === "group-walk" ? draft.groupLabel : draft.internalNotes}
                        onChange={(event) => patchDraft(booking, booking.services?.slug === "group-walk" ? { groupLabel: event.target.value } : { internalNotes: event.target.value })}
                        placeholder={booking.services?.slug === "group-walk" ? "Calm midday crew" : "Good fit after lunch"}
                      />
                    </div>
                    <div>
                      <Label>Extra time (min)</Label>
                      <Input type="number" min={0} step={15} value={draft.extraTimeMinutes} onChange={(event) => patchDraft(booking, { extraTimeMinutes: Number(event.target.value) || 0 })} />
                    </div>
                  </div>

                  {service?.late_pickup_fee_cents && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                      <Checkbox id={`late-pickup-${booking.id}`} checked={draft.latePickup} onCheckedChange={(checked) => patchDraft(booking, { latePickup: checked === true })} />
                      <Label htmlFor={`late-pickup-${booking.id}`} className="text-sm text-foreground">
                        Apply late pickup fee ({formatPriceWithDecimals(service.late_pickup_fee_cents)})
                      </Label>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {booking.status !== "confirmed" && booking.status !== "awaiting_payment" && (
                      <Button onClick={() => approveRequest(booking)} disabled={savingBookingId === booking.id} className="bg-primary font-display uppercase shadow-pop-accent">
                        <Check className="h-4 w-4" />
                        {savingBookingId === booking.id ? "Saving…" : variant?.payment_mode === "free" ? "Approve & confirm" : "Approve & request payment"}
                      </Button>
                    )}
                    {booking.status !== "cancelled" && booking.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => declineRequest(booking)} className="border-2 border-primary font-display uppercase">
                        <X className="h-4 w-4" /> Decline
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

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Today’s owner updates</h2>
        {careUpdateBookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No confirmed care visits need updates right now.</p>
        ) : (
          <div className="mt-3 grid gap-4">
            {careUpdateBookings.map((booking) => {
              const owner = profileDetails[booking.customer_id] ?? { full_name: "Customer", mobile_phone: null, sms_opt_in: false };
              const draft = getUpdateDraft(booking.id);
              const updates = bookingUpdates[booking.id] ?? [];
              const smsReady = owner.sms_opt_in && Boolean(owner.mobile_phone);
              return (
                <Card key={booking.id} className="border-4 border-primary p-4 shadow-pop sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-xl uppercase">{booking.pets?.name}</span>
                        <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[booking.status] ?? ""}`}>
                          {STATUS_LABELS[booking.status] ?? booking.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-foreground/80">
                        {booking.service_variants?.name ?? booking.services?.name} · {formatBookingSchedule(booking)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">Owner: {owner.full_name}</p>
                    </div>
                    <div className="rounded-xl border-2 border-primary bg-muted px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 font-display uppercase text-primary">
                        <Smartphone className="h-4 w-4" />
                        {smsReady ? "Texts on" : "Log only"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {smsReady ? owner.mobile_phone : "No mobile number or text opt-in on file"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr,1fr] xl:grid-cols-[1fr,1fr,1.2fr,auto] xl:items-end">
                    <Button onClick={() => sendOwnerUpdate(booking, "pickup")} disabled={sendingUpdateId === `${booking.id}-pickup`} className="h-12 bg-primary font-display uppercase shadow-pop-accent">
                      {sendingUpdateId === `${booking.id}-pickup` ? "Sending…" : "Picked up"}
                    </Button>
                    <Button onClick={() => sendOwnerUpdate(booking, "dropoff")} disabled={sendingUpdateId === `${booking.id}-dropoff`} variant="outline" className="h-12 border-2 border-primary font-display uppercase">
                      {sendingUpdateId === `${booking.id}-dropoff` ? "Sending…" : "Dropped off"}
                    </Button>
                    <div>
                      <Label>Quick note</Label>
                      <Input value={draft.note} maxLength={240} onChange={(event) => patchUpdateDraft(booking.id, { note: event.target.value })} placeholder="Happy walk, muddy paws, ate well, calm in the car…" />
                    </div>
                    <Button onClick={() => sendOwnerUpdate(booking, "note")} disabled={sendingUpdateId === `${booking.id}-note` || draft.note.trim().length === 0} variant="secondary" className="h-12 font-display uppercase">
                      <MessageSquare className="h-4 w-4" />
                      {sendingUpdateId === `${booking.id}-note` ? "Sending…" : "Send note"}
                    </Button>
                  </div>

                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <Checkbox id={`send-sms-${booking.id}`} checked={draft.sendSms} onCheckedChange={(checked) => patchUpdateDraft(booking.id, { sendSms: checked === true })} />
                    <Label htmlFor={`send-sms-${booking.id}`} className="text-sm text-foreground">Text the owner when possible</Label>
                  </div>

                  {updates.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                      <h3 className="font-display text-sm uppercase text-primary">Recent updates</h3>
                      <ul className="mt-2 space-y-2">
                        {updates.slice(0, 3).map((update) => (
                          <li key={update.id} className="border border-border bg-muted/50 px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-display text-xs uppercase text-primary">{updateKindLabel[update.kind]}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatUpdateTime(update.created_at)}{update.sent_via_sms ? " · texted" : ""}
                              </span>
                            </div>
                            {update.message && <p className="mt-1 text-foreground/80">{update.message}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Walk request windows</h2>
        <p className="mt-1 text-sm text-muted-foreground">Build compact, service-specific windows with capacity limits instead of vague open hours.</p>
        <Card className="mt-3 border-4 border-primary p-4 shadow-pop sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr,1fr,auto,auto,auto,auto,auto] md:items-end">
            <div>
              <Label>Walk type</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newWindow.serviceId} onChange={(event) => setNewWindow({ ...newWindow, serviceId: event.target.value })}>
                {walkServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Label</Label>
              <Input value={newWindow.label} onChange={(event) => setNewWindow({ ...newWindow, label: event.target.value })} placeholder="Morning" />
            </div>
            <div>
              <Label>Day</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newWindow.weekday} onChange={(event) => setNewWindow({ ...newWindow, weekday: Number(event.target.value) })}>
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
            <div>
              <Label>Capacity</Label>
              <Input type="number" min={1} value={newWindow.maxBookings} onChange={(event) => setNewWindow({ ...newWindow, maxBookings: Math.max(1, Number(event.target.value) || 1) })} />
            </div>
            <Button onClick={addWalkWindow} className="bg-primary font-display uppercase shadow-pop-accent"><Plus className="h-4 w-4" /> Add</Button>
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
                        <li key={window.id} className="border-2 border-primary bg-muted px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-display text-sm uppercase">{DAYS[window.weekday]} · {window.window_label}</div>
                              <div className="text-xs text-muted-foreground">{formatMinuteTime(window.start_minute)}–{formatMinuteTime(window.end_minute)}</div>
                            </div>
                            <button onClick={() => removeWalkWindow(window.id)} aria-label="Remove walk window">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </div>
                          <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-card px-2 py-1.5 text-sm">
                            <span>Capacity</span>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => updateWalkWindowCapacity(window.id, window.max_bookings - 1)}><Minus className="h-4 w-4" /></button>
                              <span className="font-display text-base uppercase">{window.max_bookings}</span>
                              <button type="button" onClick={() => updateWalkWindowCapacity(window.id, window.max_bookings + 1)}><Plus className="h-4 w-4" /></button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Exact-slot schedule builder</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use tighter blocks and per-block capacity instead of broad “available all day” windows.</p>
        <Card className="mt-3 border-4 border-primary p-4 shadow-pop sm:p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {TIME_PRESETS.map((preset) => (
              <Button key={preset.label} type="button" variant="outline" className="border-2 border-primary font-display uppercase" onClick={() => setNewAvailability((current) => ({ ...current, start: preset.start, end: preset.end }))}>
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr,auto,auto,auto,auto] sm:items-end">
            <div>
              <Label>Day</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newAvailability.weekday} onChange={(event) => setNewAvailability({ ...newAvailability, weekday: Number(event.target.value) })}>
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
            <div>
              <Label>Capacity</Label>
              <Input type="number" min={1} value={newAvailability.maxBookings} onChange={(event) => setNewAvailability({ ...newAvailability, maxBookings: Math.max(1, Number(event.target.value) || 1) })} />
            </div>
            <Button onClick={addAvailability} className="bg-primary font-display uppercase shadow-pop-accent"><Plus className="h-4 w-4" /> Add</Button>
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
                  <li key={slot.id} className="border-2 border-primary bg-muted px-3 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <span className="text-sm">
                        <span className="font-display uppercase">{DAYS[slot.weekday]}</span> · {formatMinuteTime(slot.start_minute)}–{formatMinuteTime(slot.end_minute)}
                      </span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-sm">
                          <Clock3 className="h-4 w-4 text-muted-foreground" />
                          <span>Capacity</span>
                          <button type="button" onClick={() => updateAvailabilityCapacity(slot.id, slot.max_bookings - 1)}><Minus className="h-4 w-4" /></button>
                          <span className="font-display uppercase">{slot.max_bookings}</span>
                          <button type="button" onClick={() => updateAvailabilityCapacity(slot.id, slot.max_bookings + 1)}><Plus className="h-4 w-4" /></button>
                        </div>
                        <button onClick={() => removeAvailability(slot.id)} aria-label="Remove slot"><Trash2 className="h-4 w-4 text-destructive" /></button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {exactSlotServices.map((service) => {
                        const enabled = tagged.has(service.id);
                        return (
                          <button key={service.id} type="button" onClick={() => toggleSlotService(slot.id, service.id, !enabled)} className={cn("border-2 border-primary px-2 py-1 text-xs font-display uppercase transition-colors", enabled ? "bg-secondary text-secondary-foreground" : "bg-card text-muted-foreground hover:bg-card/80")} aria-pressed={enabled}>
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
              <Button onClick={addBlockedDate} disabled={!blockDate} className="mt-3 bg-primary font-display uppercase shadow-pop-accent"><CalendarOff className="h-4 w-4" /> Block date</Button>
              {blocked.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {blocked.map((blockedDate) => (
                    <li key={blockedDate.id} className="flex items-center justify-between border-2 border-primary bg-muted px-3 py-2">
                      <span className="text-sm">
                        <span className="font-display uppercase">{format(new Date(`${blockedDate.blocked_date}T12:00:00`), "EEE, MMM d")}</span>
                        {blockedDate.reason && <span className="ml-2 text-muted-foreground">— {blockedDate.reason}</span>}
                      </span>
                      <button onClick={() => removeBlockedDate(blockedDate.id)} aria-label="Remove blocked date"><Trash2 className="h-4 w-4 text-destructive" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        <h2 className="mt-12 font-display text-2xl uppercase text-primary">Upcoming exact-time bookings</h2>
        {upcomingExactBookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No upcoming exact-time bookings right now.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {upcomingExactBookings.map((booking) => (
              <article key={booking.id} className="border-4 border-primary bg-card p-4 shadow-pop">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xl uppercase">{booking.service_variants?.name ?? booking.services?.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[booking.status] ?? ""}`}>
                        {STATUS_LABELS[booking.status] ?? booking.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">
                      {formatBookingSchedule(booking)} · {profileDetails[booking.customer_id]?.full_name ?? "Customer"} · <span className="font-tag text-lg text-clay">{booking.pets?.name}</span>
                    </p>
                    {(booking.extra_time_fee_cents > 0 || booking.late_pickup_fee_cents > 0) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Fees: {booking.extra_time_fee_cents > 0 ? `${formatPriceWithDecimals(booking.extra_time_fee_cents)} add-on` : ""}{booking.extra_time_fee_cents > 0 && booking.late_pickup_fee_cents > 0 ? " · " : ""}{booking.late_pickup_fee_cents > 0 ? `${formatPriceWithDecimals(booking.late_pickup_fee_cents)} late pickup` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {booking.status !== "cancelled" && booking.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => updateBookingStatus(booking.id, "cancelled")} className="border-2 border-primary font-display uppercase"><X className="h-4 w-4" /> Cancel</Button>
                    )}
                    {booking.status === "confirmed" && (
                      <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(booking.id, "completed")} className="font-display uppercase"><Check className="h-4 w-4" /> Mark done</Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {pastBookings.length > 0 && (
          <>
            <h2 className="mt-12 font-display text-2xl uppercase text-primary">Recent bookings</h2>
            <ul className="mt-3 space-y-2">
              {pastBookings.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-primary bg-card px-3 py-2 text-sm">
                  <span>{formatBookingSchedule(booking)} · {booking.service_variants?.name ?? booking.services?.name} · {booking.pets?.name}</span>
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
