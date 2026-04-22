import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { Link } from "react-router-dom";
import {
  BellRing,
  CalendarDays,
  CalendarOff,
  Check,
  ChevronRight,
  Clock3,
  Filter,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Minus,
  Plus,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  DAYS,
  formatBookingSchedule,
  formatPriceWithDecimals,
  minutesToTime,
  STATUS_LABELS,
  STATUS_STYLES,
  timeToMinutes,
} from "@/lib/booking";
import { cn } from "@/lib/utils";

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

type ProfileDetails = {
  full_name: string;
  mobile_phone: string | null;
  sms_opt_in: boolean;
};

type BookingUpdate = {
  id: string;
  booking_id: string;
  kind: "pickup" | "dropoff" | "note";
  message: string | null;
  sent_via_sms: boolean;
  created_at: string;
};

type UpdateDraft = { note: string; sendSms: boolean };

type ClientMessage = {
  id: string;
  customer_id: string;
  booking_id: string | null;
  kind: "service_update" | "customer_service" | "offer";
  subject: string;
  message: string;
  send_email: boolean;
  send_sms: boolean;
  delivered_email_at: string | null;
  delivered_sms_at: string | null;
  created_at: string;
};

type ServiceAlert = {
  id: string;
  kind: "hours_update" | "closure" | "announcement" | "promo";
  title: string;
  message: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  pin_to_profile: boolean;
  created_at: string;
};

type ClientMessageDraft = {
  customerId: string;
  bookingId: string;
  kind: ClientMessage["kind"];
  subject: string;
  message: string;
  sendEmail: boolean;
  sendSms: boolean;
};

type AlertDraft = {
  kind: ServiceAlert["kind"];
  title: string;
  message: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  pinToProfile: boolean;
};

type TabKey = "overview" | "clients" | "schedule" | "care" | "alerts";
type MessageAudience = "single" | "group";

const WALK_SLUGS = new Set(["solo-walk", "group-walk"]);
const MIN_BUFFER_MINUTES = 30;
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

const kindCopy: Record<ClientMessage["kind"], string> = {
  customer_service: "Support",
  service_update: "Update",
  offer: "Offer",
};

const tabMeta: Array<{ value: TabKey; label: string; icon: typeof LayoutDashboard }> = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "clients", label: "Clients", icon: UserRound },
  { value: "schedule", label: "Schedule", icon: CalendarDays },
  { value: "care", label: "Care", icon: MessageSquare },
  { value: "alerts", label: "Alerts", icon: Megaphone },
];

const SitterDashboard = () => {
  const db = supabase as any;
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [messageAudience, setMessageAudience] = useState<MessageAudience>("single");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const requestCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceVariants, setServiceVariants] = useState<ServiceVariant[]>([]);
  const [availabilityServices, setAvailabilityServices] = useState<AvailabilityService[]>([]);
  const [walkWindows, setWalkWindows] = useState<WalkWindow[]>([]);
  const [petApprovals, setPetApprovals] = useState<PetApproval[]>([]);
  const [clientMessages, setClientMessages] = useState<ClientMessage[]>([]);
  const [serviceAlerts, setServiceAlerts] = useState<ServiceAlert[]>([]);
  const [profileDetails, setProfileDetails] = useState<Record<string, ProfileDetails>>({});
  const [bookingUpdates, setBookingUpdates] = useState<Record<string, BookingUpdate[]>>({});

  const [newAvailability, setNewAvailability] = useState({ weekday: 1, start: "09:00", end: "12:00", maxBookings: 1 });
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);
  const [blockDate, setBlockDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");
  const [newWindow, setNewWindow] = useState({ serviceId: "", weekday: 1, label: "Morning", start: "09:00", end: "11:00", maxBookings: 4 });
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, Draft>>({});
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, UpdateDraft>>({});
  const [clientMessageDraft, setClientMessageDraft] = useState<ClientMessageDraft>({
    customerId: "",
    bookingId: "",
    kind: "customer_service",
    subject: "",
    message: "",
    sendEmail: true,
    sendSms: false,
  });
  const [alertDraft, setAlertDraft] = useState<AlertDraft>({
    kind: "announcement",
    title: "",
    message: "",
    startsAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endsAt: "",
    isActive: true,
    pinToProfile: true,
  });

  const [savingBookingId, setSavingBookingId] = useState<string | null>(null);
  const [sendingUpdateId, setSendingUpdateId] = useState<string | null>(null);
  const [sendingClientMessage, setSendingClientMessage] = useState(false);
  const [savingAlert, setSavingAlert] = useState(false);

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
      { data: messageRows },
      { data: alertRows },
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
      db.from("client_messages").select("id, customer_id, booking_id, kind, subject, message, send_email, send_sms, delivered_email_at, delivered_sms_at, created_at").eq("sitter_id", user.id).order("created_at", { ascending: false }).limit(50),
      db.from("service_alerts").select("id, kind, title, message, starts_at, ends_at, is_active, pin_to_profile, created_at").eq("sitter_id", user.id).order("starts_at", { ascending: false }).limit(20),
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
    setClientMessages((messageRows ?? []) as ClientMessage[]);
    setServiceAlerts((alertRows ?? []) as ServiceAlert[]);

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

    setNewServiceIds((current) => (current.length ? current : nextServices.map((service) => service.id)));
    setNewWindow((current) => ({
      ...current,
      serviceId: current.serviceId || nextServices.find((service) => WALK_SLUGS.has(service.slug))?.id || "",
    }));

    if (!selectedClientId && customerIds[0]) setSelectedClientId(customerIds[0]);
    setSelectedRecipientIds((current) => (current.length ? current.filter((id) => customerIds.includes(id)) : customerIds.slice(0, 2)));
    setClientMessageDraft((current) => {
      const fallbackCustomerId = current.customerId || customerIds[0] || "";
      return {
        ...current,
        customerId: fallbackCustomerId,
        bookingId:
          current.bookingId ||
          nextBookings.find((booking) => booking.customer_id === fallbackCustomerId)?.id ||
          nextBookings[0]?.id ||
          "",
      };
    });
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    if (activeTab !== "overview" || !selectedRequestId) return;

    const frame = window.requestAnimationFrame(() => {
      requestCardRefs.current[selectedRequestId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, selectedRequestId, bookings.length]);

  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const variantMap = useMemo(() => new Map(serviceVariants.map((variant) => [variant.id, variant])), [serviceVariants]);
  const walkServices = useMemo(() => services.filter((service) => WALK_SLUGS.has(service.slug)), [services]);
  const exactSlotServices = useMemo(() => services, [services]);

  const tagsBySlot = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of availabilityServices) {
      if (!map.has(row.availability_id)) map.set(row.availability_id, new Set());
      map.get(row.availability_id)?.add(row.service_id);
    }
    return map;
  }, [availabilityServices]);

  const requestBookings = useMemo(
    () => bookings.filter((booking) => ["requested", "awaiting_payment", "pending_payment", "confirmed"].includes(booking.status)),
    [bookings],
  );
  const upcomingExactBookings = useMemo(
    () => bookings.filter((booking) => booking.status === "confirmed" && new Date(booking.scheduled_start_at ?? booking.start_at) > new Date()),
    [bookings],
  );
  const careUpdateBookings = useMemo(
    () => bookings
      .filter((booking) => booking.status === "confirmed" && new Date(booking.scheduled_start_at ?? booking.start_at) > new Date(Date.now() - 12 * 60 * 60 * 1000))
      .sort((a, b) => new Date(b.scheduled_start_at ?? b.start_at).getTime() - new Date(a.scheduled_start_at ?? a.start_at).getTime()),
    [bookings],
  );
  const pastBookings = useMemo(
    () => bookings.filter((booking) => new Date(booking.scheduled_start_at ?? booking.start_at) <= new Date()),
    [bookings],
  );

  const clientOptions = useMemo(
    () => Object.entries(profileDetails).map(([id, profile]) => ({ id, ...profile })).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [profileDetails],
  );

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return clientOptions;
    return clientOptions.filter((client) => {
      const bookingsForClient = bookings.filter((booking) => booking.customer_id === client.id);
      return (
        client.full_name.toLowerCase().includes(query) ||
        bookingsForClient.some((booking) => (booking.pets?.name ?? "").toLowerCase().includes(query))
      );
    });
  }, [bookings, clientOptions, clientSearch]);

  const selectedClientProfile = selectedClientId ? profileDetails[selectedClientId] : null;
  const selectedClientBookings = useMemo(
    () => bookings.filter((booking) => booking.customer_id === selectedClientId),
    [bookings, selectedClientId],
  );
  const selectedClientMessageLog = useMemo(
    () => clientMessages.filter((message) => message.customer_id === selectedClientId).slice(0, 8),
    [clientMessages, selectedClientId],
  );
  const activeClientBookings = useMemo(
    () => bookings.filter((booking) => booking.customer_id === clientMessageDraft.customerId),
    [bookings, clientMessageDraft.customerId],
  );
  const selectedDraftClientProfile = clientMessageDraft.customerId ? profileDetails[clientMessageDraft.customerId] : null;

  const pendingPetApprovals = useMemo(() => {
    const seen = new Set<string>();
    return requestBookings.flatMap((booking) => {
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
  }, [petApprovals, requestBookings, serviceMap]);

  const weeklySchedule = useMemo(
    () => DAYS.map((day, weekday) => ({
      day,
      slots: availability.filter((slot) => slot.weekday === weekday),
      windows: walkWindows.filter((window) => window.weekday === weekday),
    })),
    [availability, walkWindows],
  );

  const serviceCoverage = useMemo(
    () => services.map((service) => ({
      service,
      slotCount: availability.filter((slot) => tagsBySlot.get(slot.id)?.has(service.id)).length,
      windowCount: walkWindows.filter((window) => window.service_id === service.id).length,
      upcomingCount: upcomingExactBookings.filter((booking) => booking.service_id === service.id).length,
    })),
    [availability, services, tagsBySlot, upcomingExactBookings, walkWindows],
  );

  const summary = {
    requests: requestBookings.filter((booking) => booking.status === "requested").length,
    awaitingPayment: requestBookings.filter((booking) => booking.status === "awaiting_payment").length,
    approvals: pendingPetApprovals.filter((item) => item.status === "pending").length,
    blockedDays: blocked.length,
    clients: clientOptions.length,
  };

  const hasBufferedMinuteConflict = (ranges: Array<{ start: number; end: number }>, start: number, end: number) =>
    ranges.some((range) => start < range.end + MIN_BUFFER_MINUTES && end > range.start - MIN_BUFFER_MINUTES);

  const hasBufferedBookingConflict = (startAt: Date, endAt: Date, bookingId?: string) => {
    const nextStart = startAt.getTime();
    const nextEnd = endAt.getTime();

    return bookings.some((booking) => {
      if (booking.id === bookingId) return false;
      if (["cancelled", "completed", "refunded"].includes(booking.status)) return false;

      const existingStart = new Date(booking.scheduled_start_at ?? booking.start_at).getTime();
      const existingEnd = new Date(booking.scheduled_end_at ?? booking.end_at).getTime();
      return nextStart < existingEnd + MIN_BUFFER_MINUTES * 60 * 1000 && nextEnd > existingStart - MIN_BUFFER_MINUTES * 60 * 1000;
    });
  };

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
    if (hasBufferedMinuteConflict(availability.filter((slot) => slot.weekday === newAvailability.weekday).map((slot) => ({ start: slot.start_minute, end: slot.end_minute })), start, end)) {
      return toast({ title: "Leave a 30 minute gap between booking blocks", variant: "destructive" });
    }

    const { data: inserted, error } = await db
      .from("availability")
      .insert({ sitter_id: user.id, weekday: newAvailability.weekday, start_minute: start, end_minute: end, max_bookings: newAvailability.maxBookings })
      .select("id")
      .single();
    if (error || !inserted) return toast({ title: "Failed", description: error?.message, variant: "destructive" });

    const links = newServiceIds.map((serviceId) => ({ availability_id: inserted.id, service_id: serviceId }));
    const { error: linkError } = await db.from("availability_services").insert(links);
    if (linkError) toast({ title: "Block saved, but service tags failed", description: linkError.message, variant: "destructive" });
    else toast({ title: "Booking block added" });
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

    const sameDayWindows = walkWindows.filter((window) => window.weekday === newWindow.weekday).map((window) => ({ start: window.start_minute, end: window.end_minute }));
    if (hasBufferedMinuteConflict(sameDayWindows, start, end)) {
      return toast({ title: "Walk windows need a 30 minute gap", variant: "destructive" });
    }

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
      endDate:
        service?.slug === "boarding"
          ? format(addDays(new Date(booking.requested_date ?? booking.start_at), 1), "yyyy-MM-dd")
          : booking.requested_date ?? format(new Date(booking.start_at), "yyyy-MM-dd"),
      start:
        booking.requested_window_start_minute != null
          ? formatMinuteTime(booking.requested_window_start_minute)
          : formatMinuteTime(service?.slug === "boarding" ? boardingStart : timeToMinutes("09:00")),
      end:
        booking.requested_window_end_minute != null
          ? formatMinuteTime(booking.requested_window_end_minute)
          : formatMinuteTime(service?.slug === "boarding" ? boardingEnd : (variant?.duration_minutes ?? 60) + timeToMinutes("09:00")),
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
    const { error } = await db.from("sitter_pet_approvals").upsert(
      {
        sitter_id: user.id,
        pet_id: petId,
        service_id: serviceId,
        status,
        notes: notes ?? null,
      },
      { onConflict: "sitter_id,pet_id,service_id" },
    );
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

    const minimumDuration = variant.duration_minutes ?? 0;
    const startMinute = service.slug === "boarding" ? (service.boarding_checkin_minute ?? 12 * 60) : timeToMinutes(draft.start);
    const endMinute = service.slug === "boarding" ? (service.boarding_checkout_minute ?? 12 * 60) : timeToMinutes(draft.end);
    if (endMinute <= startMinute && service.slug !== "boarding") return toast({ title: "End must be after start", variant: "destructive" });
    if (service.slug !== "boarding" && endMinute - startMinute < minimumDuration) {
      return toast({ title: `This service needs at least ${minimumDuration} minutes`, variant: "destructive" });
    }

    setSavingBookingId(booking.id);
    const startAt = new Date(`${draft.date}T00:00:00`);
    startAt.setMinutes(startMinute);
    const endDateValue = service.slug === "boarding" ? draft.endDate : draft.date;
    const endAt = new Date(`${endDateValue}T00:00:00`);
    endAt.setMinutes(endMinute);

    if (hasBufferedBookingConflict(startAt, endAt, booking.id)) {
      setSavingBookingId(null);
      return toast({ title: "This timing overlaps another booking", description: "Keep at least 30 minutes between visits.", variant: "destructive" });
    }

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

    toast({ title: nextStatus === "confirmed" ? "Request confirmed" : "Payment opened" });
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

  const deleteBooking = async (booking: Booking) => {
    const label = booking.service_variants?.name ?? booking.services?.name ?? "this booking";
    if (!window.confirm(`Delete ${label}? This removes it from the dashboard permanently.`)) return;

    const { error } = await db.from("bookings").delete().eq("id", booking.id);
    if (error) {
      toast({ title: "Couldn't delete booking", description: error.message, variant: "destructive" });
      return;
    }

    if (selectedRequestId === booking.id) setSelectedRequestId(null);
    toast({ title: "Booking deleted" });
    load();
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

    if (error || data?.ok === false) {
      toast({ title: "Couldn't send update", description: error?.message ?? data?.error ?? "Unknown error", variant: "destructive" });
      return;
    }

    patchUpdateDraft(booking.id, { note: "" });
    toast({
      title: data?.smsSent ? "Update sent" : "Update saved",
      description: data?.smsError ?? data?.message ?? (data?.smsSent ? "The owner received a text update." : "The update was logged without sending a text."),
    });
    load();
  };

  const sendClientMessage = async () => {
    const recipientIds = messageAudience === "group" ? selectedRecipientIds : [clientMessageDraft.customerId].filter(Boolean);
    if (recipientIds.length === 0 || !clientMessageDraft.subject.trim() || !clientMessageDraft.message.trim()) {
      toast({ title: "Choose recipient clients, add a subject, and write the message first", variant: "destructive" });
      return;
    }

    setSendingClientMessage(true);
    const results = await Promise.all(
      recipientIds.map(async (customerId) => {
        const bookingId = messageAudience === "single" && customerId === clientMessageDraft.customerId ? clientMessageDraft.bookingId || undefined : undefined;
        const response = await supabase.functions.invoke("send-client-message", {
          body: {
            customerId,
            bookingId,
            kind: clientMessageDraft.kind,
            subject: clientMessageDraft.subject,
            message: clientMessageDraft.message,
            sendEmail: clientMessageDraft.sendEmail,
            sendSms: clientMessageDraft.sendSms,
          },
        });

        return { customerId, ...response };
      }),
    );
    setSendingClientMessage(false);

    const failures = results.filter((result) => result.error || result.data?.ok === false);
    if (failures.length > 0) {
      toast({
        title: "Some messages did not send",
        description: failures[0]?.error?.message ?? failures[0]?.data?.error ?? "Please review the selected clients and try again.",
        variant: "destructive",
      });
      return;
    }

    const smsWarnings = results.map((result) => result.data?.smsError).filter(Boolean).join(" ");
    toast({
      title: messageAudience === "group" ? `Message sent to ${recipientIds.length} clients` : "Client message saved",
      description: smsWarnings || (messageAudience === "group" ? "Each selected client now has the message in their hub." : "The update is now in the client hub."),
    });
    setClientMessageDraft((current) => ({ ...current, subject: "", message: "" }));
    load();
  };

  const deleteClientMessage = async (message: ClientMessage) => {
    if (!window.confirm(`Delete “${message.subject}”? This removes it from the client's message history.`)) return;

    const { error } = await db.from("client_messages").delete().eq("id", message.id);
    if (error) {
      toast({ title: "Couldn't delete message", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Message deleted" });
    load();
  };

  const deleteServiceAlert = async (alert: ServiceAlert) => {
    if (!window.confirm(`Delete “${alert.title}”? This notice will disappear for clients.`)) return;

    const { error } = await db.from("service_alerts").delete().eq("id", alert.id);
    if (error) {
      toast({ title: "Couldn't delete alert", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Alert deleted" });
    load();
  };

  const saveServiceAlert = async () => {
    if (!user) return;
    if (!alertDraft.title.trim() || !alertDraft.message.trim()) {
      toast({ title: "Add a title and message first", variant: "destructive" });
      return;
    }

    setSavingAlert(true);
    const { error } = await db.from("service_alerts").insert({
      sitter_id: user.id,
      kind: alertDraft.kind,
      title: alertDraft.title,
      message: alertDraft.message,
      starts_at: new Date(alertDraft.startsAt).toISOString(),
      ends_at: alertDraft.endsAt ? new Date(alertDraft.endsAt).toISOString() : null,
      is_active: alertDraft.isActive,
      pin_to_profile: alertDraft.pinToProfile,
      created_by: user.id,
    });
    setSavingAlert(false);

    if (error) {
      toast({ title: "Couldn't save alert", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Alert published" });
    setAlertDraft({
      kind: "announcement",
      title: "",
      message: "",
      startsAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endsAt: "",
      isActive: true,
      pinToProfile: true,
    });
    load();
  };

  const toggleServiceAlert = async (alert: ServiceAlert, next: boolean) => {
    const { error } = await db.from("service_alerts").update({ is_active: next }).eq("id", alert.id);
    if (error) toast({ title: "Couldn't update alert", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 border-b border-border pb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-block font-tag text-clay">control room</span>
              <h1 className="mt-2 font-display text-4xl text-primary sm:text-5xl">Sitter dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm text-foreground/75">
                Clear tabs for approvals, client communication, schedule building, and live care updates — with solo walks, group walks, pet sitting, and boarding all visible in one system.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Requests", String(summary.requests)],
                ["Payments", String(summary.awaitingPayment)],
                ["Approvals", String(summary.approvals)],
                ["Clients", String(summary.clients)],
              ].map(([label, value]) => (
                <Card key={label} className="border border-border bg-card px-4 py-3 shadow-soft">
                  <div className="text-[11px] font-tag text-muted-foreground">{label}</div>
                  <div className="mt-2 font-display text-3xl text-primary">{value}</div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)} className="mt-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-muted p-1 md:grid-cols-5">
            {tabMeta.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="min-h-11 gap-2 rounded-md px-3 py-2 font-display uppercase data-[state=active]:bg-card data-[state=active]:text-primary">
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
              <Card className="border border-border p-5 shadow-soft">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl uppercase text-primary">Approval queue</h2>
                    <p className="text-sm text-muted-foreground">Review fit, confirm timing, and keep the calendar realistic before opening payment.</p>
                  </div>
                </div>

                {requestBookings.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No requests waiting right now.</p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {requestBookings.slice(0, 4).map((booking) => {
                      const service = serviceMap.get(booking.service_id);
                      const owner = profileDetails[booking.customer_id];
                      const approval = petApprovals.find((item) => item.pet_id === booking.pet_id && item.service_id === booking.service_id);
                      return (
                        <div key={booking.id} className="rounded-md border border-border bg-muted/40 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-display text-lg uppercase text-primary">{booking.service_variants?.name ?? booking.services?.name}</span>
                                <span className={cn("px-2 py-0.5 text-[11px] font-tag", STATUS_STYLES[booking.status] ?? "bg-muted text-muted-foreground")}>
                                  {STATUS_LABELS[booking.status] ?? booking.status}
                                </span>
                                {service?.requires_pet_approval && approval && (
                                  <span className={cn("px-2 py-0.5 text-[11px] font-tag", approval.status === "approved" ? "bg-secondary text-secondary-foreground" : approval.status === "declined" ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground")}>
                                    Pet {approval.status}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-foreground/80">{owner?.full_name ?? "Customer"} · {booking.pets?.name ?? "Pet"}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{formatBookingSchedule(booking)}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequestId(booking.id);
                                setActiveTab("overview");
                              }}
                              className="border-border font-display uppercase"
                            >
                              Review <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="border border-border p-5 shadow-soft">
                <h2 className="font-display text-xl uppercase text-primary">Service playbook</h2>
                <div className="mt-4 grid gap-3">
                  {services.map((service) => (
                    <div key={service.id} className="rounded-md border border-border bg-muted/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-lg uppercase text-primary">{service.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {service.scheduling_mode === "boarding" ? "Noon-to-noon boarding" : WALK_SLUGS.has(service.slug) ? "Walk-specific schedule lanes" : "Exact booking blocks"}
                          </p>
                        </div>
                        {service.requires_pet_approval && <ShieldCheck className="h-4 w-4 text-clay" />}
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-foreground/80 sm:grid-cols-2">
                        <span>Buffer: {Math.max(service.turnaround_buffer_minutes, MIN_BUFFER_MINUTES)} min</span>
                        <span>Capacity: {service.max_capacity}</span>
                        {service.extra_time_fee_cents && service.extra_time_increment_minutes ? (
                          <span>Add-on: {formatPriceWithDecimals(service.extra_time_fee_cents)} / {service.extra_time_increment_minutes} min</span>
                        ) : (
                          <span>No extra-time fee preset</span>
                        )}
                        {service.slug === "boarding" ? (
                          <span>Check-in/out: {minutesToTime(service.boarding_checkin_minute ?? 12 * 60)} → {minutesToTime(service.boarding_checkout_minute ?? 12 * 60)}</span>
                        ) : (
                          <span>{service.late_pickup_fee_cents ? `Late fee: ${formatPriceWithDecimals(service.late_pickup_fee_cents)}` : "Late fees handled manually"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
              <Card className="border border-border p-5 shadow-soft">
                <h2 className="font-display text-xl uppercase text-primary">Pet fit approvals</h2>
                {pendingPetApprovals.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No pets waiting for a fit decision.</p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {pendingPetApprovals.map((approval) => (
                      <div key={approval.key} className="rounded-md border border-border bg-muted/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-lg uppercase text-primary">{approval.petName}</p>
                            <p className="text-sm text-muted-foreground">{approval.serviceName}</p>
                          </div>
                          <span className={cn("px-2 py-0.5 text-[11px] font-tag", approval.status === "approved" ? "bg-secondary text-secondary-foreground" : approval.status === "declined" ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground")}>
                            {approval.status}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => setPetApproval(approval.petId, approval.serviceId, "approved", "Good fit for this service.")} className="font-display uppercase">
                            <Check className="h-4 w-4" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setPetApproval(approval.petId, approval.serviceId, "declined", "Not a fit for this service right now.")} className="border-border font-display uppercase">
                            <X className="h-4 w-4" /> Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="border border-border p-5 shadow-soft">
                <h2 className="font-display text-xl uppercase text-primary">Weekly schedule snapshot</h2>
                <p className="mt-1 text-sm text-muted-foreground">Every service lane at a glance, including walk windows and exact booking blocks.</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {weeklySchedule.map((day) => (
                    <div key={day.day} className="rounded-md border border-border bg-muted/40 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-lg uppercase text-primary">{day.day}</h3>
                        <span className="text-[11px] font-tag text-muted-foreground">{day.slots.length} blocks · {day.windows.length} walk windows</span>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        {day.slots.slice(0, 3).map((slot) => (
                          <div key={slot.id} className="rounded-md border border-border bg-card px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span>{formatMinuteTime(slot.start_minute)}–{formatMinuteTime(slot.end_minute)}</span>
                              <span className="text-xs text-muted-foreground">Cap {slot.max_bookings}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {exactSlotServices.filter((service) => tagsBySlot.get(slot.id)?.has(service.id)).map((service) => (
                                <span key={service.id} className="rounded-md bg-card px-2 py-1 text-[11px] font-tag text-primary ring-1 ring-border">{service.name}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {day.windows.slice(0, 2).map((window) => (
                          <div key={window.id} className="rounded-md border border-border bg-card px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span>{formatMinuteTime(window.start_minute)}–{formatMinuteTime(window.end_minute)}</span>
                              <span className="text-xs text-muted-foreground">{serviceMap.get(window.service_id)?.name ?? "Walk"}</span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">{window.window_label} · cap {window.max_bookings}</div>
                          </div>
                        ))}
                        {day.slots.length === 0 && day.windows.length === 0 && <p className="text-sm text-muted-foreground">No schedule blocks yet.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {requestBookings.length > 0 && (
              <Card className="border border-border p-5 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl uppercase text-primary">Request approvals</h2>
                    <p className="text-sm text-muted-foreground">Set exact times, apply approved fees, and keep a 30 minute buffer between bookings.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
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
                      <div
                        key={booking.id}
                        ref={(node) => {
                          requestCardRefs.current[booking.id] = node;
                        }}
                        className={cn(
                          "rounded-md border bg-muted/40 p-4 transition-all",
                          selectedRequestId === booking.id ? "border-primary bg-card shadow-soft ring-2 ring-primary/20" : "border-border",
                        )}
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display text-xl uppercase text-primary">{variant?.name ?? booking.services?.name}</span>
                              <span className={cn("px-2 py-0.5 text-[11px] font-tag", STATUS_STYLES[booking.status] ?? "bg-muted text-muted-foreground")}>
                                {STATUS_LABELS[booking.status] ?? booking.status}
                              </span>
                              {service?.requires_pet_approval && approval && (
                                <span className={cn("px-2 py-0.5 text-[11px] font-tag", approval.status === "approved" ? "bg-secondary text-secondary-foreground" : approval.status === "declined" ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground")}>
                                  Pet {approval.status}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-foreground/80">{owner?.full_name ?? "Customer"} · {booking.pets?.name ?? "Pet"}</p>
                            <p className="mt-1 text-sm text-muted-foreground">Requested: {formatBookingSchedule(booking)}</p>
                            {booking.notes && <p className="mt-2 text-xs text-muted-foreground">Client note: “{booking.notes}”</p>}
                          </div>
                          <div className="rounded-md border border-border bg-card px-4 py-3 text-sm">
                            <div className="font-tag text-muted-foreground">Projected total</div>
                            <div className="mt-2 font-display text-2xl text-primary">{formatPriceWithDecimals(projectedTotal)}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {variant?.payment_mode === "deposit"
                                ? `${formatPriceWithDecimals(Math.round(projectedTotal * 0.25))} due after approval`
                                : variant?.payment_mode === "free"
                                  ? "No payment due"
                                  : `${formatPriceWithDecimals(projectedTotal)} due after approval`}
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
                              placeholder={booking.services?.slug === "group-walk" ? "Calm midday crew" : "Handled by back gate"}
                            />
                          </div>
                          <div>
                            <Label>Extra time (min)</Label>
                            <Input type="number" min={0} step={15} value={draft.extraTimeMinutes} onChange={(event) => patchDraft(booking, { extraTimeMinutes: Number(event.target.value) || 0 })} />
                          </div>
                        </div>

                        {service?.late_pickup_fee_cents ? (
                          <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
                            <Checkbox id={`late-pickup-${booking.id}`} checked={draft.latePickup} onCheckedChange={(checked) => patchDraft(booking, { latePickup: checked === true })} />
                            <Label htmlFor={`late-pickup-${booking.id}`} className="text-sm text-foreground">
                              Apply late pickup fee ({formatPriceWithDecimals(service.late_pickup_fee_cents)})
                            </Label>
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {booking.status !== "confirmed" && booking.status !== "awaiting_payment" && booking.status !== "pending_payment" && (
                            <Button onClick={() => approveRequest(booking)} disabled={savingBookingId === booking.id} className="font-display uppercase">
                              <Check className="h-4 w-4" />
                              {savingBookingId === booking.id ? "Saving…" : variant?.payment_mode === "free" ? "Approve & confirm" : "Approve & open payment"}
                            </Button>
                          )}
                          {booking.status !== "cancelled" && booking.status !== "completed" && (
                            <Button size="sm" variant="outline" onClick={() => declineRequest(booking)} className="border-border font-display uppercase">
                              <X className="h-4 w-4" /> Decline
                            </Button>
                          )}
                          {booking.status === "confirmed" && (
                            <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(booking.id, "completed")} className="font-display uppercase">
                              <Check className="h-4 w-4" /> Mark done
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="clients" className="mt-6 space-y-6">
            <div className="grid gap-4 xl:grid-cols-[0.92fr,1.08fr]">
              <Card className="border border-border p-5 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl uppercase text-primary">Client directory</h2>
                    <p className="text-sm text-muted-foreground">Choose a client manually, review their pets and bookings, then message one or many at once.</p>
                  </div>
                  <div className="rounded-md bg-muted px-3 py-2 text-xs font-tag text-muted-foreground">{filteredClients.length} shown</div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search by client or pet" className="pl-9" />
                  </div>

                  <div className="grid gap-2 max-h-[34rem] overflow-auto pr-1">
                    {filteredClients.map((client) => {
                      const isSelected = client.id === selectedClientId;
                      const isInGroup = selectedRecipientIds.includes(client.id);
                      const bookingsForClient = bookings.filter((booking) => booking.customer_id === client.id);
                      const petNames = [...new Set(bookingsForClient.map((booking) => booking.pets?.name).filter(Boolean))] as string[];
                      return (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setSelectedClientId(client.id);
                            setClientMessageDraft((current) => ({
                              ...current,
                              customerId: client.id,
                              bookingId: bookingsForClient[0]?.id ?? "",
                            }));
                          }}
                          className={cn(
                            "rounded-md border px-4 py-3 text-left transition-colors",
                            isSelected ? "border-primary bg-card shadow-soft" : "border-border bg-muted/40 hover:bg-card",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-display text-lg uppercase text-primary">{client.full_name}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{petNames.length > 0 ? petNames.join(" · ") : "No pets on current bookings"}</div>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Checkbox
                                checked={isInGroup}
                                onCheckedChange={(checked) => {
                                  setSelectedRecipientIds((current) =>
                                    checked === true ? [...new Set([...current, client.id])] : current.filter((id) => id !== client.id),
                                  );
                                }}
                              />
                              Group
                            </label>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-tag text-muted-foreground">
                            <span>{bookingsForClient.length} bookings</span>
                            <span>{client.sms_opt_in && client.mobile_phone ? "SMS ready" : "In-app / email"}</span>
                          </div>
                        </button>
                      );
                    })}
                    {filteredClients.length === 0 && <p className="text-sm text-muted-foreground">No matching clients yet.</p>}
                  </div>
                </div>
              </Card>

              <div className="grid gap-4">
                <Card className="border border-border p-5 shadow-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="font-display text-xl uppercase text-primary">Selected client profile</h2>
                      {selectedClientProfile ? (
                        <>
                          <p className="mt-1 text-sm text-foreground/80">{selectedClientProfile.full_name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {selectedClientProfile.sms_opt_in && selectedClientProfile.mobile_phone
                              ? `SMS enabled at ${selectedClientProfile.mobile_phone}`
                              : "No SMS opt-in on file"}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">Choose a client from the directory.</p>
                      )}
                    </div>
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                      <div className="font-tag text-muted-foreground">Group list</div>
                      <div className="mt-1 font-display text-xl text-primary">{selectedRecipientIds.length}</div>
                    </div>
                  </div>

                  {selectedClientId && (
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-md border border-border bg-muted/40 p-4">
                        <h3 className="font-display text-base uppercase text-primary">Bookings</h3>
                        <div className="mt-3 space-y-2 text-sm">
                          {selectedClientBookings.length === 0 ? (
                            <p className="text-muted-foreground">No bookings for this client yet.</p>
                          ) : (
                            selectedClientBookings.slice(0, 5).map((booking) => (
                              <div key={booking.id} className="rounded-md border border-border bg-card px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-display text-sm uppercase text-primary">{booking.service_variants?.name ?? booking.services?.name}</span>
                                  <span className={cn("px-2 py-0.5 text-[11px] font-tag", STATUS_STYLES[booking.status] ?? "bg-muted text-muted-foreground")}>
                                    {STATUS_LABELS[booking.status] ?? booking.status}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">{booking.pets?.name ?? "Pet"} · {formatBookingSchedule(booking)}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-md border border-border bg-muted/40 p-4">
                        <h3 className="font-display text-base uppercase text-primary">Recent messages</h3>
                        <div className="mt-3 space-y-2 text-sm">
                          {selectedClientMessageLog.length === 0 ? (
                            <p className="text-muted-foreground">No direct messages yet.</p>
                          ) : (
                            selectedClientMessageLog.map((message) => (
                              <div key={message.id} className="rounded-md border border-border bg-card px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-display text-sm uppercase text-primary">{message.subject}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-muted-foreground">{formatUpdateTime(message.created_at)}</span>
                                    <button type="button" onClick={() => deleteClientMessage(message)} aria-label={`Delete ${message.subject}`} className="text-muted-foreground transition-colors hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">{kindCopy[message.kind]} · email {message.send_email ? "on" : "off"} · sms {message.send_sms ? "on" : "off"}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="border border-border p-5 shadow-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="font-display text-xl uppercase text-primary">Messaging desk</h2>
                      <p className="text-sm text-muted-foreground">Send a one-to-one note or broadcast the same message to a selected group of clients.</p>
                    </div>
                    <div className="grid grid-cols-2 rounded-md border border-border bg-muted/40 p-1">
                      <button
                        type="button"
                        onClick={() => setMessageAudience("single")}
                        className={cn("rounded-md px-3 py-2 text-sm font-display uppercase", messageAudience === "single" ? "bg-card text-primary shadow-soft" : "text-muted-foreground")}
                      >
                        Single
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageAudience("group")}
                        className={cn("rounded-md px-3 py-2 text-sm font-display uppercase", messageAudience === "group" ? "bg-card text-primary shadow-soft" : "text-muted-foreground")}
                      >
                        Group
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>{messageAudience === "single" ? "Client" : "Selected group"}</Label>
                      {messageAudience === "single" ? (
                        <select
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={clientMessageDraft.customerId}
                          onChange={(event) => {
                            const nextCustomerId = event.target.value;
                            setSelectedClientId(nextCustomerId);
                            setClientMessageDraft((current) => ({
                              ...current,
                              customerId: nextCustomerId,
                              bookingId: bookings.find((booking) => booking.customer_id === nextCustomerId)?.id ?? "",
                            }));
                          }}
                        >
                          <option value="">Select client</option>
                          {clientOptions.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}
                        </select>
                      ) : (
                        <div className="mt-1 flex min-h-10 flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2">
                          {selectedRecipientIds.length === 0 ? (
                            <span className="text-sm text-muted-foreground">Choose clients from the directory.</span>
                          ) : (
                            selectedRecipientIds.map((id) => (
                              <span key={id} className="rounded-md bg-muted px-2 py-1 text-xs font-tag text-primary">
                                {profileDetails[id]?.full_name ?? "Client"}
                              </span>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Related booking</Label>
                      <select
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={clientMessageDraft.bookingId}
                        disabled={messageAudience === "group"}
                        onChange={(event) => setClientMessageDraft((current) => ({ ...current, bookingId: event.target.value }))}
                      >
                        <option value="">General account note</option>
                        {activeClientBookings.map((booking) => <option key={booking.id} value={booking.id}>{`${booking.service_variants?.name ?? booking.services?.name} · ${booking.pets?.name ?? "Pet"}`}</option>)}
                      </select>
                    </div>

                    <div>
                      <Label>Type</Label>
                      <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={clientMessageDraft.kind} onChange={(event) => setClientMessageDraft((current) => ({ ...current, kind: event.target.value as ClientMessage["kind"] }))}>
                        <option value="customer_service">Customer service</option>
                        <option value="service_update">Service update</option>
                        <option value="offer">Client offer</option>
                      </select>
                    </div>

                    <div>
                      <Label>Subject</Label>
                      <Input value={clientMessageDraft.subject} maxLength={120} onChange={(event) => setClientMessageDraft((current) => ({ ...current, subject: event.target.value }))} placeholder="Tomorrow's walk timing" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <Label>Message</Label>
                    <Textarea value={clientMessageDraft.message} maxLength={1200} onChange={(event) => setClientMessageDraft((current) => ({ ...current, message: event.target.value }))} placeholder={messageAudience === "group" ? "Shared update for all selected clients…" : "Personal note for this client…"} className="mt-1 min-h-32" />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
                    <label className="flex items-center gap-2"><Checkbox checked={clientMessageDraft.sendEmail} onCheckedChange={(checked) => setClientMessageDraft((current) => ({ ...current, sendEmail: checked === true }))} /> <Mail className="h-4 w-4 text-clay" /> Email</label>
                    <label className="flex items-center gap-2"><Checkbox checked={clientMessageDraft.sendSms} onCheckedChange={(checked) => setClientMessageDraft((current) => ({ ...current, sendSms: checked === true }))} /> <Smartphone className="h-4 w-4 text-clay" /> SMS</label>
                    <span className="text-muted-foreground">In-app delivery is always included.</span>
                  </div>

                  {messageAudience === "single" && selectedDraftClientProfile ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {selectedDraftClientProfile.full_name} {selectedDraftClientProfile.sms_opt_in && selectedDraftClientProfile.mobile_phone ? `can receive texts at ${selectedDraftClientProfile.mobile_phone}.` : "will receive texts only after adding a mobile number and opting in."}
                    </p>
                  ) : messageAudience === "group" ? (
                    <p className="mt-3 text-xs text-muted-foreground">Group messages send the same note to each selected client as a general account message.</p>
                  ) : null}

                  <Button onClick={sendClientMessage} disabled={sendingClientMessage} className="mt-4 font-display uppercase">
                    <Send className="h-4 w-4" />
                    {sendingClientMessage ? "Sending…" : messageAudience === "group" ? "Send group message" : "Send client message"}
                  </Button>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="mt-6 space-y-6">
            <div className="grid gap-4 xl:grid-cols-4">
              {serviceCoverage.map(({ service, slotCount, windowCount, upcomingCount }) => (
                <Card key={service.id} className="border border-border p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg uppercase text-primary">{service.name}</p>
                      <p className="text-xs text-muted-foreground">{WALK_SLUGS.has(service.slug) ? "Walk lane" : service.slug === "boarding" ? "Overnight lane" : "Exact-slot lane"}</p>
                    </div>
                    {service.requires_pet_approval && <ShieldCheck className="h-4 w-4 text-clay" />}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-foreground/80">
                    <div className="flex items-center justify-between"><span>Booking blocks</span><span className="font-display text-primary">{slotCount}</span></div>
                    <div className="flex items-center justify-between"><span>Walk windows</span><span className="font-display text-primary">{windowCount}</span></div>
                    <div className="flex items-center justify-between"><span>Upcoming visits</span><span className="font-display text-primary">{upcomingCount}</span></div>
                    <div className="flex items-center justify-between"><span>Min buffer</span><span className="font-display text-primary">{Math.max(service.turnaround_buffer_minutes, MIN_BUFFER_MINUTES)}m</span></div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
              <Card className="border border-border p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-accent text-accent-foreground">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl uppercase text-primary">Walk schedule builder</h2>
                    <p className="text-sm text-muted-foreground">Define dedicated solo and group walk windows with capacity limits and a 30 minute gap between windows.</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr,1fr,auto,auto,auto,auto,auto] md:items-end">
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
                  <Button onClick={addWalkWindow} className="font-display uppercase"><Plus className="h-4 w-4" /> Add</Button>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {walkServices.map((service) => {
                    const serviceWindows = walkWindows.filter((window) => window.service_id === service.id);
                    return (
                      <div key={service.id} className="rounded-md border border-border bg-muted/40 p-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-clay" />
                          <h3 className="font-display text-lg uppercase text-primary">{service.name}</h3>
                        </div>
                        {serviceWindows.length === 0 ? (
                          <p className="mt-3 text-sm text-muted-foreground">No windows yet.</p>
                        ) : (
                          <ul className="mt-3 space-y-2">
                            {serviceWindows.map((window) => (
                              <li key={window.id} className="rounded-md border border-border bg-card px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-display text-sm uppercase text-primary">{DAYS[window.weekday]} · {window.window_label}</div>
                                    <div className="text-xs text-muted-foreground">{formatMinuteTime(window.start_minute)}–{formatMinuteTime(window.end_minute)}</div>
                                  </div>
                                  <button type="button" onClick={() => removeWalkWindow(window.id)} aria-label="Remove walk window">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </button>
                                </div>
                                <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-muted px-2 py-1.5 text-sm">
                                  <span>Capacity</span>
                                  <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => updateWalkWindowCapacity(window.id, window.max_bookings - 1)}><Minus className="h-4 w-4" /></button>
                                    <span className="font-display text-base uppercase text-primary">{window.max_bookings}</span>
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

              <Card className="border border-border p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-secondary text-secondary-foreground">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl uppercase text-primary">Exact booking blocks</h2>
                    <p className="text-sm text-muted-foreground">Use the same builder for pet sitting, boarding, solo walk overflow, and any exact-time services.</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {TIME_PRESETS.map((preset) => (
                    <Button key={preset.label} type="button" variant="outline" className="border-border font-display uppercase" onClick={() => setNewAvailability((current) => ({ ...current, start: preset.start, end: preset.end }))}>
                      {preset.label}
                    </Button>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,auto,auto,auto,auto] sm:items-end">
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
                  <Button onClick={addAvailability} className="font-display uppercase"><Plus className="h-4 w-4" /> Add</Button>
                </div>

                <div className="mt-4">
                  <Label className="text-xs uppercase text-muted-foreground">Services covered by this block</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {exactSlotServices.map((service) => {
                      const checked = newServiceIds.includes(service.id);
                      return (
                        <label key={service.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors", checked ? "border-primary bg-card text-primary" : "border-border bg-muted/40 hover:bg-card")}>
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
                        <li key={slot.id} className="rounded-md border border-border bg-muted/40 px-3 py-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <span className="text-sm">
                              <span className="font-display uppercase text-primary">{DAYS[slot.weekday]}</span> · {formatMinuteTime(slot.start_minute)}–{formatMinuteTime(slot.end_minute)}
                            </span>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-sm">
                                <Clock3 className="h-4 w-4 text-muted-foreground" />
                                <span>Capacity</span>
                                <button type="button" onClick={() => updateAvailabilityCapacity(slot.id, slot.max_bookings - 1)}><Minus className="h-4 w-4" /></button>
                                <span className="font-display uppercase text-primary">{slot.max_bookings}</span>
                                <button type="button" onClick={() => updateAvailabilityCapacity(slot.id, slot.max_bookings + 1)}><Plus className="h-4 w-4" /></button>
                              </div>
                              <button onClick={() => removeAvailability(slot.id)} aria-label="Remove slot"><Trash2 className="h-4 w-4 text-destructive" /></button>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {exactSlotServices.map((service) => {
                              const enabled = tagged.has(service.id);
                              return (
                                <button key={service.id} type="button" onClick={() => toggleSlotService(slot.id, service.id, !enabled)} className={cn("rounded-md border px-2 py-1 text-xs font-display uppercase transition-colors", enabled ? "border-primary bg-card text-primary" : "border-border bg-background text-muted-foreground hover:bg-card")} aria-pressed={enabled}>
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
                  <p className="mt-4 text-sm text-muted-foreground">No booking blocks yet.</p>
                )}
              </Card>
            </div>

            <Card className="border border-border p-5 shadow-soft">
              <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
                <div>
                  <h2 className="font-display text-xl uppercase text-primary">Blocked days</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Close dates cleanly without breaking the rest of the weekly schedule.</p>
                  <div className="mt-4 rounded-md border border-border bg-card">
                    <Calendar mode="single" selected={blockDate} onSelect={setBlockDate} disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))} className={cn("p-3 pointer-events-auto")} />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <Label>Reason (optional)</Label>
                      <Input value={blockReason} maxLength={100} onChange={(event) => setBlockReason(event.target.value)} placeholder="Vacation, vet, family day…" />
                    </div>
                    <Button onClick={addBlockedDate} disabled={!blockDate} className="font-display uppercase"><CalendarOff className="h-4 w-4" /> Block date</Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-lg uppercase text-primary">Current closures</h3>
                  {blocked.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                      {blocked.map((blockedDate) => (
                        <li key={blockedDate.id} className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-3">
                          <span className="text-sm">
                            <span className="font-display uppercase text-primary">{format(new Date(`${blockedDate.blocked_date}T12:00:00`), "EEE, MMM d")}</span>
                            {blockedDate.reason && <span className="ml-2 text-muted-foreground">— {blockedDate.reason}</span>}
                          </span>
                          <button onClick={() => removeBlockedDate(blockedDate.id)} aria-label="Remove blocked date"><Trash2 className="h-4 w-4 text-destructive" /></button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">No blocked dates yet.</p>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="care" className="mt-6 space-y-6">
            <Card className="border border-border p-5 shadow-soft">
              <h2 className="font-display text-xl uppercase text-primary">Today's owner updates</h2>
              {careUpdateBookings.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No confirmed care visits need updates right now.</p>
              ) : (
                <div className="mt-4 grid gap-4">
                  {careUpdateBookings.map((booking) => {
                    const owner = profileDetails[booking.customer_id] ?? { full_name: "Customer", mobile_phone: null, sms_opt_in: false };
                    const draft = getUpdateDraft(booking.id);
                    const updates = bookingUpdates[booking.id] ?? [];
                    const smsReady = owner.sms_opt_in && Boolean(owner.mobile_phone);
                    return (
                      <div key={booking.id} className="rounded-md border border-border bg-muted/40 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display text-xl uppercase text-primary">{booking.pets?.name}</span>
                              <span className={cn("px-2 py-0.5 text-[11px] font-tag", STATUS_STYLES[booking.status] ?? "bg-muted text-muted-foreground")}>
                                {STATUS_LABELS[booking.status] ?? booking.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-foreground/80">{booking.service_variants?.name ?? booking.services?.name} · {formatBookingSchedule(booking)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">Owner: {owner.full_name}</p>
                          </div>
                          <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                            <div className="flex items-center gap-2 font-display uppercase text-primary">
                              <Smartphone className="h-4 w-4" />
                              {smsReady ? "Texts on" : "Log only"}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">{smsReady ? owner.mobile_phone : "No mobile number or text opt-in on file"}</div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-[1fr,1fr] xl:grid-cols-[1fr,1fr,1.2fr,auto] xl:items-end">
                          <Button onClick={() => sendOwnerUpdate(booking, "pickup")} disabled={sendingUpdateId === `${booking.id}-pickup`} className="h-12 font-display uppercase">
                            {sendingUpdateId === `${booking.id}-pickup` ? "Sending…" : "Picked up"}
                          </Button>
                          <Button onClick={() => sendOwnerUpdate(booking, "dropoff")} disabled={sendingUpdateId === `${booking.id}-dropoff`} variant="outline" className="h-12 border-border font-display uppercase">
                            {sendingUpdateId === `${booking.id}-dropoff` ? "Sending…" : "Dropped off"}
                          </Button>
                          <div>
                            <Label>Quick note</Label>
                            <Input value={draft.note} maxLength={240} onChange={(event) => patchUpdateDraft(booking.id, { note: event.target.value })} placeholder="Happy walk, muddy paws, calm in the car…" />
                          </div>
                          <Button onClick={() => sendOwnerUpdate(booking, "note")} disabled={sendingUpdateId === `${booking.id}-note` || draft.note.trim().length === 0} variant="secondary" className="h-12 font-display uppercase">
                            <MessageSquare className="h-4 w-4" />
                            {sendingUpdateId === `${booking.id}-note` ? "Sending…" : "Send note"}
                          </Button>
                        </div>

                        <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
                          <Checkbox id={`send-sms-${booking.id}`} checked={draft.sendSms} onCheckedChange={(checked) => patchUpdateDraft(booking.id, { sendSms: checked === true })} />
                          <Label htmlFor={`send-sms-${booking.id}`} className="text-sm text-foreground">Text the owner when possible</Label>
                        </div>

                        {updates.length > 0 && (
                          <div className="mt-4 border-t border-border pt-4">
                            <h3 className="font-display text-sm uppercase text-primary">Recent updates</h3>
                            <ul className="mt-2 space-y-2">
                              {updates.slice(0, 3).map((update) => (
                                <li key={update.id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-display text-xs uppercase text-primary">{updateKindLabel[update.kind]}</span>
                                    <span className="text-[11px] text-muted-foreground">{formatUpdateTime(update.created_at)}{update.sent_via_sms ? " · texted" : ""}</span>
                                  </div>
                                  {update.message && <p className="mt-1 text-foreground/80">{update.message}</p>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="border border-border p-5 shadow-soft">
              <h2 className="font-display text-xl uppercase text-primary">Upcoming confirmed bookings</h2>
              {upcomingExactBookings.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No upcoming exact-time bookings right now.</p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {upcomingExactBookings.map((booking) => (
                    <article key={booking.id} className="rounded-md border border-border bg-muted/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-xl uppercase text-primary">{booking.service_variants?.name ?? booking.services?.name}</span>
                            <span className={cn("px-2 py-0.5 text-[11px] font-tag", STATUS_STYLES[booking.status] ?? "bg-muted text-muted-foreground")}>
                              {STATUS_LABELS[booking.status] ?? booking.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm">{formatBookingSchedule(booking)} · {profileDetails[booking.customer_id]?.full_name ?? "Customer"} · {booking.pets?.name}</p>
                          {(booking.extra_time_fee_cents > 0 || booking.late_pickup_fee_cents > 0) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Fees: {booking.extra_time_fee_cents > 0 ? `${formatPriceWithDecimals(booking.extra_time_fee_cents)} add-on` : ""}{booking.extra_time_fee_cents > 0 && booking.late_pickup_fee_cents > 0 ? " · " : ""}{booking.late_pickup_fee_cents > 0 ? `${formatPriceWithDecimals(booking.late_pickup_fee_cents)} late pickup` : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {booking.status !== "cancelled" && booking.status !== "completed" && (
                            <Button size="sm" variant="outline" onClick={() => updateBookingStatus(booking.id, "cancelled")} className="border-border font-display uppercase"><X className="h-4 w-4" /> Cancel</Button>
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
            </Card>

            {pastBookings.length > 0 && (
              <Card className="border border-border p-5 shadow-soft">
                <h2 className="font-display text-xl uppercase text-primary">Recent bookings</h2>
                <ul className="mt-4 space-y-2">
                  {pastBookings.slice(0, 12).map((booking) => (
                    <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                      <span>{formatBookingSchedule(booking)} · {booking.service_variants?.name ?? booking.services?.name} · {booking.pets?.name}</span>
                      <span className={cn("px-2 py-0.5 text-[11px] font-tag", STATUS_STYLES[booking.status] ?? "bg-muted text-muted-foreground")}>
                        {STATUS_LABELS[booking.status] ?? booking.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="alerts" className="mt-6 space-y-6">
            <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
              <Card className="border border-border p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-highlight text-highlight-foreground">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl uppercase text-primary">Publish an alert</h2>
                    <p className="text-sm text-muted-foreground">Post client-facing service notices, closures, or promos that appear in their profile.</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Type</Label>
                    <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={alertDraft.kind} onChange={(event) => setAlertDraft((current) => ({ ...current, kind: event.target.value as ServiceAlert["kind"] }))}>
                      <option value="hours_update">Hours update</option>
                      <option value="closure">Closure</option>
                      <option value="announcement">Announcement</option>
                      <option value="promo">In-app promo</option>
                    </select>
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input value={alertDraft.title} maxLength={120} onChange={(event) => setAlertDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Holiday weekend hours" />
                  </div>
                  <div>
                    <Label>Starts</Label>
                    <Input type="datetime-local" value={alertDraft.startsAt} onChange={(event) => setAlertDraft((current) => ({ ...current, startsAt: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Ends (optional)</Label>
                    <Input type="datetime-local" value={alertDraft.endsAt} onChange={(event) => setAlertDraft((current) => ({ ...current, endsAt: event.target.value }))} />
                  </div>
                </div>

                <div className="mt-3">
                  <Label>Message</Label>
                  <Textarea value={alertDraft.message} maxLength={1000} onChange={(event) => setAlertDraft((current) => ({ ...current, message: event.target.value }))} placeholder="Share the change clearly so clients can act quickly…" className="mt-1 min-h-28" />
                </div>

                <div className="mt-3 flex flex-wrap gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <label className="flex items-center gap-2"><Checkbox checked={alertDraft.isActive} onCheckedChange={(checked) => setAlertDraft((current) => ({ ...current, isActive: checked === true }))} /> Active now</label>
                  <label className="flex items-center gap-2"><Checkbox checked={alertDraft.pinToProfile} onCheckedChange={(checked) => setAlertDraft((current) => ({ ...current, pinToProfile: checked === true }))} /> Pin to profile</label>
                </div>

                <Button onClick={saveServiceAlert} disabled={savingAlert} className="mt-4 font-display uppercase">
                  <Sparkles className="h-4 w-4" />
                  {savingAlert ? "Publishing…" : "Publish alert"}
                </Button>
              </Card>

              <Card className="border border-border p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-secondary text-secondary-foreground">
                    <BellRing className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl uppercase text-primary">Active notices</h2>
                    <p className="text-sm text-muted-foreground">Pause, review, and keep profile notices current.</p>
                  </div>
                </div>

                {serviceAlerts.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No service alerts yet.</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {serviceAlerts.map((alert) => (
                      <li key={alert.id} className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-display text-xs uppercase text-primary">{alert.kind.replace(/_/g, " ")}</span>
                          <button type="button" onClick={() => toggleServiceAlert(alert, !alert.is_active)} className="text-xs uppercase text-clay hover:underline">{alert.is_active ? "Pause" : "Reactivate"}</button>
                        </div>
                        <p className="mt-1 font-display text-base uppercase text-primary">{alert.title}</p>
                        <p className="mt-1 text-foreground/80">{alert.message}</p>
                        <div className="mt-2 text-[11px] uppercase text-muted-foreground">Starts {formatUpdateTime(alert.starts_at)}{alert.ends_at ? ` · ends ${formatUpdateTime(alert.ends_at)}` : ""}{alert.pin_to_profile ? " · pinned" : ""}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Link to="/account" className="mt-8 inline-block font-tag text-clay">← back to account</Link>
      </section>
      <SiteFooter />
    </main>
  );
};

export default SitterDashboard;
