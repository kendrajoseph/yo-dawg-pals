import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, endOfWeek, format, startOfWeek } from "date-fns";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CalendarOff,
  Cat,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  Dog,
  Filter,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { PaymentDrawer, type PaymentDrawerBooking } from "@/components/payments/PaymentDrawer";
import { derivedStatus, formatCents, statusBadgeClass, type Invoice } from "@/lib/invoices";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Pet as PetProfile } from "@/lib/petSchema";
import {
  DAYS,
  formatBookingSchedule,
  formatPriceWithDecimals,
  minutesToTime,
  STATUS_LABELS,
  STATUS_STYLES,
  timeToMinutes,
} from "@/lib/booking";
import {
  formatMinuteLabel,
  type AssistantDashboardContext,
  type AssistantExecutionResponse,
  type AssistantNotificationPreview,
  type AssistantPlanResponse,
  weekdayLabel,
} from "@/lib/scheduleAssistant";
import { cn } from "@/lib/utils";

type Availability = { id: string; weekday: number; start_minute: number; end_minute: number; max_bookings: number };
type Blocked = { id: string; blocked_date: string; reason: string | null };
type Service = {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  duration_minutes: number;
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
  bundle_position?: number | null;
  request_group_id?: string | null;
  request_group_label?: string | null;
  status: string;
  notes: string | null;
  booking_kind?: string | null;
  requested_date?: string | null;
  requested_end_date?: string | null;
  recurrence_label?: string | null;
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
  payment_status?: string | null;
  services: { name: string; slug: string; payment_mode: "full" | "deposit" | "free" } | null;
  service_variants: { name: string; duration_minutes: number; price_cents: number; payment_mode: "full" | "deposit" | "free" } | null;
  pets: { id: string; name: string; species: string | null } | null;
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

type TemperamentTag = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  visibility: "owner" | "internal";
  risk_services: string[];
  risk_message: string | null;
};

type FitAlert = {
  id: string;
  pet_id: string;
  service_id: string;
  booking_id: string | null;
  title: string;
  message: string;
  severity: "warning" | "critical";
  is_resolved: boolean;
  conflicting_tag_ids: string[];
  created_at: string;
};

type Draft = {
  date: string;
  endDate: string;
  start: string;
  end: string;
  packOutingId: string;
  groupLabel: string;
  internalNotes: string;
  approvedBasePrice: string;
  extraTimeMinutes: number;
  latePickup: boolean;
};

type ProfileDetails = {
  full_name: string;
  mobile_phone: string | null;
  sms_opt_in: boolean;
};

type ClientAdminProfile = {
  client_id: string;
  star_rating: number;
  internal_notes: string | null;
};

type BookingUpdate = {
  id: string;
  booking_id: string;
  kind: "pickup" | "dropoff" | "note" | "approval";
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

type SitterNotification = {
  id: string;
  kind: string;
  title: string;
  message: string;
  booking_id: string | null;
  read_at: string | null;
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

type SnapshotEditor =
  | {
      kind: "slot";
      id: string;
      weekday: number;
      start: string;
      end: string;
      maxBookings: number;
      serviceIds: string[];
    }
  | {
      kind: "window";
      id: string;
      serviceId: string;
      weekday: number;
      label: string;
      start: string;
      end: string;
      maxBookings: number;
    };

type TabKey = "overview" | "day" | "playbook" | "clients" | "schedule" | "care" | "payments" | "alerts";
type MessageAudience = "single" | "group";
type SnapshotRange = "day" | "week";
type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  plan?: AssistantPlanResponse | null;
  preview?: AssistantNotificationPreview[];
};

type BookingWorkflowResponse = {
  ok?: boolean;
  error?: string;
  notificationStatus?: "sent" | "skipped" | "failed";
  notificationType?: "confirmation_email" | "payment_alert";
  notificationMessage?: string;
  attemptNumber?: number;
  retryAvailable?: boolean;
};

type BookingNotificationAttempt = {
  id: string;
  booking_id: string;
  notification_type: "confirmation_email" | "payment_alert";
  trigger_source: "approval" | "retry";
  attempt_number: number;
  status: "sent" | "skipped" | "failed";
  message: string;
  error_message: string | null;
  attempted_by: string | null;
  created_at: string;
};

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

const formatCurrencyInput = (cents: number) => (cents / 100).toFixed(2);

const parseCurrencyInput = (value: string) => {
  const normalized = Number.parseFloat(value);
  if (!Number.isFinite(normalized) || normalized < 0) return null;
  return Math.round(normalized * 100);
};

const nextDateForWeekday = (fromDate: string, weekday: number) => {
  const base = new Date(`${fromDate}T12:00:00`);
  const offset = (weekday - base.getDay() + 7) % 7;
  return format(addDays(base, offset), "yyyy-MM-dd");
};

const updateKindLabel: Record<BookingUpdate["kind"], string> = {
  pickup: "Picked up",
  dropoff: "Dropped off",
  note: "Note sent",
  approval: "Approval",
};

const getApproverDisplayName = (user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
  const metadataName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  if (metadataName) return metadataName;

  const emailName = user?.email?.split("@")[0]?.replace(/[._-]+/g, " ")?.trim();
  if (emailName) {
    return emailName
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return "the sitter";
};

const buildApprovalAuditMessage = ({
  approverName,
  notificationType,
  notificationStatus,
  notificationMessage,
}: {
  approverName: string;
  notificationType?: BookingWorkflowResponse["notificationType"];
  notificationStatus?: BookingWorkflowResponse["notificationStatus"];
  notificationMessage?: string;
}) => {
  const notificationLabel = notificationType === "payment_alert" ? "Payment alert" : "Confirmation email";

  if (notificationStatus === "failed") {
    return `Approved by ${approverName}. ${notificationMessage ?? `${notificationLabel} failed to queue.`}`;
  }

  if (notificationStatus === "skipped") {
    return `Approved by ${approverName}. ${notificationMessage ?? `${notificationLabel} was not queued.`}`;
  }

  return `Approved by ${approverName}. ${notificationMessage ?? `${notificationLabel} was successfully queued for delivery.`}`;
};

const kindCopy: Record<ClientMessage["kind"], string> = {
  customer_service: "Support",
  service_update: "Update",
  offer: "Offer",
};

const tabMeta: Array<{ value: TabKey; label: string; icon: typeof LayoutDashboard }> = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "day", label: "Day view", icon: Clock3 },
  { value: "playbook", label: "Playbook", icon: Sparkles },
  { value: "clients", label: "Clients", icon: UserRound },
  { value: "schedule", label: "Schedule", icon: CalendarDays },
  { value: "care", label: "Care", icon: MessageSquare },
  { value: "payments", label: "Payments", icon: CreditCard },
  { value: "alerts", label: "Alerts", icon: Megaphone },
];

const PetNameLabel = ({
  name,
  species,
  className = "",
}: {
  name: string;
  species?: string | null;
  className?: string;
}) => (
  <span className={cn("inline-flex items-center gap-1.5", className)}>
    {species === "cat" ? <Cat className="h-4 w-4 text-primary" aria-hidden="true" /> : species === "dog" ? <Dog className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
    <span>{name}</span>
  </span>
);

const SitterDashboard = () => {
  const db = supabase as any;
  const { user, canManageDashboard } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [snapshotRange, setSnapshotRange] = useState<SnapshotRange>("day");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [messageAudience, setMessageAudience] = useState<MessageAudience>("single");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [activePetProfileId, setActivePetProfileId] = useState<string | null>(null);
  const [snapshotEditor, setSnapshotEditor] = useState<SnapshotEditor | null>(null);
  const requestCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const walkWindowEditorRef = useRef<HTMLDivElement | null>(null);

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
  const [sitterNotifications, setSitterNotifications] = useState<SitterNotification[]>([]);
  const [profileDetails, setProfileDetails] = useState<Record<string, ProfileDetails>>({});
  const [clientAdminProfiles, setClientAdminProfiles] = useState<Record<string, ClientAdminProfile>>({});
  const [bookingUpdates, setBookingUpdates] = useState<Record<string, BookingUpdate[]>>({});
  const [notificationAttempts, setNotificationAttempts] = useState<Record<string, BookingNotificationAttempt[]>>({});
  const [petProfiles, setPetProfiles] = useState<Record<string, PetProfile>>({});
  const [temperamentTags, setTemperamentTags] = useState<TemperamentTag[]>([]);
  const [petTagIdsByPet, setPetTagIdsByPet] = useState<Record<string, string[]>>({});
  const [fitAlerts, setFitAlerts] = useState<FitAlert[]>([]);
  const [savingClientProfile, setSavingClientProfile] = useState(false);
  const [chargingBookingId, setChargingBookingId] = useState<string | null>(null);
  const [paymentsFilter, setPaymentsFilter] = useState<"all" | "outstanding" | "overdue" | "paid" | "refunded">("outstanding");
  const [paymentsSearch, setPaymentsSearch] = useState("");
  const [paymentDrawerBookingId, setPaymentDrawerBookingId] = useState<string | null>(null);
  const [invoicesByBooking, setInvoicesByBooking] = useState<Record<string, Invoice>>({});
  const [blockAlertOpen, setBlockAlertOpen] = useState(false);
  const [blockAlertContext, setBlockAlertContext] = useState<{ date: string; reason: string } | null>(null);
  const [blockAlertChannels, setBlockAlertChannels] = useState({ email: true, sms: false });
  const [blockAlertMessage, setBlockAlertMessage] = useState("");
  const [sendingBlockAlert, setSendingBlockAlert] = useState(false);

  const [newAvailability, setNewAvailability] = useState({ weekday: 1, start: "09:00", end: "12:00", maxBookings: 1 });
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);
  const [blockDate, setBlockDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");
  const [newWindow, setNewWindow] = useState({ serviceId: "", weekday: 1, label: "Morning", start: "09:00", end: "11:00", maxBookings: 4 });
  const [editingWalkWindowId, setEditingWalkWindowId] = useState<string | null>(null);
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
  const [retryingNotificationKey, setRetryingNotificationKey] = useState<string | null>(null);
  const [sendingUpdateId, setSendingUpdateId] = useState<string | null>(null);
  const [sendingClientMessage, setSendingClientMessage] = useState(false);
  const [savingAlert, setSavingAlert] = useState(false);
  const [assistantCommand, setAssistantCommand] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantPlan, setAssistantPlan] = useState<AssistantPlanResponse | null>(null);
  const [assistantPreview, setAssistantPreview] = useState<AssistantNotificationPreview[]>([]);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantApplying, setAssistantApplying] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);

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
      { data: notificationRows },
      { data: notificationAttemptRows },
      { data: tagRows },
      { data: fitAlertRows },
    ] = await Promise.all([
      db.from("availability").select("*").eq("sitter_id", user.id).order("weekday").order("start_minute"),
      db.from("blocked_dates").select("*").eq("sitter_id", user.id).order("blocked_date"),
      db
        .from("bookings")
        .select("id, customer_id, pet_id, service_id, service_variant_id, request_group_id, request_group_label, start_at, end_at, total_cents, payment_amount_cents, base_price_cents, extra_time_minutes, extra_time_fee_cents, late_pickup_fee_cents, payment_status, status, notes, booking_kind, requested_date, requested_end_date, recurrence_label, requested_window_label, requested_window_start_minute, requested_window_end_minute, scheduled_start_at, scheduled_end_at, paid_at, group_assignment_label, internal_notes, services(name, slug, payment_mode), service_variants(name, duration_minutes, price_cents, payment_mode), pets(id, name, species)")
        .eq("sitter_id", user.id)
        .order("created_at", { ascending: false }),
      db
        .from("services")
        .select("id, name, slug, price_cents, duration_minutes, payment_mode, scheduling_mode, approval_required, requires_pet_approval, turnaround_buffer_minutes, extra_time_fee_cents, extra_time_increment_minutes, late_pickup_fee_cents, boarding_checkin_minute, boarding_checkout_minute, max_capacity")
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
      db.from("sitter_notifications").select("id, kind, title, message, booking_id, read_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
      db.from("booking_notification_attempts").select("id, booking_id, notification_type, trigger_source, attempt_number, status, message, error_message, attempted_by, created_at").order("created_at", { ascending: false }).limit(200),
      db.from("pet_temperament_tags").select("id, slug, label, description, visibility, risk_services, risk_message").eq("is_active", true).order("sort_order"),
      db.from("pet_fit_alerts").select("id, pet_id, service_id, booking_id, title, message, severity, is_resolved, conflicting_tag_ids, created_at").eq("is_resolved", false).order("created_at", { ascending: false }).limit(20),
    ]);

    const nextAvailability = (avail ?? []) as Availability[];
    const nextBookings = (bookingRows ?? []) as Booking[];
    const nextServices = (serviceRows ?? []) as Service[];

    setAvailability(nextAvailability);
    setBlocked((blockedDates ?? []) as Blocked[]);
    setBookings(nextBookings);

    // Load invoices for these bookings (latest per booking)
    if (nextBookings.length > 0) {
      const { data: invoiceRows } = await db
        .from("invoices")
        .select("*")
        .in("booking_id", nextBookings.map((b) => b.id))
        .order("created_at", { ascending: false });
      const map: Record<string, Invoice> = {};
      for (const inv of (invoiceRows ?? []) as Invoice[]) {
        if (!map[inv.booking_id]) map[inv.booking_id] = inv;
      }
      setInvoicesByBooking(map);
    } else {
      setInvoicesByBooking({});
    }
    setServices(nextServices);
    setServiceVariants((variantRows ?? []) as ServiceVariant[]);
    setWalkWindows((walkWindowRows ?? []) as WalkWindow[]);
    setPetApprovals((approvalRows ?? []) as PetApproval[]);
    setClientMessages((messageRows ?? []) as ClientMessage[]);
    setServiceAlerts((alertRows ?? []) as ServiceAlert[]);
    setSitterNotifications((notificationRows ?? []) as SitterNotification[]);
    setNotificationAttempts(((notificationAttemptRows ?? []) as BookingNotificationAttempt[]).reduce<Record<string, BookingNotificationAttempt[]>>((acc, row) => {
      acc[row.booking_id] = [...(acc[row.booking_id] ?? []), row];
      return acc;
    }, {}));
    setTemperamentTags((tagRows ?? []) as TemperamentTag[]);
    setFitAlerts((fitAlertRows ?? []) as FitAlert[]);

    const customerIds = [...new Set(nextBookings.map((row) => row.customer_id))];
    const petIds = [...new Set(nextBookings.map((row) => row.pet_id))];

    if (petIds.length > 0) {
      const [{ data: petRows }, { data: petTagRows }] = await Promise.all([
        db.from("pets").select("*").in("id", petIds),
        db.from("pet_tag_assignments").select("pet_id, tag_id").in("pet_id", petIds),
      ]);
      setPetProfiles(
        Object.fromEntries(((petRows ?? []) as PetProfile[]).map((pet) => [pet.id, pet])),
      );
      setPetTagIdsByPet(
        ((petTagRows ?? []) as Array<{ pet_id: string; tag_id: string }>).reduce<Record<string, string[]>>((acc, row) => {
          acc[row.pet_id] = [...(acc[row.pet_id] ?? []), row.tag_id];
          return acc;
        }, {}),
      );
    } else {
      setPetProfiles({});
      setPetTagIdsByPet({});
    }

    if (customerIds.length > 0) {
      const profileQuery = db.from("profiles").select("id, full_name, mobile_phone, sms_opt_in").in("id", customerIds);
      const adminProfileQuery = db.from("client_admin_profiles").select("client_id, star_rating, internal_notes").in("client_id", customerIds);
      const [{ data: profileRows }, { data: adminProfileRows }] = await Promise.all([profileQuery, adminProfileQuery]);
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
      setClientAdminProfiles(
        Object.fromEntries(
          ((adminProfileRows ?? []) as ClientAdminProfile[]).map((row) => [row.client_id, row]),
        ),
      );
    } else {
      setProfileDetails({});
      setClientAdminProfiles({});
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

  const saveClientAdminProfile = async (clientId: string, values: { star_rating: number; internal_notes: string }) => {
    if (!user) return;

    setSavingClientProfile(true);
    const payload = {
      client_id: clientId,
      star_rating: Math.min(5, Math.max(1, values.star_rating)),
      internal_notes: values.internal_notes.trim() || null,
      last_updated_by: user.id,
    };

    const { error } = await db.from("client_admin_profiles").upsert(payload, { onConflict: "client_id" });
    setSavingClientProfile(false);

    if (error) {
      toast({ title: "Couldn't save client notes", description: error.message, variant: "destructive" });
      return;
    }

    setClientAdminProfiles((current) => ({
      ...current,
      [clientId]: payload,
    }));
    toast({ title: "Client profile updated" });
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
  const groupedRequestBookings = useMemo(() => {
    const groups = new Map<string, { id: string; label: string; bookings: Booking[] }>();

    requestBookings.forEach((booking) => {
      const owner = profileDetails[booking.customer_id];
      const fallbackLabel = booking.request_group_label ?? owner?.full_name ?? "Request bundle";
      const key = booking.request_group_id ?? `single-${booking.id}`;

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          label: fallbackLabel,
          bookings: [],
        });
      }

      groups.get(key)?.bookings.push(booking);
    });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      bookings: group.bookings.sort((a, b) => {
        const aDate = a.requested_date ?? format(new Date(a.start_at), "yyyy-MM-dd");
        const bDate = b.requested_date ?? format(new Date(b.start_at), "yyyy-MM-dd");
        return `${aDate}-${a.bundle_position ?? 0}`.localeCompare(`${bDate}-${b.bundle_position ?? 0}`);
      }),
    }));
  }, [profileDetails, requestBookings]);
  const latestNotificationAttemptByBooking = useMemo(
    () => Object.fromEntries(
      Object.entries(notificationAttempts).map(([bookingId, attempts]) => [
        bookingId,
        [...attempts].sort((a, b) => b.attempt_number - a.attempt_number || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0],
      ]),
    ) as Record<string, BookingNotificationAttempt | undefined>,
    [notificationAttempts],
  );
  const assistantContext = useMemo<AssistantDashboardContext>(
    () => ({
      today: format(new Date(), "yyyy-MM-dd"),
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        slug: service.slug,
        duration_minutes: service.duration_minutes,
        payment_mode: service.payment_mode,
        scheduling_mode: service.scheduling_mode,
        requires_pet_approval: service.requires_pet_approval,
        approval_required: service.approval_required,
      })),
      availability: availability.map((slot) => ({
        id: slot.id,
        weekday: slot.weekday,
        start_minute: slot.start_minute,
        end_minute: slot.end_minute,
        max_bookings: slot.max_bookings,
        service_slugs: Array.from(tagsBySlot.get(slot.id) ?? []).map((serviceId) => serviceMap.get(serviceId)?.slug).filter(Boolean) as string[],
      })),
      walkWindows: walkWindows.map((window) => ({
        id: window.id,
        service_slug: serviceMap.get(window.service_id)?.slug ?? "",
        weekday: window.weekday,
        start_minute: window.start_minute,
        end_minute: window.end_minute,
        window_label: window.window_label,
        max_bookings: window.max_bookings,
      })),
      blockedDates: blocked.map((entry) => ({ id: entry.id, blocked_date: entry.blocked_date, reason: entry.reason })),
      requestGroups: groupedRequestBookings.map((group) => ({
        id: group.id,
        label: group.label,
        bookings: group.bookings.map((booking) => ({
          id: booking.id,
          status: booking.status,
          service_slug: booking.services?.slug ?? null,
          service_name: booking.services?.name ?? booking.service_variants?.name ?? null,
          pet_name: booking.pets?.name ?? null,
          customer_name: profileDetails[booking.customer_id]?.full_name ?? "Client",
          booking_kind: booking.booking_kind ?? null,
          requested_date: booking.requested_date ?? null,
          requested_end_date: booking.requested_end_date ?? null,
          requested_window_label: booking.requested_window_label ?? null,
          requested_window_start_minute: booking.requested_window_start_minute ?? null,
          requested_window_end_minute: booking.requested_window_end_minute ?? null,
          recurrence_label: booking.recurrence_label ?? null,
          request_group_id: booking.request_group_id ?? null,
          request_group_label: booking.request_group_label ?? null,
        })),
      })),
    }),
    [availability, blocked, groupedRequestBookings, profileDetails, serviceMap, services, tagsBySlot, walkWindows],
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
  const selectedClientAdminProfile = selectedClientId ? clientAdminProfiles[selectedClientId] : null;
  const selectedClientBookings = useMemo(
    () => bookings.filter((booking) => booking.customer_id === selectedClientId),
    [bookings, selectedClientId],
  );
  const selectedClientServiceHistory = useMemo(() => {
    const counts = selectedClientBookings.reduce<Record<string, { label: string; count: number }>>((acc, booking) => {
      const key = booking.service_variant_id ?? booking.service_id;
      const label = booking.service_variants?.name ?? booking.services?.name ?? "Service";
      acc[key] = {
        label,
        count: (acc[key]?.count ?? 0) + 1,
      };
      return acc;
    }, {});

    return Object.values(counts).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [selectedClientBookings]);
  const selectedClientMessageLog = useMemo(
    () => clientMessages.filter((message) => message.customer_id === selectedClientId).slice(0, 8),
    [clientMessages, selectedClientId],
  );
  const dailySnapshotBookings = useMemo(() => {
    const targetDate = selectedDay;
    const rangeStart = format(startOfWeek(new Date(`${selectedDay}T12:00:00`), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const rangeEnd = format(endOfWeek(new Date(`${selectedDay}T12:00:00`), { weekStartsOn: 1 }), "yyyy-MM-dd");

    return bookings
      .filter((booking) => !["cancelled", "refunded"].includes(booking.status))
      .filter((booking) => {
        const bookingDate = booking.booking_kind === "requested" && !booking.scheduled_start_at && booking.requested_date
          ? booking.requested_date
          : format(new Date(booking.scheduled_start_at ?? booking.start_at), "yyyy-MM-dd");

        return snapshotRange === "week"
          ? bookingDate >= rangeStart && bookingDate <= rangeEnd
          : bookingDate === targetDate;
      })
      .sort((a, b) => {
        const aTime = a.booking_kind === "requested" && !a.scheduled_start_at && a.requested_date
          ? new Date(`${a.requested_date}T${formatMinuteTime(a.requested_window_start_minute ?? 9 * 60)}:00`).getTime()
          : new Date(a.scheduled_start_at ?? a.start_at).getTime();
        const bTime = b.booking_kind === "requested" && !b.scheduled_start_at && b.requested_date
          ? new Date(`${b.requested_date}T${formatMinuteTime(b.requested_window_start_minute ?? 9 * 60)}:00`).getTime()
          : new Date(b.scheduled_start_at ?? b.start_at).getTime();
        return aTime - bTime;
      });
  }, [bookings, selectedDay, snapshotRange]);
  const dailySnapshotSummary = useMemo(() => {
    const confirmed = dailySnapshotBookings.filter((booking) => booking.status === "confirmed").length;
    const pending = dailySnapshotBookings.filter((booking) => ["requested", "awaiting_payment", "pending_payment"].includes(booking.status)).length;
    const walks = dailySnapshotBookings.filter((booking) => WALK_SLUGS.has(booking.services?.slug ?? "")).length;
    return { total: dailySnapshotBookings.length, confirmed, pending, walks };
  }, [dailySnapshotBookings]);
  const weeklySnapshotGroups = useMemo(() => {
    return dailySnapshotBookings.reduce<Array<{ date: string; label: string; bookings: Booking[] }>>((groups, booking) => {
      const bookingDate = booking.booking_kind === "requested" && !booking.scheduled_start_at && booking.requested_date
        ? booking.requested_date
        : format(new Date(booking.scheduled_start_at ?? booking.start_at), "yyyy-MM-dd");
      const existing = groups.find((group) => group.date === bookingDate);

      if (existing) {
        existing.bookings.push(booking);
      } else {
        groups.push({
          date: bookingDate,
          label: format(new Date(`${bookingDate}T12:00:00`), "EEEE, MMM d"),
          bookings: [booking],
        });
      }

      return groups;
    }, []);
  }, [dailySnapshotBookings]);
  const activeClientBookings = useMemo(
    () => bookings.filter((booking) => booking.customer_id === clientMessageDraft.customerId),
    [bookings, clientMessageDraft.customerId],
  );
  const selectedDraftClientProfile = clientMessageDraft.customerId ? profileDetails[clientMessageDraft.customerId] : null;
  const activePetProfile = activePetProfileId ? petProfiles[activePetProfileId] ?? null : null;
  const activePetTags = useMemo(
    () => (activePetProfileId ? (petTagIdsByPet[activePetProfileId] ?? []).map((tagId) => temperamentTags.find((tag) => tag.id === tagId)).filter(Boolean) as TemperamentTag[] : []),
    [activePetProfileId, petTagIdsByPet, temperamentTags],
  );
  const ownerVisibleTags = useMemo(() => temperamentTags.filter((tag) => tag.visibility === "owner"), [temperamentTags]);
  const internalOnlyTags = useMemo(() => temperamentTags.filter((tag) => tag.visibility === "internal"), [temperamentTags]);
  const clientAdminDraft = useMemo(
    () => ({
      star_rating: selectedClientAdminProfile?.star_rating ?? 3,
      internal_notes: selectedClientAdminProfile?.internal_notes ?? "",
    }),
    [selectedClientAdminProfile],
  );

  const pendingPetApprovals = useMemo(() => {
    const seen = new Set<string>();
    return requestBookings.flatMap((booking) => {
      const approval = petApprovals.find((item) => item.pet_id === booking.pet_id && item.service_id === booking.service_id);
      const service = serviceMap.get(booking.service_id);
      if (!service?.requires_pet_approval) return [];
      const key = `${booking.pet_id}-${booking.service_id}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const selectedTags = (petTagIdsByPet[booking.pet_id] ?? [])
        .map((tagId) => temperamentTags.find((tag) => tag.id === tagId))
        .filter(Boolean) as TemperamentTag[];
      const riskyTags = selectedTags.filter((tag) => tag.risk_services.includes(service.slug));
      const openAlert = fitAlerts.find((alert) => alert.pet_id === booking.pet_id && alert.service_id === booking.service_id && !alert.is_resolved);
      return [{
        key,
        petId: booking.pet_id,
        petName: booking.pets?.name ?? "Pet",
        serviceId: booking.service_id,
        serviceName: booking.services?.name ?? "Service",
        status: approval?.status ?? "pending",
        notes: approval?.notes ?? null,
        riskyTags,
        openAlert,
      }];
    });
  }, [fitAlerts, petApprovals, petTagIdsByPet, requestBookings, serviceMap, temperamentTags]);

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

  const unreadRequestNotifications = useMemo(
    () => sitterNotifications.filter((notification) => notification.kind === "booking_request" && !notification.read_at),
    [sitterNotifications],
  );

  const markNotificationRead = async (notificationId: string) => {
    const { error } = await db.from("sitter_notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).is("read_at", null);
    if (error) {
      toast({ title: "Couldn't clear alert", description: error.message, variant: "destructive" });
      return;
    }

    setSitterNotifications((current) => current.map((notification) => notification.id === notificationId ? { ...notification, read_at: new Date().toISOString() } : notification));
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
    const dateStr = format(blockDate, "yyyy-MM-dd");
    const { error } = await db.from("blocked_dates").insert({
      sitter_id: user.id,
      blocked_date: dateStr,
      reason: blockReason || null,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    const reasonSnapshot = blockReason;
    setBlockDate(undefined);
    setBlockReason("");
    load();
    // Prompt Anneke to notify clients about the closure.
    setBlockAlertContext({ date: dateStr, reason: reasonSnapshot });
    setBlockAlertChannels({ email: true, sms: false });
    setBlockAlertMessage(
      `Heads up — Yo Dawg is closed on ${format(new Date(`${dateStr}T12:00:00`), "EEEE, MMMM d")}${reasonSnapshot ? ` (${reasonSnapshot})` : ""}. Reach out if you'd like help rescheduling.`,
    );
    setBlockAlertOpen(true);
  };

  const removeBlockedDate = async (id: string) => {
    await db.from("blocked_dates").delete().eq("id", id);
    load();
  };

  const sendBlockedDayAlert = async () => {
    if (!user || !blockAlertContext) return;
    if (!blockAlertChannels.email && !blockAlertChannels.sms) {
      toast({ title: "Pick a channel", description: "Choose email, text, or both before sending.", variant: "destructive" });
      return;
    }
    setSendingBlockAlert(true);

    // Recipients = every client with at least one booking on Anneke's schedule.
    const recipientIds = Array.from(
      new Set(bookings.map((b) => b.customer_id).filter(Boolean) as string[]),
    );
    if (recipientIds.length === 0) {
      toast({ title: "No clients to notify", description: "You don't have any clients on file yet." });
      setSendingBlockAlert(false);
      setBlockAlertOpen(false);
      return;
    }

    const subject = `Closure: ${format(new Date(`${blockAlertContext.date}T12:00:00`), "EEE, MMM d")}`;
    let okCount = 0;
    let failCount = 0;
    for (const customerId of recipientIds) {
      try {
        const { error } = await supabase.functions.invoke("send-client-message", {
          body: {
            customerId,
            kind: "service_update",
            subject,
            message: blockAlertMessage,
            sendEmail: blockAlertChannels.email,
            sendSms: blockAlertChannels.sms,
          },
        });
        if (error) failCount += 1;
        else okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setSendingBlockAlert(false);
    setBlockAlertOpen(false);
    setBlockAlertContext(null);
    toast({
      title: failCount === 0 ? "Closure alert sent" : "Closure alert sent with errors",
      description: `${okCount} delivered${failCount ? ` · ${failCount} failed` : ""}`,
      variant: failCount === 0 ? undefined : "destructive",
    });
  };

  const chargeSavedCard = async (bookingId: string) => {
    setChargingBookingId(bookingId);
    try {
      const { data, error } = await supabase.functions.invoke("charge-saved-card", {
        body: { bookingId, environment: "sandbox" },
      });
      if (error) throw new Error(error.message || "Charge failed");
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Card charged", description: "Saved card was charged successfully." });
      load();
    } catch (e: any) {
      toast({ title: "Charge failed", description: e.message ?? "Unable to recharge.", variant: "destructive" });
    } finally {
      setChargingBookingId(null);
    }
  };

  const resetWalkWindowForm = () => {
    setEditingWalkWindowId(null);
    setNewWindow((current) => ({
      ...current,
      label: "Morning",
      weekday: 1,
      start: "09:00",
      end: "11:00",
      maxBookings: 4,
    }));
  };

  const beginWalkWindowEdit = (walkWindow: WalkWindow) => {
    setEditingWalkWindowId(walkWindow.id);
    setNewWindow({
      serviceId: walkWindow.service_id,
      weekday: walkWindow.weekday,
      label: walkWindow.window_label,
      start: formatMinuteTime(walkWindow.start_minute),
      end: formatMinuteTime(walkWindow.end_minute),
      maxBookings: walkWindow.max_bookings,
    });
    window.requestAnimationFrame(() => {
      walkWindowEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const addWalkWindow = async () => {
    if (!user || !newWindow.serviceId) return;
    const start = timeToMinutes(newWindow.start);
    const end = timeToMinutes(newWindow.end);
    if (end <= start) return toast({ title: "End must be after start", variant: "destructive" });

    const sameDayWindows = walkWindows
      .filter((window) => window.weekday === newWindow.weekday && window.id !== editingWalkWindowId)
      .map((window) => ({ start: window.start_minute, end: window.end_minute }));
    if (hasBufferedMinuteConflict(sameDayWindows, start, end)) {
      return toast({ title: "Walk windows need a 30 minute gap", variant: "destructive" });
    }

    const payload = {
      service_id: newWindow.serviceId,
      weekday: newWindow.weekday,
      start_minute: start,
      end_minute: end,
      window_label: newWindow.label,
      max_bookings: newWindow.maxBookings,
    };

    const nextSortOrder = walkWindows.filter((window) => window.service_id === newWindow.serviceId && window.weekday === newWindow.weekday && window.id !== editingWalkWindowId).length;
    const { error } = editingWalkWindowId
      ? await db.from("walk_windows").update(payload).eq("id", editingWalkWindowId)
      : await db.from("walk_windows").insert({
          sitter_id: user.id,
          ...payload,
          sort_order: nextSortOrder,
        });

    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: editingWalkWindowId ? "Walk window updated" : "Walk window added" });
      resetWalkWindowForm();
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

  const openSlotEditor = (slot: Availability) => {
    setSnapshotEditor({
      kind: "slot",
      id: slot.id,
      weekday: slot.weekday,
      start: formatMinuteTime(slot.start_minute),
      end: formatMinuteTime(slot.end_minute),
      maxBookings: slot.max_bookings,
      serviceIds: Array.from(tagsBySlot.get(slot.id) ?? []),
    });
  };

  const openWindowEditor = (window: WalkWindow) => {
    setSnapshotEditor({
      kind: "window",
      id: window.id,
      serviceId: window.service_id,
      weekday: window.weekday,
      label: window.window_label,
      start: formatMinuteTime(window.start_minute),
      end: formatMinuteTime(window.end_minute),
      maxBookings: window.max_bookings,
    });
  };

  const saveSnapshotEditor = async () => {
    if (!snapshotEditor) return;

    const start = timeToMinutes(snapshotEditor.start);
    const end = timeToMinutes(snapshotEditor.end);
    if (end <= start) {
      toast({ title: "End must be after start", variant: "destructive" });
      return;
    }

    if (snapshotEditor.kind === "slot") {
      if (snapshotEditor.serviceIds.length === 0) {
        toast({ title: "Pick at least one service", variant: "destructive" });
        return;
      }

      const sameDayRanges = availability
        .filter((slot) => slot.weekday === snapshotEditor.weekday && slot.id !== snapshotEditor.id)
        .map((slot) => ({ start: slot.start_minute, end: slot.end_minute }));

      if (hasBufferedMinuteConflict(sameDayRanges, start, end)) {
        toast({ title: "Leave a 30 minute gap between booking blocks", variant: "destructive" });
        return;
      }

      const { error } = await db
        .from("availability")
        .update({
          weekday: snapshotEditor.weekday,
          start_minute: start,
          end_minute: end,
          max_bookings: Math.max(1, snapshotEditor.maxBookings),
        })
        .eq("id", snapshotEditor.id);

      if (error) {
        toast({ title: "Couldn't update block", description: error.message, variant: "destructive" });
        return;
      }

      await db.from("availability_services").delete().eq("availability_id", snapshotEditor.id);
      const { error: linkError } = await db
        .from("availability_services")
        .insert(snapshotEditor.serviceIds.map((serviceId) => ({ availability_id: snapshotEditor.id, service_id: serviceId })));

      if (linkError) {
        toast({ title: "Block updated, but service tags failed", description: linkError.message, variant: "destructive" });
        return;
      }
    } else {
      const sameDayRanges = walkWindows
        .filter((window) => window.weekday === snapshotEditor.weekday && window.id !== snapshotEditor.id)
        .map((window) => ({ start: window.start_minute, end: window.end_minute }));

      if (hasBufferedMinuteConflict(sameDayRanges, start, end)) {
        toast({ title: "Walk windows need a 30 minute gap", variant: "destructive" });
        return;
      }

      const { error } = await db
        .from("walk_windows")
        .update({
          service_id: snapshotEditor.serviceId,
          weekday: snapshotEditor.weekday,
          window_label: snapshotEditor.label,
          start_minute: start,
          end_minute: end,
          max_bookings: Math.max(1, snapshotEditor.maxBookings),
        })
        .eq("id", snapshotEditor.id);

      if (error) {
        toast({ title: "Couldn't update walk window", description: error.message, variant: "destructive" });
        return;
      }
    }

    toast({ title: "Schedule updated" });
    setSnapshotEditor(null);
    load();
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
    const basePriceCents = variant?.price_cents ?? service?.price_cents ?? booking.base_price_cents ?? booking.total_cents;
    const requestedPackLabel = booking.group_assignment_label ?? booking.requested_window_label ?? "";
    const matchingPackOuting = walkWindows.find(
      (window) =>
        window.service_id === booking.service_id &&
        window.window_label === requestedPackLabel &&
        booking.requested_window_start_minute === window.start_minute &&
        booking.requested_window_end_minute === window.end_minute,
    );

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
          : formatMinuteTime(service?.slug === "boarding" ? boardingEnd : (variant?.duration_minutes ?? service?.duration_minutes ?? 60) + timeToMinutes("09:00")),
      packOutingId: matchingPackOuting?.id ?? "",
      groupLabel: requestedPackLabel,
      internalNotes: booking.internal_notes ?? "",
      approvedBasePrice: formatCurrencyInput(basePriceCents),
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

  const applyPackOutingToDraft = (booking: Booking, outingId: string) => {
    const outing = walkWindows.find((window) => window.id === outingId);
    if (!outing) {
      patchDraft(booking, { packOutingId: "" });
      return;
    }

    const nextDate = nextDateForWeekday(getDraft(booking).date, outing.weekday);
    patchDraft(booking, {
      packOutingId: outing.id,
      date: nextDate,
      start: formatMinuteTime(outing.start_minute),
      end: formatMinuteTime(outing.end_minute),
      groupLabel: outing.window_label,
    });
  };

  const getUpdateDraft = (bookingId: string): UpdateDraft => updateDrafts[bookingId] ?? { note: "", sendSms: true };
  const patchUpdateDraft = (bookingId: string, patch: Partial<UpdateDraft>) => {
    setUpdateDrafts((current) => ({
      ...current,
      [bookingId]: { ...getUpdateDraft(bookingId), ...patch },
    }));
  };

  const savePetTags = async (petId: string, nextTagIds: string[]) => {
    if (!user) return;

    const { error: deleteError } = await db.from("pet_tag_assignments").delete().eq("pet_id", petId);
    if (deleteError) {
      toast({ title: "Couldn't update tags", description: deleteError.message, variant: "destructive" });
      return;
    }

    if (nextTagIds.length > 0) {
      const { error: insertError } = await db.from("pet_tag_assignments").insert(
        nextTagIds.map((tagId) => ({ pet_id: petId, tag_id: tagId, created_by: user.id })),
      );
      if (insertError) {
        toast({ title: "Couldn't update tags", description: insertError.message, variant: "destructive" });
        return;
      }
    }

    toast({ title: "Pet tags updated" });
    load();
  };

  const createFitAlert = async (booking: Booking, riskyTags: TemperamentTag[]) => {
    if (!user || riskyTags.length === 0) return;
    const service = serviceMap.get(booking.service_id);
    if (!service) return;

    const title = `${booking.pets?.name ?? "Pet"} flagged for ${service.name}`;
    const message = riskyTags.map((tag) => tag.risk_message || `${tag.label} requires extra review for ${service.name}.`).join(" ");

    const existingAlert = fitAlerts.find((alert) => alert.pet_id === booking.pet_id && alert.service_id === booking.service_id && alert.booking_id === booking.id && !alert.is_resolved);
    if (existingAlert) return;

    const { error } = await db.from("pet_fit_alerts").insert({
      pet_id: booking.pet_id,
      service_id: booking.service_id,
      booking_id: booking.id,
      triggered_by: user.id,
      severity: riskyTags.some((tag) => tag.slug === "aggression-history" || tag.slug === "bite-incident") ? "critical" : "warning",
      title,
      message,
      conflicting_tag_ids: riskyTags.map((tag) => tag.id),
    });

    if (error) {
      toast({ title: "Alert could not be saved", description: error.message, variant: "destructive" });
    }
  };

  const runNotificationRetry = async (booking: Booking) => {
    const latestAttempt = latestNotificationAttemptByBooking[booking.id];
    const retryAction = booking.status === "confirmed"
      ? "retry_confirmation_email"
      : booking.status === "awaiting_payment"
        ? "retry_payment_alert"
        : null;

    if (!retryAction || !latestAttempt) {
      toast({ title: "Retry unavailable", description: "This booking is not in a retryable notification state.", variant: "destructive" });
      return;
    }

    setRetryingNotificationKey(booking.id);
    const { error: workflowError, data: workflowData } = await supabase.functions.invoke<BookingWorkflowResponse>("booking-workflow", {
      body: {
        action: retryAction,
        bookingId: booking.id,
        appUrl: window.location.origin,
      },
    });
    setRetryingNotificationKey(null);

    if (workflowError || workflowData?.error) {
      toast({
        title: "Retry failed",
        description: workflowError?.message ?? workflowData?.error ?? "The client notification could not be retried.",
        variant: "destructive",
      });
      await load();
      return;
    }

    toast({
      title: workflowData?.notificationStatus === "failed" ? "Retry failed" : workflowData?.notificationType === "confirmation_email" ? "Confirmation email updated" : "Payment alert updated",
      description: workflowData?.notificationMessage ?? "Client notification updated.",
      variant: workflowData?.notificationStatus === "failed" ? "destructive" : "default",
    });
    await load();
  };

  const buildRetryToastAction = (booking: Booking) => (
    <ToastAction altText={booking.status === "confirmed" ? "Retry confirmation email" : "Retry payment alert"} onClick={() => runNotificationRetry(booking)}>
      Retry
    </ToastAction>
  );

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
    else {
      const service = serviceMap.get(serviceId);
      const riskyTags = service
        ? ((petTagIdsByPet[petId] ?? []).map((tagId) => temperamentTags.find((tag) => tag.id === tagId)).filter(Boolean) as TemperamentTag[])
            .filter((tag) => tag.risk_services.includes(service.slug))
        : [];
      if (status === "approved" && riskyTags.length > 0) {
        await createFitAlert(
          requestBookings.find((booking) => booking.pet_id === petId && booking.service_id === serviceId) ?? {
            id: null,
            pet_id: petId,
            service_id: serviceId,
            pets: { name: activePetProfile?.name ?? "Pet" },
          } as Booking,
          riskyTags,
        );
        toast({ title: "Approved with risk alert", description: "This fit was approved, but it has been flagged for follow-up." });
      }
      load();
    }
  };

  const approveRequest = async (booking: Booking) => {
    if (!user) return;
    const draft = getDraft(booking);
    const service = serviceMap.get(booking.service_id);
    const variant = booking.service_variant_id ? variantMap.get(booking.service_variant_id) : null;
    const approverName = getApproverDisplayName(user);
    if (!service) return toast({ title: "Missing service details", variant: "destructive" });

    const petApproval = petApprovals.find((item) => item.pet_id === booking.pet_id && item.service_id === booking.service_id);
    if (service.requires_pet_approval && petApproval?.status !== "approved") {
      return toast({ title: "Approve the pet first", description: "This service needs a fit decision before it can be approved.", variant: "destructive" });
    }

    const approvedBasePrice = parseCurrencyInput(draft.approvedBasePrice);
    if (approvedBasePrice == null) {
      return toast({ title: "Enter a valid approved price", description: "Use a dollar amount like 32 or 32.50.", variant: "destructive" });
    }

    if (service.slug === "group-walk" && !draft.packOutingId) {
      return toast({ title: "Choose a pack outing", description: "Pick one of the backend outing blocks for this approval.", variant: "destructive" });
    }

    const minimumDuration = variant?.duration_minutes ?? service.duration_minutes ?? 0;
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
    const totalCents = approvedBasePrice + extraTimeFeeCents + latePickupFeeCents;
    const paymentMode = variant?.payment_mode ?? service.payment_mode;
    const paymentAmount = paymentMode === "free" ? 0 : paymentMode === "deposit" ? Math.round(totalCents * 0.25) : totalCents;
    const nextStatus = paymentMode === "free" ? "confirmed" : "awaiting_payment";

    const { error } = await db.from("bookings").update({
      scheduled_start_at: startAt.toISOString(),
      scheduled_end_at: endAt.toISOString(),
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      group_assignment_label: draft.groupLabel || null,
      internal_notes: draft.internalNotes || null,
      base_price_cents: approvedBasePrice,
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

    const workflowAction = nextStatus === "confirmed" ? "schedule_solo_walk" : "approve_group_walk";
    const { error: workflowError, data: workflowData } = await supabase.functions.invoke<BookingWorkflowResponse>("booking-workflow", {
      body: {
        action: workflowAction,
        bookingId: booking.id,
        scheduledStartAt: startAt.toISOString(),
        scheduledEndAt: endAt.toISOString(),
        groupLabel: draft.groupLabel || null,
        internalNotes: draft.internalNotes || null,
        appUrl: window.location.origin,
      },
    });

    if (workflowError || workflowData?.error) {
      toast({
        title: nextStatus === "confirmed" ? "Request confirmed, but alert failed" : "Payment opened, but alert failed",
        description: workflowError?.message ?? workflowData?.error ?? "The booking was saved, but the client notification did not send.",
        variant: "destructive",
        action: buildRetryToastAction({ ...booking, status: nextStatus }),
      });
      await load();
      return;
    }

    const toastTitle = nextStatus === "confirmed" ? "Request confirmed" : "Payment opened";
    const approvalAuditMessage = buildApprovalAuditMessage({
      approverName,
      notificationType: workflowData?.notificationType,
      notificationStatus: workflowData?.notificationStatus,
      notificationMessage: workflowData?.notificationMessage,
    });

    const { error: auditError } = await db.from("booking_updates").insert({
      booking_id: booking.id,
      created_by: user.id,
      kind: "approval",
      message: approvalAuditMessage,
      sent_via_sms: false,
    });

    if (auditError) {
      toast({
        title: "Approval saved, but history entry failed",
        description: auditError.message,
        variant: "destructive",
      });
    }

    if (workflowData?.notificationStatus === "failed") {
      toast({
        title: nextStatus === "confirmed" ? "Request confirmed, but alert failed" : "Payment opened, but alert failed",
        description: workflowData.notificationMessage ?? "The booking was saved, but the client notification did not send.",
        variant: "destructive",
        action: workflowData.retryAvailable ? buildRetryToastAction({ ...booking, status: nextStatus }) : undefined,
      });
      await load();
      return;
    }

    toast({
      title: toastTitle,
      description:
        workflowData?.notificationMessage ??
        (nextStatus === "confirmed" ? "Confirmation email sent to the client." : "Payment alert sent to the client."),
    });
    await load();
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

    const deliveryWarnings = results
      .flatMap((result) => [result.data?.emailError, result.data?.smsError])
      .filter(Boolean)
      .join(" ");
    toast({
      title: messageAudience === "group" ? `Message sent to ${recipientIds.length} clients` : "Client message saved",
      description: deliveryWarnings || (messageAudience === "group" ? "Each selected client now has the message in their hub." : "The update is now in the client hub."),
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
    // Auto-expire alerts at the end of their start day if the sitter didn't
    // pick an explicit end. Keeps "Closed Today" notices from lingering forever.
    const startsAtIso = new Date(alertDraft.startsAt).toISOString();
    let endsAtIso: string | null = alertDraft.endsAt ? new Date(alertDraft.endsAt).toISOString() : null;
    if (!endsAtIso) {
      const startDate = new Date(alertDraft.startsAt);
      const eod = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59, 999);
      endsAtIso = eod.toISOString();
    }
    const { error } = await db.from("service_alerts").insert({
      sitter_id: user.id,
      kind: alertDraft.kind,
      title: alertDraft.title,
      message: alertDraft.message,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
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

  const resetAssistantPlan = () => {
    setAssistantPlan(null);
    setAssistantPreview([]);
  };

  const sendAssistantCommand = async () => {
    const command = assistantCommand.trim();
    if (!command) return;

    setAssistantBusy(true);
    resetAssistantPlan();
    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: command,
    };
    setAssistantMessages((current) => [...current, userMessage]);

    const { data, error } = await supabase.functions.invoke("assistant-schedule-plan", {
      body: { command, context: assistantContext },
    });

    setAssistantBusy(false);
    if (error || !data?.ok || !data?.plan) {
      toast({
        title: "Assistant couldn't build a plan",
        description: error?.message ?? data?.error ?? "Try rephrasing the command.",
        variant: "destructive",
      });
      return;
    }

    const plan = data.plan as AssistantPlanResponse;
    setAssistantPlan(plan);
    setAssistantCommand("");
    setAssistantMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: plan.summary,
        plan,
      },
    ]);
  };

  const applyAssistantPlan = async () => {
    if (!assistantPlan) return;
    if (assistantPlan.operations.length === 0) {
      toast({
        title: "Nothing to apply",
        description: assistantPlan.followUpQuestions[0] ?? "The assistant needs more detail before it can make changes.",
      });
      return;
    }

    setAssistantApplying(true);
    const { data, error } = await supabase.functions.invoke("assistant-schedule-execute", {
      body: {
        operations: assistantPlan.operations,
        appUrl: window.location.origin,
        previewOnly: false,
      },
    });
    setAssistantApplying(false);

    if (error || !data?.ok) {
      toast({ title: "Assistant couldn't apply changes", description: error?.message ?? data?.error ?? "Unknown error", variant: "destructive" });
      return;
    }

    const result = data as AssistantExecutionResponse;
    setAssistantPreview(result.notificationPreview ?? []);
    setAssistantMessages((current) => [
      ...current,
      {
        id: `assistant-apply-${Date.now()}`,
        role: "assistant",
        content: result.summary || "Assistant actions applied.",
        preview: result.notificationPreview ?? [],
      },
    ]);

    if (result.warnings.length > 0) {
      toast({ title: "Assistant applied with warnings", description: result.warnings[0] });
    } else {
      toast({ title: "Assistant changes applied" });
    }

    await load();
  };

  const sendAssistantNotifications = async () => {
    if (!assistantPreview.length) return;

    setAssistantApplying(true);
    const { data, error } = await supabase.functions.invoke("assistant-schedule-execute", {
      body: {
        operations: [{
          type: "send_preview_notifications",
          summary: "Send the prepared client notifications",
          bookingIds: assistantPreview.map((item) => item.bookingId),
        }],
        appUrl: window.location.origin,
        previewOnly: false,
        sendNotifications: true,
      },
    });
    setAssistantApplying(false);

    if (error || !data?.ok) {
      toast({ title: "Notifications didn't send", description: error?.message ?? data?.error ?? "Unknown error", variant: "destructive" });
      return;
    }

    const result = data as AssistantExecutionResponse;
    if (result.warnings.length > 0) {
      toast({ title: "Notifications sent with warnings", description: result.warnings[0] });
    } else {
      toast({ title: "Client notifications sent" });
    }
    setAssistantMessages((current) => [
      ...current,
      {
        id: `assistant-notify-${Date.now()}`,
        role: "assistant",
        content: "Client notifications have been sent.",
      },
    ]);
    setAssistantPreview([]);
    await load();
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
                ["Alerts", String(unreadRequestNotifications.length)],
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
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-muted p-1 md:grid-cols-7">
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

          <TabsContent value="day" className="mt-6 space-y-6">
            <Card className="border border-border p-5 shadow-soft">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="font-display text-xl uppercase text-primary">Daily snapshot</h2>
                  <p className="mt-1 text-sm text-muted-foreground">A simple visual list of the day so it’s easy to see who is out, when, and what still needs attention.</p>
                </div>
                <div className="w-full max-w-xl xl:w-auto">
                  <div>
                    <Label>{snapshotRange === "week" ? "Week of" : "Date"}</Label>
                    <Input type="date" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} className="mt-1 w-full xl:min-w-[220px]" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button type="button" variant={snapshotRange === "day" ? "secondary" : "outline"} size="sm" className="w-full border-border px-2 font-display text-[11px] uppercase sm:text-xs" onClick={() => { setSnapshotRange("day"); setSelectedDay(format(new Date(), "yyyy-MM-dd")); }}>
                      Today
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="w-full border-border px-2 font-display text-[11px] uppercase sm:text-xs" onClick={() => { setSnapshotRange("day"); setSelectedDay(format(addDays(new Date(`${selectedDay}T12:00:00`), 1), "yyyy-MM-dd")); }}>
                      Tomorrow
                    </Button>
                    <Button type="button" variant={snapshotRange === "week" ? "secondary" : "outline"} size="sm" className="w-full border-border px-2 font-display text-[11px] uppercase sm:text-xs" onClick={() => setSnapshotRange("week")}>
                      This week
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["On the list", String(dailySnapshotSummary.total)],
                  ["Confirmed", String(dailySnapshotSummary.confirmed)],
                  ["Still pending", String(dailySnapshotSummary.pending)],
                  ["Walks", String(dailySnapshotSummary.walks)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border bg-muted/40 px-4 py-3">
                    <div className="text-[11px] font-tag text-muted-foreground">{label}</div>
                    <div className="mt-2 font-display text-3xl text-primary">{value}</div>
                  </div>
                ))}
              </div>

              {dailySnapshotBookings.length === 0 ? (
                <div className="mt-6 rounded-md border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
                  <div className="font-display text-lg uppercase text-primary">Nothing booked for this {snapshotRange}</div>
                  <p className="mt-2 text-sm text-muted-foreground">Pick another {snapshotRange === "week" ? "week" : "date"} to see the schedule.</p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {(snapshotRange === "week"
                    ? weeklySnapshotGroups.map((group) => ({ key: group.date, label: group.label, bookings: group.bookings }))
                    : [{ key: selectedDay, label: format(new Date(`${selectedDay}T12:00:00`), "EEEE, MMM d"), bookings: dailySnapshotBookings }]
                  ).map((group) => (
                    <div key={group.key} className="space-y-3">
                      {snapshotRange === "week" ? <div className="font-display text-sm uppercase text-muted-foreground">{group.label}</div> : null}
                      {group.bookings.map((booking) => {
                    const owner = profileDetails[booking.customer_id];
                    const serviceName = booking.service_variants?.name ?? booking.services?.name ?? "Booking";
                    const scheduleText = formatBookingSchedule(booking);
                    const exactTime = booking.scheduled_start_at
                      ? `${format(new Date(booking.scheduled_start_at), "h:mm a")}–${format(new Date(booking.scheduled_end_at ?? booking.end_at), "h:mm a")}`
                      : booking.booking_kind === "requested" && booking.requested_window_start_minute != null && booking.requested_window_end_minute != null
                        ? `${formatMinuteTime(booking.requested_window_start_minute)}–${formatMinuteTime(booking.requested_window_end_minute)}`
                        : format(new Date(booking.start_at), "h:mm a");

                    return (
                      <div key={booking.id} className="grid gap-3 rounded-md border border-border bg-card p-4 shadow-soft md:grid-cols-[140px,1fr,auto] md:items-center">
                        <div className="rounded-md bg-muted px-3 py-3 text-center md:text-left">
                          <div className="font-display text-2xl uppercase text-primary">{exactTime}</div>
                          <div className="mt-1 text-xs font-tag text-muted-foreground">{booking.status === "confirmed" ? "Scheduled" : "Needs review"}</div>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <PetNameLabel name={booking.pets?.name ?? "Pet"} species={booking.pets?.species} className="font-display text-lg uppercase text-primary" />
                            <span className={cn("px-2 py-0.5 text-[11px] font-tag", STATUS_STYLES[booking.status] ?? "bg-muted text-muted-foreground")}>
                              {STATUS_LABELS[booking.status] ?? booking.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-foreground/80">{owner?.full_name ?? "Customer"} · {serviceName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{scheduleText}</p>
                          {booking.group_assignment_label && (
                            <div className="mt-2 inline-flex rounded-md bg-muted px-2 py-1 text-[11px] font-tag text-primary ring-1 ring-border">
                              {booking.group_assignment_label}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 md:justify-end">
                          {booking.status === "confirmed" && (
                            <Button size="sm" variant="secondary" onClick={() => setActiveTab("care")} className="font-display uppercase">
                              <MessageSquare className="h-4 w-4" /> Update owner
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedRequestId(booking.id);
                            setActiveTab("overview");
                          }} className="border-border font-display uppercase">
                            Open
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {unreadRequestNotifications.length > 0 && (
              <Card className="border border-border p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-secondary text-secondary-foreground">
                    <BellRing className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl uppercase text-primary">New booking alerts</h2>
                    <p className="text-sm text-muted-foreground">Fresh booking requests that just came in for Anneke.</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {unreadRequestNotifications.map((notification) => (
                    <div key={notification.id} className="rounded-md border border-border bg-muted/40 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-display text-lg uppercase text-primary">{notification.title}</p>
                          <p className="mt-1 text-sm text-foreground/80">{notification.message}</p>
                          <p className="mt-2 text-xs font-tag text-muted-foreground">{format(new Date(notification.created_at), "MMM d · h:mm a")}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          {notification.booking_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequestId(notification.booking_id);
                                setActiveTab("overview");
                                void markNotificationRead(notification.id);
                              }}
                              className="border-border font-display uppercase"
                            >
                              Open request <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => void markNotificationRead(notification.id)} className="font-display uppercase">
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

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
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground/80"><span>{owner?.full_name ?? "Customer"}</span><span className="text-muted-foreground">·</span><PetNameLabel name={booking.pets?.name ?? "Pet"} species={booking.pets?.species} /></p>
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

              <Card className="border border-border p-4 shadow-soft">
                <h2 className="font-display text-xl uppercase text-primary">Service playbook</h2>
                <p className="mt-2 text-sm text-muted-foreground">Moved into its own tab for cleaner daily operations.</p>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("playbook")} className="mt-4 border-border font-display uppercase">
                  Open playbook <ChevronRight className="h-4 w-4" />
                </Button>
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
                            <PetNameLabel name={approval.petName} species={petProfiles[approval.petId]?.species} className="font-display text-lg uppercase text-primary" />
                            <p className="text-sm text-muted-foreground">{approval.serviceName}</p>
                          </div>
                          <span className={cn("px-2 py-0.5 text-[11px] font-tag", approval.status === "approved" ? "bg-secondary text-secondary-foreground" : approval.status === "declined" ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground")}>
                            {approval.status}
                          </span>
                        </div>
                        {approval.riskyTags.length > 0 && (
                          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
                            <div className="font-display text-sm uppercase text-destructive">Risk flags</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {approval.riskyTags.map((tag: TemperamentTag) => (
                                <span key={tag.id} className="rounded-md bg-background px-2 py-1 text-[11px] font-tag text-destructive ring-1 ring-destructive/30">
                                  {tag.label}
                                </span>
                              ))}
                            </div>
                            {approval.openAlert && <p className="mt-2 text-xs text-muted-foreground">Existing alert: {approval.openAlert.message}</p>}
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setActivePetProfileId(approval.petId)} className="font-display uppercase">
                            <UserRound className="h-4 w-4" /> Open profile
                          </Button>
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
                <p className="mt-2 text-sm text-muted-foreground">Moved into the playbook tab with service settings and weekly lane planning.</p>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("playbook")} className="mt-4 border-border font-display uppercase">
                  Open playbook <ChevronRight className="h-4 w-4" />
                </Button>
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
                  {groupedRequestBookings.map((group) => (
                    <div key={group.id} className="rounded-md border border-border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-lg uppercase text-primary">{group.label}</h3>
                          <p className="text-sm text-muted-foreground">{group.bookings.length} service request{group.bookings.length === 1 ? "" : "s"} in this submission</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4">
                        {group.bookings.map((booking) => {
                    const draft = getDraft(booking);
                    const service = serviceMap.get(booking.service_id);
                    const variant = booking.service_variant_id ? variantMap.get(booking.service_variant_id) : null;
                    const latestAttempt = latestNotificationAttemptByBooking[booking.id];
                    const owner = profileDetails[booking.customer_id];
                    const approval = petApprovals.find((item) => item.pet_id === booking.pet_id && item.service_id === booking.service_id);
                    const isBoarding = service?.slug === "boarding";
                    const packOutingOptions = walkWindows.filter((window) => window.service_id === booking.service_id);
                    const approvedBasePriceCents = parseCurrencyInput(draft.approvedBasePrice) ?? (variant?.price_cents ?? service?.price_cents ?? booking.base_price_cents ?? booking.total_cents);
                    const extraFee = service?.extra_time_fee_cents && service.extra_time_increment_minutes
                      ? Math.ceil(Math.max(0, draft.extraTimeMinutes) / service.extra_time_increment_minutes) * service.extra_time_fee_cents
                      : 0;
                    const lateFee = draft.latePickup ? service?.late_pickup_fee_cents ?? 0 : 0;
                    const projectedTotal = approvedBasePriceCents + extraFee + lateFee;

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
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground/80">
                              <span>{owner?.full_name ?? "Customer"}</span>
                              <span className="text-muted-foreground">·</span>
                              <PetNameLabel name={booking.pets?.name ?? "Pet"} species={booking.pets?.species} />
                            </p>
                            <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                              <div className="text-[11px] font-tag text-muted-foreground">Requested by client</div>
                              <p className="mt-2 text-sm text-foreground/80">{formatBookingSchedule(booking)}</p>
                              {booking.recurrence_label && <p className="mt-2 text-[11px] font-tag text-muted-foreground">Repeat: {booking.recurrence_label}</p>}
                              {booking.notes && <p className="mt-2 text-sm text-muted-foreground">Client note: “{booking.notes}”</p>}
                            </div>
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

                        <div className="mt-4 rounded-md border border-primary/20 bg-card p-4 shadow-soft">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-tag text-primary">Final approval details</div>
                              <p className="mt-1 text-sm text-muted-foreground">These editable fields set the actual booking details Anneke will approve.</p>
                            </div>
                            <div className="rounded-md bg-accent/10 px-3 py-2 text-[11px] font-tag text-primary">Admin only</div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6 xl:items-end">
                          {booking.services?.slug === "group-walk" && (
                            <div>
                              <Label className="text-primary">Pack outing</Label>
                              <p className="mt-1 text-xs text-muted-foreground">Choose the actual outing lane for this request.</p>
                              <Select value={draft.packOutingId} onValueChange={(value) => applyPackOutingToDraft(booking, value)}>
                                <SelectTrigger className="mt-2 border-primary/20 bg-background">
                                  <SelectValue placeholder="Choose a backend outing" />
                                </SelectTrigger>
                                <SelectContent>
                                  {packOutingOptions.map((outing) => (
                                    <SelectItem key={outing.id} value={outing.id}>
                                      {`${DAYS[outing.weekday]} · ${outing.window_label} · ${formatMinuteTime(outing.start_minute)}–${formatMinuteTime(outing.end_minute)}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div>
                            <Label className="text-primary">{isBoarding ? "Check-in day" : "Date"}</Label>
                            <p className="mt-1 text-xs text-muted-foreground">Set the confirmed service date.</p>
                            <Input className="mt-2 border-primary/20 bg-background" value={draft.date} type="date" onChange={(event) => patchDraft(booking, { date: event.target.value, ...(isBoarding ? { endDate: format(addDays(new Date(`${event.target.value}T00:00:00`), 1), "yyyy-MM-dd") } : {}) })} />
                          </div>
                          {isBoarding && (
                            <div>
                              <Label className="text-primary">Checkout day</Label>
                              <p className="mt-1 text-xs text-muted-foreground">Confirm the final end date for the stay.</p>
                              <Input className="mt-2 border-primary/20 bg-background" value={draft.endDate} type="date" onChange={(event) => patchDraft(booking, { endDate: event.target.value })} />
                            </div>
                          )}
                          <div>
                            <Label className="text-primary">{isBoarding ? "Check-in" : "Start"}</Label>
                            <p className="mt-1 text-xs text-muted-foreground">Use the actual confirmed start time.</p>
                            <Input className="mt-2 border-primary/20 bg-background" value={draft.start} type="time" onChange={(event) => patchDraft(booking, { start: event.target.value })} />
                          </div>
                          <div>
                            <Label className="text-primary">{isBoarding ? "Checkout" : "End"}</Label>
                            <p className="mt-1 text-xs text-muted-foreground">Use the actual confirmed end time.</p>
                            <Input className="mt-2 border-primary/20 bg-background" value={draft.end} type="time" onChange={(event) => patchDraft(booking, { end: event.target.value })} />
                          </div>
                          <div>
                            <Label className="text-primary">{booking.services?.slug === "group-walk" ? "Pack label" : "Internal note"}</Label>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {booking.services?.slug === "group-walk" ? "Name the actual group this pet will join." : "Private admin note for the final handling plan."}
                            </p>
                            <Input
                              className={cn(
                                "mt-2 border-primary/20",
                                booking.services?.slug === "group-walk"
                                  ? "bg-background"
                                  : draft.internalNotes.trim().length > 0
                                    ? "bg-accent/10 text-foreground shadow-soft"
                                    : "bg-muted/40 text-muted-foreground placeholder:text-muted-foreground",
                              )}
                              value={booking.services?.slug === "group-walk" ? draft.groupLabel : draft.internalNotes}
                              onChange={(event) => patchDraft(booking, booking.services?.slug === "group-walk" ? { groupLabel: event.target.value, packOutingId: "" } : { internalNotes: event.target.value })}
                              placeholder={booking.services?.slug === "group-walk" ? "Afternoon adrenaline junkies" : "Handled by back gate"}
                            />
                          </div>
                          <div>
                            <Label className="text-primary">Approved price</Label>
                            <p className="mt-1 text-xs text-muted-foreground">Override the requested amount with the final approved base price.</p>
                            <Input
                              className="mt-2 border-primary/20 bg-accent/10 text-foreground shadow-soft"
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft.approvedBasePrice}
                              onChange={(event) => patchDraft(booking, { approvedBasePrice: event.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-primary">Extra time (min)</Label>
                            <p className="mt-1 text-xs text-muted-foreground">Add only approved overage for this visit.</p>
                            <Input className="mt-2 border-primary/20 bg-background" type="number" min={0} step={15} value={draft.extraTimeMinutes} onChange={(event) => patchDraft(booking, { extraTimeMinutes: Number(event.target.value) || 0 })} />
                          </div>
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
                          {booking.status === "cancelled" && (
                            <Button size="sm" variant="ghost" onClick={() => deleteBooking(booking)} className="font-display uppercase text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" /> Delete
                            </Button>
                          )}
                          {booking.status === "confirmed" && (
                            <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(booking.id, "completed")} className="font-display uppercase">
                              <Check className="h-4 w-4" /> Mark done
                            </Button>
                          )}
                          {latestAttempt?.status === "failed" && (booking.status === "confirmed" || booking.status === "awaiting_payment") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => runNotificationRetry(booking)}
                              disabled={retryingNotificationKey === booking.id}
                              className="border-border font-display uppercase"
                            >
                              <Mail className="h-4 w-4" />
                              {retryingNotificationKey === booking.id
                                ? "Retrying…"
                                : booking.status === "confirmed"
                                  ? "Retry confirmation email"
                                  : "Retry payment alert"}
                            </Button>
                          )}
                        </div>
                        {latestAttempt && (
                          <div className="mt-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-tag text-muted-foreground">
                                Client alert · attempt {latestAttempt.attempt_number}
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 text-[11px] font-tag",
                                latestAttempt.status === "sent"
                                  ? "bg-secondary text-secondary-foreground"
                                  : latestAttempt.status === "skipped"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-destructive/15 text-destructive",
                              )}>
                                {latestAttempt.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-foreground/90">{latestAttempt.message}</p>
                            {latestAttempt.error_message && (
                              <p className="mt-1 text-xs text-muted-foreground">Reason: {latestAttempt.error_message}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="playbook" className="mt-6 space-y-6">
            <div className="grid gap-4 xl:grid-cols-[0.92fr,1.08fr]">
              <Card className="border border-border p-4 shadow-soft">
                <h2 className="font-display text-xl uppercase text-primary">Service playbook</h2>
                <div className="mt-3 grid gap-2">
                  {services.map((service) => (
                    <div key={service.id} className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-base uppercase text-primary">{service.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {service.scheduling_mode === "boarding" ? "Noon-to-noon boarding" : WALK_SLUGS.has(service.slug) ? "Walk-specific schedule lanes" : "Exact booking blocks"}
                          </p>
                        </div>
                        {service.requires_pet_approval && <ShieldCheck className="h-4 w-4 text-clay" />}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/80">
                        <span>Buffer {Math.max(service.turnaround_buffer_minutes, MIN_BUFFER_MINUTES)} min</span>
                        <span>Capacity {service.max_capacity}</span>
                        {service.extra_time_fee_cents && service.extra_time_increment_minutes ? (
                          <span>Add-on {formatPriceWithDecimals(service.extra_time_fee_cents)} / {service.extra_time_increment_minutes} min</span>
                        ) : (
                          <span>No extra-time fee preset</span>
                        )}
                        {service.slug === "boarding" ? (
                          <span>Check-in/out {minutesToTime(service.boarding_checkin_minute ?? 12 * 60)} → {minutesToTime(service.boarding_checkout_minute ?? 12 * 60)}</span>
                        ) : (
                          <span>{service.late_pickup_fee_cents ? `Late fee ${formatPriceWithDecimals(service.late_pickup_fee_cents)}` : "Late fees handled manually"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">Cap {slot.max_bookings}</span>
                                <button type="button" onClick={() => openSlotEditor(slot)} aria-label="Edit booking block" className="text-muted-foreground transition-colors hover:text-primary">
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </div>
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
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{serviceMap.get(window.service_id)?.name ?? "Walk"}</span>
                                <button type="button" onClick={() => openWindowEditor(window)} aria-label="Edit walk window" className="text-muted-foreground transition-colors hover:text-primary">
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </div>
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
                    <>
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
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><PetNameLabel name={booking.pets?.name ?? "Pet"} species={booking.pets?.species} /><span>·</span><span>{formatBookingSchedule(booking)}</span></div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-md border border-border bg-muted/40 p-4">
                        <h3 className="font-display text-base uppercase text-primary">Services used</h3>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          {selectedClientServiceHistory.length === 0 ? (
                            <p className="text-muted-foreground">No service history yet.</p>
                          ) : (
                            selectedClientServiceHistory.map((service) => (
                              <span key={service.label} className="rounded-md border border-border bg-card px-3 py-2">
                                <span className="font-display uppercase text-primary">{service.label}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{service.count}×</span>
                              </span>
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

                    {canManageDashboard && selectedClientProfile && (
                      <div className="mt-4 rounded-md border border-border bg-card p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="font-display text-base uppercase text-primary">Admin-only client notes</h3>
                            <p className="text-sm text-muted-foreground">Private relationship notes and a quick quality rating only admins can see.</p>
                          </div>
                          <div className="rounded-md bg-muted px-3 py-2 text-xs font-tag text-muted-foreground">Hidden from clients</div>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-[auto,1fr]">
                          <div>
                            <Label>Star rating</Label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {[1, 2, 3, 4, 5].map((rating) => {
                                const active = rating <= clientAdminDraft.star_rating;
                                return (
                                  <button
                                    key={rating}
                                    type="button"
                                    onClick={() => saveClientAdminProfile(selectedClientId, { ...clientAdminDraft, star_rating: rating })}
                                    disabled={savingClientProfile}
                                    className={cn(
                                      "grid h-10 w-10 place-items-center rounded-md border transition-colors",
                                      active ? "border-primary bg-accent text-primary" : "border-border bg-muted/40 text-muted-foreground",
                                    )}
                                    aria-label={`Set ${selectedClientProfile.full_name} rating to ${rating} stars`}
                                  >
                                    <Star className={cn("h-4 w-4", active && "fill-current")} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <Label className="text-primary">Internal notes</Label>
                            <p className="mt-1 text-xs text-muted-foreground">Private admin context for future bookings and support decisions.</p>
                            <Textarea
                              defaultValue={clientAdminDraft.internal_notes}
                              key={`${selectedClientId}-${selectedClientAdminProfile?.internal_notes ?? ""}`}
                              maxLength={1500}
                              placeholder=""
                              className={cn(
                                "mt-2 min-h-28 border-primary/20",
                                clientAdminDraft.internal_notes?.trim()
                                  ? "bg-accent/10 text-foreground shadow-soft"
                                  : "bg-muted/40 text-muted-foreground placeholder:text-muted-foreground",
                              )}
                              onBlur={(event) => {
                                const nextNotes = event.target.value;
                                if (nextNotes === clientAdminDraft.internal_notes) return;
                                saveClientAdminProfile(selectedClientId, { ...clientAdminDraft, internal_notes: nextNotes });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    </>
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
            <Collapsible open={assistantOpen} onOpenChange={setAssistantOpen}>
              <Card className="border border-border p-4 shadow-soft">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg uppercase text-primary">AI schedule assistant</h2>
                      <p className="text-sm text-muted-foreground">Pinned here so you can compare changes against the schedule below in real time.</p>
                    </div>
                  </div>
                  <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", assistantOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
                    <Card className="border border-border p-5 shadow-soft">
                      <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-md bg-secondary text-secondary-foreground">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="font-display text-xl uppercase text-primary">Schedule assistant</h2>
                          <p className="text-sm text-muted-foreground">Type natural-language commands to build schedule blocks, adjust walk windows, block dates, or queue approvals.</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-md border border-border bg-muted/40 p-4">
                        <Label>Command</Label>
                        <Textarea
                          value={assistantCommand}
                          onChange={(event) => setAssistantCommand(event.target.value)}
                          placeholder="I am available every morning this week from 8am to 10am for solo walks and from 3pm to 5pm for group walks on Monday Wednesday and Friday every week indefinitely."
                          className="mt-2 min-h-28"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button onClick={sendAssistantCommand} disabled={assistantBusy || !assistantCommand.trim()} className="font-display uppercase">
                            <Sparkles className="h-4 w-4" />
                            {assistantBusy ? "Planning…" : "Build plan"}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => { setAssistantCommand(""); resetAssistantPlan(); }} className="border-border font-display uppercase">
                            <X className="h-4 w-4" />
                            Clear
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {assistantMessages.length === 0 ? (
                          <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                            The assistant will keep a short session history here.
                          </div>
                        ) : (
                          assistantMessages.slice(-6).map((message) => (
                            <div key={message.id} className={cn("rounded-md border px-4 py-3 text-sm", message.role === "user" ? "border-border bg-card" : "border-border bg-muted/40")}>
                              <div className="text-[11px] font-tag uppercase text-muted-foreground">{message.role === "user" ? "You" : "Assistant"}</div>
                              <p className="mt-2 whitespace-pre-wrap text-foreground/85">{message.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>

                    <Card className="border border-border p-5 shadow-soft">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-display text-xl uppercase text-primary">Action preview</h2>
                          <p className="text-sm text-muted-foreground">Review the parsed intent, exact operations, and client notifications before anything goes out.</p>
                        </div>
                        {assistantPlan ? (
                          <span className="rounded-md bg-muted px-3 py-1 text-[11px] font-tag uppercase text-muted-foreground">{assistantPlan.confidence} confidence</span>
                        ) : null}
                      </div>

                      {!assistantPlan ? (
                        <div className="mt-4 rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                          Ask the assistant to translate a schedule or approval command into a structured plan.
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          <div className="rounded-md border border-border bg-muted/40 p-4">
                            <div className="font-display text-base uppercase text-primary">{assistantPlan.intent}</div>
                            <p className="mt-2 text-sm text-foreground/80">{assistantPlan.summary}</p>
                          </div>

                          <div className="space-y-3">
                            {assistantPlan.operations.map((operation, index) => (
                              <div key={`${operation.type}-${index}`} className="rounded-md border border-border bg-card p-4 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-display text-sm uppercase text-primary">{operation.type.replace(/_/g, " ")}</div>
                                  <span className="text-[11px] font-tag uppercase text-muted-foreground">{operation.summary}</span>
                                </div>

                                {"blocks" in operation ? (
                                  <ul className="mt-3 space-y-2 text-foreground/80">
                                    {operation.blocks.map((block, blockIndex) => (
                                      <li key={blockIndex} className="rounded-md bg-muted/40 px-3 py-2">
                                        {weekdayLabel(block.weekday)} · {formatMinuteLabel(block.startMinute)}–{formatMinuteLabel(block.endMinute)} · {block.serviceSlugs.join(", ")}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}

                                {"windows" in operation ? (
                                  <ul className="mt-3 space-y-2 text-foreground/80">
                                    {operation.windows.map((window, windowIndex) => (
                                      <li key={windowIndex} className="rounded-md bg-muted/40 px-3 py-2">
                                        {window.mode === "delete" ? "Remove" : "Set"} {window.label} · {weekdayLabel(window.weekday)} · {window.serviceSlug}
                                        {window.startMinute != null && window.endMinute != null ? ` · ${formatMinuteLabel(window.startMinute)}–${formatMinuteLabel(window.endMinute)}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}

                                {"entries" in operation ? (
                                  <ul className="mt-3 space-y-2 text-foreground/80">
                                    {operation.entries.map((entry, entryIndex) => (
                                      <li key={entryIndex} className="rounded-md bg-muted/40 px-3 py-2">
                                        {entry.date}{entry.reason ? ` · ${entry.reason}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}

                                {"filters" in operation ? (
                                  <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-foreground/80">
                                    {operation.decision} requests
                                    {operation.filters.serviceSlugs?.length ? ` · services: ${operation.filters.serviceSlugs.join(", ")}` : ""}
                                    {operation.filters.relativeWindow ? ` · ${operation.filters.relativeWindow}` : ""}
                                    {operation.filters.requestGroupLabel ? ` · group: ${operation.filters.requestGroupLabel}` : ""}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>

                          {assistantPlan.warnings.length > 0 ? (
                            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
                              <div className="font-display text-sm uppercase text-primary">Warnings</div>
                              <ul className="mt-2 space-y-1 text-foreground/80">
                                {assistantPlan.warnings.map((warning) => (
                                  <li key={warning}>• {warning}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {assistantPlan.followUpQuestions.length > 0 ? (
                            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
                              <div className="font-display text-sm uppercase text-primary">Needs follow-up</div>
                              <ul className="mt-2 space-y-1 text-foreground/80">
                                {assistantPlan.followUpQuestions.map((question) => (
                                  <li key={question}>• {question}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            <Button onClick={applyAssistantPlan} disabled={assistantApplying || assistantPlan.operations.length === 0} className="font-display uppercase">
                              <Check className="h-4 w-4" />
                              {assistantApplying ? "Applying…" : "Apply changes"}
                            </Button>
                            <Button type="button" variant="outline" onClick={resetAssistantPlan} className="border-border font-display uppercase">
                              <X className="h-4 w-4" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {assistantPreview.length > 0 ? (
                        <div className="mt-5 rounded-md border border-border bg-muted/40 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="font-display text-sm uppercase text-primary">Client notification preview</div>
                              <p className="mt-1 text-sm text-muted-foreground">Nothing is sent until you confirm below.</p>
                            </div>
                            <Button onClick={sendAssistantNotifications} disabled={assistantApplying} className="font-display uppercase">
                              <Send className="h-4 w-4" />
                              Send now
                            </Button>
                          </div>

                          <div className="mt-3 space-y-2 text-sm">
                            {assistantPreview.map((item) => (
                              <div key={item.bookingId} className="rounded-md border border-border bg-card px-3 py-3">
                                <div className="font-display text-sm uppercase text-primary">{item.recipientName} · {item.serviceName}</div>
                                <p className="mt-1 text-foreground/80">{item.petName} · {new Date(item.scheduledStartAt).toLocaleString()} · {item.statusAfter}</p>
                                <p className="mt-1 text-xs uppercase text-muted-foreground">{item.templateName}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </Card>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <div className="flex flex-wrap items-center gap-2">
              {serviceCoverage.map(({ service, slotCount, windowCount, upcomingCount }) => (
                <Popover key={service.id}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-8 border-border font-display text-xs uppercase">
                      {service.requires_pet_approval && <ShieldCheck className="mr-1 h-3 w-3 text-clay" />}
                      {service.name}
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{upcomingCount}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 border border-border bg-card p-3 shadow-soft">
                    <p className="font-display text-sm uppercase text-primary">{service.name}</p>
                    <p className="text-xs text-muted-foreground">{WALK_SLUGS.has(service.slug) ? "Walk lane" : service.slug === "boarding" ? "Overnight lane" : "Exact-slot lane"}</p>
                    <div className="mt-3 grid gap-1.5 text-sm text-foreground/80">
                      <div className="flex items-center justify-between"><span>Booking blocks</span><span className="font-display text-primary">{slotCount}</span></div>
                      <div className="flex items-center justify-between"><span>Walk windows</span><span className="font-display text-primary">{windowCount}</span></div>
                      <div className="flex items-center justify-between"><span>Upcoming visits</span><span className="font-display text-primary">{upcomingCount}</span></div>
                      <div className="flex items-center justify-between"><span>Min buffer</span><span className="font-display text-primary">{Math.max(service.turnaround_buffer_minutes, MIN_BUFFER_MINUTES)}m</span></div>
                    </div>
                  </PopoverContent>
                </Popover>
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
                    <p className="text-sm text-muted-foreground">Add new walk windows or tap any existing one to load it into the editor and save changes fast.</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {TIME_PRESETS.map((preset) => (
                    <Button key={preset.label} type="button" variant="outline" className="border-border font-display uppercase" onClick={() => setNewWindow((current) => ({ ...current, start: preset.start, end: preset.end }))}>
                      {preset.label}
                    </Button>
                  ))}
                  {editingWalkWindowId && (
                    <Button type="button" variant="ghost" className="font-display uppercase" onClick={resetWalkWindowForm}>
                      Cancel edit
                    </Button>
                  )}
                </div>

                <div ref={walkWindowEditorRef} className="mt-4 grid gap-3 md:grid-cols-[1fr,1fr,auto,auto,auto,auto,auto] md:items-end">
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
                  <Button onClick={addWalkWindow} className="font-display uppercase"><Plus className="h-4 w-4" /> {editingWalkWindowId ? "Save" : "Add"}</Button>
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
                              <li key={window.id} className={cn("rounded-md border bg-card px-3 py-3 transition-colors", editingWalkWindowId === window.id ? "border-primary ring-2 ring-primary/20" : "border-border")}>
                                <div className="flex items-center justify-between gap-3">
                                  <button type="button" onClick={() => beginWalkWindowEdit(window)} className="min-w-0 text-left transition-opacity hover:opacity-80">
                                    <div className="font-display text-sm uppercase text-primary">{DAYS[window.weekday]} · {window.window_label}</div>
                                    <div className="text-xs text-muted-foreground">{formatMinuteTime(window.start_minute)}–{formatMinuteTime(window.end_minute)}</div>
                                  </button>
                                  <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => beginWalkWindowEdit(window)} aria-label="Edit walk window" className="text-muted-foreground transition-colors hover:text-primary">
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button type="button" onClick={() => removeWalkWindow(window.id)} aria-label="Remove walk window">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </button>
                                  </div>
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
                              <PetNameLabel name={booking.pets?.name ?? "Pet"} species={booking.pets?.species} className="font-display text-xl uppercase text-primary" />
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
                            <Input value={draft.note} maxLength={240} onChange={(event) => patchUpdateDraft(booking.id, { note: event.target.value })} placeholder="" />
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
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm"><span>{formatBookingSchedule(booking)}</span><span className="text-muted-foreground">·</span><span>{profileDetails[booking.customer_id]?.full_name ?? "Customer"}</span><span className="text-muted-foreground">·</span><PetNameLabel name={booking.pets?.name ?? "Pet"} species={booking.pets?.species} /></p>
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
                          {booking.status === "cancelled" && (
                            <Button size="sm" variant="ghost" onClick={() => deleteBooking(booking)} className="font-display uppercase text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /> Delete</Button>
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
                      <span className="flex flex-wrap items-center gap-2"><span>{formatBookingSchedule(booking)}</span><span className="text-muted-foreground">·</span><span>{booking.service_variants?.name ?? booking.services?.name}</span><span className="text-muted-foreground">·</span><PetNameLabel name={booking.pets?.name ?? "Pet"} species={booking.pets?.species} /></span>
                      <span className={cn("px-2 py-0.5 text-[11px] font-tag", STATUS_STYLES[booking.status] ?? "bg-muted text-muted-foreground")}>
                        {STATUS_LABELS[booking.status] ?? booking.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-6 space-y-6">
            {(() => {
              // Build augmented rows + stats
              const rows = bookings.map((b) => {
                const inv = invoicesByBooking[b.id] ?? null;
                const total = inv?.total_cents ?? b.total_cents ?? 0;
                const paid = inv?.amount_paid_cents ?? b.payment_amount_cents ?? 0;
                const owed = Math.max(0, total - paid);
                const refunded = !!(b as any).refund_id;
                const baseStatus = inv ? derivedStatus(inv) : (b.payment_status ?? (b.paid_at ? "paid" : "outstanding"));
                const status = refunded ? "refunded" : baseStatus;
                return { booking: b, inv, total, paid, owed, status };
              });
              const now = new Date();
              const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
              const stats = rows.reduce(
                (acc, r) => {
                  if (r.status !== "paid" && r.status !== "refunded" && r.status !== "void") acc.outstanding += r.owed;
                  if (r.status === "overdue") acc.overdue += r.owed;
                  if (r.booking.paid_at && new Date(r.booking.paid_at) >= monthStart) acc.paidMonth += r.paid;
                  return acc;
                },
                { outstanding: 0, overdue: 0, paidMonth: 0 },
              );

              const search = paymentsSearch.trim().toLowerCase();
              const filtered = rows
                .filter((r) => {
                  if (paymentsFilter === "all") return true;
                  return r.status === paymentsFilter;
                })
                .filter((r) => {
                  if (!search) return true;
                  const owner = profileDetails[r.booking.customer_id]?.full_name?.toLowerCase() ?? "";
                  const svc = (r.booking.service_variants?.name ?? r.booking.services?.name ?? "").toLowerCase();
                  const num = r.inv?.invoice_number?.toLowerCase() ?? "";
                  return owner.includes(search) || svc.includes(search) || num.includes(search);
                })
                .sort((a, b) => (b.booking.start_at || "").localeCompare(a.booking.start_at || ""));

              return (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Card className="border border-border p-4 shadow-soft">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-md bg-highlight text-highlight-foreground">
                          <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase text-muted-foreground">Outstanding</p>
                          <p className="font-display text-xl text-primary">{formatCents(stats.outstanding)}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="border border-border p-4 shadow-soft">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-md bg-red-100 text-red-700">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase text-muted-foreground">Overdue</p>
                          <p className="font-display text-xl text-primary">{formatCents(stats.overdue)}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="border border-border p-4 shadow-soft">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-100 text-emerald-700">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase text-muted-foreground">Paid this month</p>
                          <p className="font-display text-xl text-primary">{formatCents(stats.paidMonth)}</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <Card className="border border-border p-5 shadow-soft">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-md bg-accent text-accent-foreground">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="font-display text-xl uppercase text-primary">Accounts &amp; payments</h2>
                          <p className="text-sm text-muted-foreground">Click a row to manage invoice, send reminders, or charge a card.</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={paymentsSearch} onChange={(e) => setPaymentsSearch(e.target.value)} placeholder="Search client, service, INV…" className="h-9 w-56 pl-8" />
                        </div>
                        <div className="flex gap-1">
                          {(["outstanding", "overdue", "paid", "refunded", "all"] as const).map((key) => (
                            <Button key={key} type="button" size="sm" variant={paymentsFilter === key ? "default" : "outline"} className="font-display uppercase" onClick={() => setPaymentsFilter(key)}>
                              {key}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {filtered.length === 0 ? (
                      <p className="mt-6 text-sm text-muted-foreground">No bookings match this filter.</p>
                    ) : (
                      <ul className="mt-5 divide-y divide-border rounded-md border border-border bg-card">
                        {filtered.map(({ booking: b, inv, total, paid, owed, status }) => {
                          const owner = profileDetails[b.customer_id]?.full_name ?? "Customer";
                          const serviceName = b.service_variants?.name ?? b.services?.name ?? "Booking";
                          return (
                            <li key={b.id} className="group">
                              <button
                                type="button"
                                onClick={() => setPaymentDrawerBookingId(b.id)}
                                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-display text-sm uppercase text-primary">{owner} · {serviceName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(b.start_at), "EEE, MMM d · p")} · {formatCents(total)} total
                                    {paid ? ` · ${formatCents(paid)} paid` : ""}
                                    {inv?.invoice_number ? ` · ${inv.invoice_number}` : ""}
                                    {inv?.due_date ? ` · due ${format(new Date(inv.due_date + "T12:00:00"), "MMM d")}` : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={cn("rounded border px-2 py-0.5 text-[10px] font-display uppercase", statusBadgeClass(status))}>{status}</span>
                                  {status !== "paid" && owed > 0 && (
                                    <span className="font-display text-sm text-clay">{formatCents(owed)}</span>
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label="Quick actions"
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-8 w-8"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenuItem onClick={() => setPaymentDrawerBookingId(b.id)}>
                                        Open details
                                      </DropdownMenuItem>
                                      {owed > 0 && (
                                        <DropdownMenuItem
                                          disabled={chargingBookingId === b.id}
                                          onClick={() => chargeSavedCard(b.id)}
                                        >
                                          <Zap className="h-4 w-4" /> {chargingBookingId === b.id ? "Charging…" : `Charge ${formatCents(owed)}`}
                                        </DropdownMenuItem>
                                      )}
                                      {inv?.public_token && (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            void navigator.clipboard.writeText(`${window.location.origin}/pay/${inv.public_token}`);
                                            toast({ title: "Payment link copied" });
                                          }}
                                        >
                                          Copy pay link
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className="mt-4 text-xs text-muted-foreground">Recharge uses the card the client saved at their last checkout.</p>
                  </Card>
                </>
              );
            })()}
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
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => toggleServiceAlert(alert, !alert.is_active)} className="text-xs uppercase text-clay hover:underline">{alert.is_active ? "Pause" : "Reactivate"}</button>
                            <button type="button" onClick={() => deleteServiceAlert(alert)} aria-label={`Delete ${alert.title}`} className="text-muted-foreground transition-colors hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
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
      <Dialog open={blockAlertOpen} onOpenChange={(open) => { if (!open) { setBlockAlertOpen(false); setBlockAlertContext(null); } }}>
        <DialogContent className="border border-border bg-background shadow-soft sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase text-primary">Notify clients of closure?</DialogTitle>
          </DialogHeader>
          {blockAlertContext && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You blocked <span className="font-display uppercase text-primary">{format(new Date(`${blockAlertContext.date}T12:00:00`), "EEE, MMM d")}</span>. Send a heads-up to your clients?
              </p>
              <div>
                <Label>Message</Label>
                <Textarea value={blockAlertMessage} maxLength={600} onChange={(e) => setBlockAlertMessage(e.target.value)} className="mt-1 min-h-24" />
              </div>
              <div className="flex flex-wrap gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
                <label className="flex items-center gap-2"><Checkbox checked={blockAlertChannels.email} onCheckedChange={(c) => setBlockAlertChannels((s) => ({ ...s, email: c === true }))} /> <Mail className="h-4 w-4" /> Email</label>
                <label className="flex items-center gap-2"><Checkbox checked={blockAlertChannels.sms} onCheckedChange={(c) => setBlockAlertChannels((s) => ({ ...s, sms: c === true }))} /> <Smartphone className="h-4 w-4" /> Text</label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="font-display uppercase" onClick={() => { setBlockAlertOpen(false); setBlockAlertContext(null); }}>Skip</Button>
                <Button className="font-display uppercase" disabled={sendingBlockAlert} onClick={sendBlockedDayAlert}>
                  <Send className="h-4 w-4" /> {sendingBlockAlert ? "Sending…" : "Send alert"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!activePetProfileId} onOpenChange={(open) => !open && setActivePetProfileId(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border border-border bg-background shadow-soft sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase text-primary">
              <PetNameLabel name={activePetProfile?.name ?? "Pet profile"} species={activePetProfile?.species} className="font-display text-2xl uppercase text-primary" />
            </DialogTitle>
          </DialogHeader>

          {activePetProfile ? (
            <div className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-md border border-border bg-muted/40 aspect-square">
                  {activePetProfile.photo_url ? (
                    <img
                      src={activePetProfile.photo_url}
                      alt={activePetProfile.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No photo on file</div>
                  )}
                </div>

                <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
                  <div className="font-display text-base uppercase text-primary">Quick facts</div>
                  <div className="mt-3 grid gap-2 text-foreground/80">
                    <p>{[activePetProfile.species, activePetProfile.breed, activePetProfile.sex].filter(Boolean).join(" · ") || "No basics on file"}</p>
                    <p>
                      {[activePetProfile.age_years ? `${activePetProfile.age_years} years` : null, activePetProfile.weight_lbs ? `${activePetProfile.weight_lbs} lbs` : null]
                        .filter(Boolean)
                        .join(" · ") || "Age and weight not listed"}
                    </p>
                    <p>{activePetProfile.spayed_neutered ? "Spayed / neutered" : "Spay / neuter not noted"}</p>
                    <p>{activePetProfile.microchip_id ? `Microchip: ${activePetProfile.microchip_id}` : "No microchip listed"}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-md border border-border bg-card p-4">
                  <h3 className="font-display text-base uppercase text-primary">Temperament tags</h3>
                  <div className="mt-3 space-y-4">
                    <div>
                      <p className="text-xs font-tag text-muted-foreground">Visible to owners</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ownerVisibleTags.map((tag) => {
                          const checked = activePetTags.some((activeTag) => activeTag.id === tag.id);
                          return (
                            <label key={tag.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(next) => {
                                  if (!activePetProfile) return;
                                  const current = petTagIdsByPet[activePetProfile.id] ?? [];
                                  const nextIds = next === true ? [...new Set([...current, tag.id])] : current.filter((id) => id !== tag.id);
                                  savePetTags(activePetProfile.id, nextIds);
                                }}
                              />
                              <span>{tag.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    {canManageDashboard && (
                      <div>
                        <p className="text-xs font-tag text-muted-foreground">Internal only</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {internalOnlyTags.map((tag) => {
                            const checked = activePetTags.some((activeTag) => activeTag.id === tag.id);
                            return (
                              <label key={tag.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(next) => {
                                    if (!activePetProfile) return;
                                    const current = petTagIdsByPet[activePetProfile.id] ?? [];
                                    const nextIds = next === true ? [...new Set([...current, tag.id])] : current.filter((id) => id !== tag.id);
                                    savePetTags(activePetProfile.id, nextIds);
                                  }}
                                />
                                <span>{tag.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {[
                  ["Care notes", [activePetProfile.medications, activePetProfile.allergies, activePetProfile.dietary_notes, activePetProfile.behavioral_notes, activePetProfile.notes].filter(Boolean)],
                  ["Vet & emergency", [activePetProfile.vet_name, activePetProfile.vet_phone, activePetProfile.vet_address, activePetProfile.vet_info, activePetProfile.emergency_contact].filter(Boolean)],
                  ["Pickup & home access", [activePetProfile.authorized_pickup_name, activePetProfile.authorized_pickup_phone, activePetProfile.entry_code ? "Entry code on file" : null, activePetProfile.entry_instructions].filter(Boolean)],
                  ["Owner contacts", [activePetProfile.owner_phone, activePetProfile.secondary_contact_name, activePetProfile.secondary_contact_phone, activePetProfile.insurance_provider, activePetProfile.insurance_policy].filter(Boolean)],
                ].map(([title, items]) => (
                  <div key={title as string} className="rounded-md border border-border bg-card p-4">
                    <h3 className="font-display text-base uppercase text-primary">{title as string}</h3>
                    {Array.isArray(items) && items.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                        {items.map((item) => (
                          <li key={String(item)} className="rounded-md bg-muted/40 px-3 py-2">
                            {String(item)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">Nothing added here yet.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">This pet profile is not available yet.</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!snapshotEditor} onOpenChange={(open) => !open && setSnapshotEditor(null)}>
        <DialogContent className="border border-border bg-background shadow-soft sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase text-primary">
              {snapshotEditor?.kind === "slot" ? "Edit booking block" : "Edit walk window"}
            </DialogTitle>
          </DialogHeader>

          {snapshotEditor && (
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Day</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={snapshotEditor.weekday}
                    onChange={(event) =>
                      setSnapshotEditor((current) => (current ? { ...current, weekday: Number(event.target.value) } : current))
                    }
                  >
                    {DAYS.map((day, index) => (
                      <option key={day} value={index}>{day}</option>
                    ))}
                  </select>
                </div>

                {snapshotEditor.kind === "window" ? (
                  <div>
                    <Label>Walk type</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={snapshotEditor.serviceId}
                      onChange={(event) =>
                        setSnapshotEditor((current) => current?.kind === "window" ? { ...current, serviceId: event.target.value } : current)
                      }
                    >
                      {walkServices.map((service) => (
                        <option key={service.id} value={service.id}>{service.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <Label>Capacity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={snapshotEditor.maxBookings}
                      onChange={(event) =>
                        setSnapshotEditor((current) => (current ? { ...current, maxBookings: Math.max(1, Number(event.target.value) || 1) } : current))
                      }
                    />
                  </div>
                )}

                <div>
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={snapshotEditor.start}
                    onChange={(event) => setSnapshotEditor((current) => (current ? { ...current, start: event.target.value } : current))}
                  />
                </div>
                <div>
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={snapshotEditor.end}
                    onChange={(event) => setSnapshotEditor((current) => (current ? { ...current, end: event.target.value } : current))}
                  />
                </div>

                {snapshotEditor.kind === "window" ? (
                  <>
                    <div>
                      <Label>Label</Label>
                      <Input
                        value={snapshotEditor.label}
                        onChange={(event) =>
                          setSnapshotEditor((current) => current?.kind === "window" ? { ...current, label: event.target.value } : current)
                        }
                      />
                    </div>
                    <div>
                      <Label>Capacity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={snapshotEditor.maxBookings}
                        onChange={(event) =>
                          setSnapshotEditor((current) => (current ? { ...current, maxBookings: Math.max(1, Number(event.target.value) || 1) } : current))
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2">
                    <Label>Services in this block</Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {exactSlotServices.map((service) => {
                        const checked = snapshotEditor.serviceIds.includes(service.id);
                        return (
                          <label key={service.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                setSnapshotEditor((current) => {
                                  if (!current || current.kind !== "slot") return current;
                                  return {
                                    ...current,
                                    serviceIds: next === true
                                      ? [...new Set([...current.serviceIds, service.id])]
                                      : current.serviceIds.filter((id) => id !== service.id),
                                  };
                                });
                              }}
                            />
                            <span>{service.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSnapshotEditor(null)} className="font-display uppercase">
                  Cancel
                </Button>
                <Button type="button" onClick={saveSnapshotEditor} className="font-display uppercase">
                  Save changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {(() => {
        const b = paymentDrawerBookingId ? bookings.find((x) => x.id === paymentDrawerBookingId) : null;
        if (!b) return null;
        const drawerBooking: PaymentDrawerBooking = {
          id: b.id,
          customer_id: b.customer_id,
          total_cents: b.total_cents ?? null,
          payment_amount_cents: b.payment_amount_cents ?? null,
          payment_status: b.payment_status ?? null,
          paid_at: b.paid_at ?? null,
          start_at: b.start_at,
          end_at: b.end_at,
          refund_id: (b as any).refund_id ?? null,
          stripe_payment_intent: (b as any).stripe_payment_intent ?? null,
          stripe_charge_id: (b as any).stripe_charge_id ?? null,
          service_label: b.service_variants?.name ?? b.services?.name ?? "Booking",
          customer_name: profileDetails[b.customer_id]?.full_name ?? "Customer",
        };
        return (
          <PaymentDrawer
            open={!!paymentDrawerBookingId}
            onOpenChange={(o) => { if (!o) setPaymentDrawerBookingId(null); }}
            booking={drawerBooking}
            hasSavedCard={false}
            onChanged={() => { void load(); }}
          />
        );
      })()}
      <SiteFooter />
    </main>
  );
};

export default SitterDashboard;
