import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  PawPrint,
  Plus,
  StickyNote,
  User as UserIcon,
} from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PaymentDrawer, type PaymentDrawerBooking } from "@/components/payments/PaymentDrawer";
import AddPetToBookingDialog from "@/components/sitter/AddPetToBookingDialog";
import AddServiceToBookingDialog from "@/components/sitter/AddServiceToBookingDialog";
import { formatCents } from "@/lib/invoices";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type BookingRow = {
  id: string;
  customer_id: string;
  pet_id: string;
  service_id: string;
  status: string;
  start_at: string;
  end_at: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  notes: string | null;
  internal_notes: string | null;
  group_assignment_label: string | null;
  request_group_label: string | null;
  recurrence_label: string | null;
  total_cents: number | null;
  base_price_cents: number | null;
  extra_time_fee_cents: number | null;
  late_pickup_fee_cents: number | null;
  payment_status: string | null;
  payment_amount_cents: number | null;
  paid_at: string | null;
  refund_id: string | null;
  stripe_payment_intent: string | null;
  stripe_charge_id: string | null;
  pets: { id: string; name: string; species: string } | null;
  services: { id: string; name: string } | null;
};

const fmtRange = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${format(s, "EEE, MMM d · HH:mm")}–${format(e, "HH:mm")}`
    : `${format(s, "EEE, MMM d HH:mm")} → ${format(e, "EEE, MMM d HH:mm")}`;
};

export default function SitterBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [customerName, setCustomerName] = useState<string>("Client");
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addPetOpen, setAddPetOpen] = useState(false);

  const load = async () => {
    if (!id || !user?.id) return;
    setLoading(true);
    const { data: b } = await supabase
      .from("bookings")
      .select(
        "id, customer_id, pet_id, service_id, status, start_at, end_at, scheduled_start_at, scheduled_end_at, notes, internal_notes, group_assignment_label, request_group_label, recurrence_label, total_cents, base_price_cents, extra_time_fee_cents, late_pickup_fee_cents, payment_status, payment_amount_cents, paid_at, refund_id, stripe_payment_intent, stripe_charge_id, pets(id, name, species), services(id, name)",
      )
      .eq("id", id)
      .eq("sitter_id", user.id)
      .maybeSingle();

    setBooking((b as any) ?? null);

    if (b?.customer_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", b.customer_id)
        .maybeSingle();
      setCustomerName((p as any)?.full_name ?? "Client");
      setCustomerPhone((p as any)?.phone ?? null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  if (loading) {
    return (
      <SitterShell>
        <div className="p-6 text-sm text-muted-foreground">Loading booking…</div>
      </SitterShell>
    );
  }

  if (!booking) {
    return (
      <SitterShell>
        <EmptyState
          title="Booking not found"
          description="It may have been cancelled or removed."
        />
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link to="/sitter/calendar"><ArrowLeft className="mr-2 h-4 w-4" />Back to calendar</Link>
          </Button>
        </div>
      </SitterShell>
    );
  }

  const startAt = booking.scheduled_start_at ?? booking.start_at;
  const endAt = booking.scheduled_end_at ?? booking.end_at;

  const drawerBooking: PaymentDrawerBooking = {
    id: booking.id,
    customer_id: booking.customer_id,
    total_cents: booking.total_cents,
    payment_amount_cents: booking.payment_amount_cents,
    payment_status: booking.payment_status,
    paid_at: booking.paid_at,
    start_at: booking.start_at,
    end_at: booking.end_at,
    refund_id: booking.refund_id,
    stripe_payment_intent: booking.stripe_payment_intent,
    stripe_charge_id: booking.stripe_charge_id,
    service_label: booking.services?.name ?? "Service",
    customer_name: customerName,
  };

  const paid = booking.payment_status === "paid" || !!booking.paid_at;

  return (
    <SitterShell>
      <Link to="/sitter/calendar" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />Back to calendar
      </Link>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-primary">
            {booking.services?.name ?? "Service"} for {booking.pets?.name ?? "pet"}
          </h1>
          <p className="text-sm text-muted-foreground">{customerName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">{booking.status.replace(/_/g, " ")}</Badge>
          <Badge variant="outline" className={paid ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}>
            {paid ? "Paid" : "Outstanding"}
          </Badge>
        </div>
      </div>

      <Card className="mb-4 border border-border p-5 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Item icon={<UserIcon className="h-4 w-4" />} label="Client" value={customerName} extra={customerPhone ?? undefined} />
          <Item
            icon={<PawPrint className="h-4 w-4" />}
            label="Pet"
            value={`${booking.pets?.name ?? "—"}${booking.pets?.species ? ` (${booking.pets.species})` : ""}`}
          />
          <Item icon={<CalendarClock className="h-4 w-4" />} label="Scheduled" value={fmtRange(startAt, endAt)} />
          <Item
            icon={<CreditCard className="h-4 w-4" />}
            label="Total"
            value={formatCents(booking.total_cents ?? 0)}
            extra={booking.payment_amount_cents ? `Paid ${formatCents(booking.payment_amount_cents)}` : undefined}
          />
        </div>

        {(booking.recurrence_label || booking.request_group_label || booking.group_assignment_label) && (
          <>
            <Separator className="my-4" />
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Group / recurrence</div>
            <p className="mt-1 text-sm">
              {booking.recurrence_label ?? booking.request_group_label ?? booking.group_assignment_label}
            </p>
          </>
        )}

        {booking.notes && (
          <>
            <Separator className="my-4" />
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Client notes</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{booking.notes}</p>
          </>
        )}

        {booking.internal_notes && (
          <>
            <Separator className="my-4" />
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <StickyNote className="h-3.5 w-3.5" /> Internal notes
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{booking.internal_notes}</p>
          </>
        )}
      </Card>

      <Card className="mb-4 border border-border p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-primary">Pricing & payment</h3>
            <p className="text-sm text-muted-foreground">
              Base {formatCents(booking.base_price_cents ?? 0)}
              {booking.extra_time_fee_cents ? ` · extra time ${formatCents(booking.extra_time_fee_cents)}` : ""}
              {booking.late_pickup_fee_cents ? ` · late pickup ${formatCents(booking.late_pickup_fee_cents)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAddPetOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />Add pet to booking
            </Button>
            <Button variant="outline" onClick={() => navigate(`/sitter/clients/${booking.customer_id}`)}>
              Open client
            </Button>
            <Button onClick={() => setDrawerOpen(true)}>
              {paid ? <><CheckCircle2 className="mr-1.5 h-4 w-4" />Payment details</> : <><CreditCard className="mr-1.5 h-4 w-4" />Manage payment</>}
            </Button>
          </div>
        </div>
      </Card>

      <AddPetToBookingDialog
        open={addPetOpen}
        onOpenChange={setAddPetOpen}
        bookingId={booking.id}
        customerId={booking.customer_id}
        onAdded={load}
      />

      <PaymentDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        booking={drawerBooking}
        hasSavedCard={false}
        onChanged={load}
      />
    </SitterShell>
  );
}

function Item({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: string; extra?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
      {extra && <div className="text-xs text-muted-foreground">{extra}</div>}
    </div>
  );
}
