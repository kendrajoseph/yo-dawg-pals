import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BellRing, CalendarDays, CalendarPlus, ChevronRight, CreditCard, Download, FileText, Mail, PawPrint, Smartphone, Trash2, User, X } from "lucide-react";
import { formatBookingSchedule, formatPriceWithDecimals, STATUS_LABELS, STATUS_STYLES } from "@/lib/booking";
import { formatCents, statusBadgeClass, derivedStatus } from "@/lib/invoices";
import { downloadCsv, formatCentsForCsv, todayStamp } from "@/lib/csv";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getStripeEnvironment } from "@/lib/stripe";
import { LeaveReviewDialog } from "@/components/LeaveReviewDialog";

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  total_cents: number;
  deposit_cents: number;
  payment_amount_cents: number | null;
  extra_time_fee_cents: number;
  late_pickup_fee_cents: number;
  notes: string | null;
  booking_kind?: string | null;
  requested_date?: string | null;
  requested_window_label?: string | null;
  scheduled_start_at?: string | null;
  sitter_id: string;
  services: { name: string; slug: string } | null;
  service_variants: { name: string } | null;
  pets: { name: string } | null;
};

type BookingUpdateRow = {
  id: string;
  booking_id: string;
  kind: "pickup" | "dropoff" | "note" | "approval";
  message: string | null;
  sent_via_sms: boolean;
  created_at: string;
};

type ProfileSettings = {
  mobile_phone: string | null;
  sms_opt_in: boolean;
};

type ClientMessageRow = {
  id: string;
  subject: string;
  message: string;
  kind: "service_update" | "customer_service" | "offer";
  send_email: boolean;
  send_sms: boolean;
  delivered_email_at: string | null;
  delivered_sms_at: string | null;
  booking_id: string | null;
  created_at: string;
};

type ServiceAlertRow = {
  id: string;
  title: string;
  message: string;
  kind: "hours_update" | "closure" | "announcement" | "promo";
  starts_at: string;
  ends_at: string | null;
  pin_to_profile: boolean;
};

type CustomerInvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total_cents: number;
  subtotal_cents: number;
  amount_paid_cents: number;
  due_date: string | null;
  created_at: string;
  paid_at: string | null;
  sent_at: string | null;
  public_token: string;
  notes: string | null;
};
  pickup: "Picked up",
  dropoff: "Dropped off",
  note: "Care note",
  approval: "Approval",
};

const formatUpdateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const Account = () => {
  const db = supabase as any;
  const { user, canManageDashboard } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingUpdates, setBookingUpdates] = useState<Record<string, BookingUpdateRow[]>>({});
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>({ mobile_phone: null, sms_opt_in: false });
  const [clientMessages, setClientMessages] = useState<ClientMessageRow[]>([]);
  const [serviceAlerts, setServiceAlerts] = useState<ServiceAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;

    const [{ data: bookingData }, { data: profileData }, { data: messageData }, { data: alertData }] = await Promise.all([
      db
        .from("bookings")
        .select("id, start_at, end_at, status, total_cents, deposit_cents, payment_amount_cents, extra_time_fee_cents, late_pickup_fee_cents, notes, booking_kind, requested_date, requested_window_label, scheduled_start_at, sitter_id, services(name, slug), service_variants(name), pets(name)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false }),
      db.from("profiles").select("mobile_phone, sms_opt_in").eq("id", user.id).maybeSingle(),
      db.from("client_messages").select("id, subject, message, kind, send_email, send_sms, delivered_email_at, delivered_sms_at, booking_id, created_at").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(8),
      db.from("service_alerts").select("id, title, message, kind, starts_at, ends_at, pin_to_profile").eq("is_active", true).order("starts_at", { ascending: false }).limit(6),
    ]);

    const nextBookings = (bookingData ?? []) as BookingRow[];
    setBookings(nextBookings);
    setProfileSettings({
      mobile_phone: (profileData as { mobile_phone?: string | null } | null)?.mobile_phone ?? null,
      sms_opt_in: Boolean((profileData as { sms_opt_in?: boolean | null } | null)?.sms_opt_in),
    });
    setClientMessages((messageData ?? []) as ClientMessageRow[]);
    const nowMs = Date.now();
    const liveAlerts = ((alertData ?? []) as ServiceAlertRow[]).filter(
      (a) => !a.ends_at || new Date(a.ends_at).getTime() >= nowMs,
    );
    setServiceAlerts(liveAlerts);

    if (nextBookings.length > 0) {
      const { data: updatesData } = await db
        .from("booking_updates")
        .select("id, booking_id, kind, message, sent_via_sms, created_at")
        .in("booking_id", nextBookings.map((booking) => booking.id))
        .order("created_at", { ascending: false });

      const grouped = ((updatesData ?? []) as BookingUpdateRow[]).reduce<Record<string, BookingUpdateRow[]>>((acc, update) => {
        acc[update.booking_id] = [...(acc[update.booking_id] ?? []), update];
        return acc;
      }, {});
      setBookingUpdates(grouped);
    } else {
      setBookingUpdates({});
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleCancel = async (booking: BookingRow) => {
    setCancellingId(booking.id);
    const { data, error } = await supabase.functions.invoke("cancel-booking", {
      body: { bookingId: booking.id, environment: getStripeEnvironment() },
    });
    setCancellingId(null);

    if (error) {
      toast({ title: "Couldn't cancel", description: error.message, variant: "destructive" });
      return;
    }

    if (data?.refunded) {
      toast({ title: "Booking cancelled", description: "Your refund is on its way." });
    } else {
      toast({ title: "Booking cancelled", description: "No refund was issued for this cancellation." });
    }
    load();
  };

  const handleDelete = async (booking: BookingRow) => {
    setDeletingId(booking.id);
    const { error } = await db.from("bookings").delete().eq("id", booking.id);
    setDeletingId(null);

    if (error) {
      toast({ title: "Couldn't delete booking", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Booking deleted", description: "The cancelled booking has been removed from your account." });
    load();
  };

  const handleDeleteMessage = async (messageId: string) => {
    setDeletingMessageId(messageId);
    const { error } = await db.from("client_messages").delete().eq("id", messageId);
    setDeletingMessageId(null);
    if (error) {
      toast({ title: "Couldn't delete message", description: error.message, variant: "destructive" });
      return;
    }
    setClientMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  return (
    <main className="min-h-screen bg-background texture-grain">
      <SiteNav />
      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <span className="font-tag text-2xl text-clay">your stuff</span>
            <h1 className="font-display text-5xl text-primary sm:text-6xl">My account.</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-2 border-primary font-display uppercase"><Link to="/account/profile"><User className="h-4 w-4" /> My profile</Link></Button>
            <Button asChild variant="outline" className="border-2 border-primary font-display uppercase"><Link to="/account/pets"><PawPrint className="h-4 w-4" /> My pets</Link></Button>
            <Button asChild variant="outline" className="border-2 border-primary font-display uppercase"><Link to="/account/calendar"><CalendarDays className="h-4 w-4" /> My calendar</Link></Button>
            <Button asChild className="bg-primary font-display uppercase shadow-pop-accent"><Link to="/book"><CalendarPlus className="h-4 w-4" /> Book a service</Link></Button>
            {canManageDashboard && <Button asChild variant="secondary" className="font-display uppercase"><Link to="/sitter">Sitter dashboard</Link></Button>}
          </div>
        </div>

        <Card className="mt-8 border-4 border-primary p-5 shadow-pop sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"><Smartphone className="h-5 w-5" /></div>
              <div>
                <h2 className="font-display text-xl uppercase text-primary">Text updates</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {profileSettings.sms_opt_in && profileSettings.mobile_phone
                    ? `Text updates will go to ${profileSettings.mobile_phone} for pickup, drop-off, and quick care notes.`
                    : "Turn on text updates to get simple care updates while your dog is with us."}
                </p>
              </div>
            </div>
            <Button asChild variant={profileSettings.sms_opt_in && profileSettings.mobile_phone ? "outline" : "default"} className={profileSettings.sms_opt_in && profileSettings.mobile_phone ? "border-2 border-primary font-display uppercase" : "bg-primary font-display uppercase shadow-pop-accent"}>
              <Link to="/account/profile">{profileSettings.sms_opt_in && profileSettings.mobile_phone ? "Edit text settings" : "Add mobile number"}</Link>
            </Button>
          </div>
        </Card>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr,1fr]">
          <Card className="border-4 border-primary p-5 shadow-pop sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-highlight text-primary"><BellRing className="h-5 w-5" /></div>
              <div>
                <h2 className="font-display text-xl uppercase text-primary">Service alerts</h2>
                <p className="mt-1 text-sm text-muted-foreground">Hours changes, closures, and important announcements from Anneke live here.</p>
              </div>
            </div>
            {serviceAlerts.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No active alerts right now.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {serviceAlerts.map((alert) => (
                  <li key={alert.id} className="border border-border bg-muted/50 px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-xs uppercase text-primary">{alert.kind.replace(/_/g, " ")}</span>
                      <span className="text-[11px] text-muted-foreground">{formatUpdateTime(alert.starts_at)}</span>
                    </div>
                    <p className="mt-1 font-display text-base uppercase text-primary">{alert.title}</p>
                    <p className="mt-1 text-foreground/80">{alert.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-4 border-primary p-5 shadow-pop sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Mail className="h-5 w-5" /></div>
              <div>
                <h2 className="font-display text-xl uppercase text-primary">Message hub</h2>
                <p className="mt-1 text-sm text-muted-foreground">Direct notes from Anneke, with in-app delivery and optional email or text.</p>
              </div>
            </div>
            {clientMessages.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No direct messages yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {clientMessages.map((message) => (
                  <li key={message.id} className="border border-border bg-muted/50 px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-xs uppercase text-primary">{message.kind.replace(/_/g, " ")}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{formatUpdateTime(message.created_at)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(message.id)}
                          disabled={deletingMessageId === message.id}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                          aria-label="Delete message"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 font-display text-base uppercase text-primary">{message.subject}</p>
                    <p className="mt-1 text-foreground/80">{message.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <h2 className="mt-10 font-display text-2xl uppercase text-primary">Bookings</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : bookings.length === 0 ? (
          <Card className="mt-4 -rotate-1 border-4 border-primary p-8 text-center shadow-pop">
            <p className="font-tag text-2xl text-clay">no bookings yet</p>
            <p className="mt-2 text-sm text-muted-foreground">Lock in a walk, sit, board, or meet & greet.</p>
            <Button asChild className="mt-6 font-display uppercase shadow-pop-accent"><Link to="/book">Book your first service</Link></Button>
          </Card>
        ) : (
          <div className="mt-4 grid gap-3">
            {bookings.map((booking) => {
              const referenceTime = booking.scheduled_start_at ?? booking.start_at;
              const hoursUntil = (new Date(referenceTime).getTime() - Date.now()) / 36e5;
              const isUpcoming = hoursUntil > 0;
              const canPay = booking.status === "pending_payment" || booking.status === "awaiting_payment";
              const canCancel = isUpcoming && ["requested", "pending_payment", "awaiting_payment", "confirmed"].includes(booking.status);
              const refundEligible = hoursUntil >= 24 && booking.status === "confirmed";
              const helperText = booking.status === "requested"
                ? "Anneke is reviewing the match and will confirm the final time before payment opens."
                : booking.status === "awaiting_payment" || booking.status === "pending_payment"
                ? "Anneke has approved the match and confirmed the final time — payment is ready when you are."
                : null;
              const updates = bookingUpdates[booking.id] ?? [];
              const displayName = booking.service_variants?.name ?? booking.services?.name ?? "Service";

              return (
                <article key={booking.id} className="border-4 border-primary bg-card p-4 shadow-pop">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-xl uppercase">{displayName}</span>
                        <span className={`px-2 py-0.5 text-xs font-display uppercase ${STATUS_STYLES[booking.status] ?? ""}`}>{STATUS_LABELS[booking.status] ?? booking.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-foreground/80">{formatBookingSchedule(booking)} · for <span className="font-tag text-lg text-clay">{booking.pets?.name}</span></p>
                      {helperText && <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>}
                      {(booking.extra_time_fee_cents > 0 || booking.late_pickup_fee_cents > 0) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {booking.extra_time_fee_cents > 0 ? `${formatPriceWithDecimals(booking.extra_time_fee_cents)} extra time` : ""}
                          {booking.extra_time_fee_cents > 0 && booking.late_pickup_fee_cents > 0 ? " · " : ""}
                          {booking.late_pickup_fee_cents > 0 ? `${formatPriceWithDecimals(booking.late_pickup_fee_cents)} late pickup` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {canPay ? (
                          <div className="font-display text-2xl text-clay">{formatPriceWithDecimals(booking.payment_amount_cents ?? booking.total_cents)} <span className="text-xs uppercase">due</span></div>
                        ) : ["confirmed", "completed"].includes(booking.status) ? (
                          <div className="font-display text-2xl">{formatPriceWithDecimals(booking.payment_amount_cents ?? booking.total_cents)} <span className="text-xs uppercase text-secondary-foreground">paid</span></div>
                        ) : (
                          <div className="font-display text-2xl">{formatPriceWithDecimals(booking.total_cents)}</div>
                        )}
                      </div>
                      {canPay && <Button asChild size="sm" className="bg-tag font-display uppercase text-tag-foreground shadow-pop-accent"><Link to={`/booking/${booking.id}/checkout`}><CreditCard className="h-4 w-4" /> Pay</Link></Button>}
                      {canCancel && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="border-2 border-primary font-display uppercase"><X className="h-4 w-4" /> Cancel</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {refundEligible
                                  ? "You'll receive a full refund since this is more than 24 hours away."
                                  : booking.status === "requested" || booking.status === "awaiting_payment" || booking.status === "pending_payment"
                                  ? "This booking is still in a pre-confirmed state, so cancelling will simply release the request."
                                  : "Less than 24 hours until your service — per policy, no refund will be issued."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep booking</AlertDialogCancel>
                              <AlertDialogAction disabled={cancellingId === booking.id} onClick={() => handleCancel(booking)}>
                                {cancellingId === booking.id ? "Cancelling…" : "Cancel booking"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {booking.status === "completed" && user && (
                        <LeaveReviewDialog
                          bookingId={booking.id}
                          customerId={user.id}
                          sitterId={booking.sitter_id}
                          serviceLabel={displayName}
                          petName={booking.pets?.name}
                        />
                      )}
                      {booking.status === "cancelled" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="font-display uppercase text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this cancelled booking?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes the cancelled booking from your account history and cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep booking</AlertDialogCancel>
                              <AlertDialogAction disabled={deletingId === booking.id} onClick={() => handleDelete(booking)}>
                                {deletingId === booking.id ? "Deleting…" : "Delete booking"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <ChevronRight className="hidden h-5 w-5 opacity-40 sm:block" />
                    </div>
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-sm uppercase text-primary">Care updates</h3>
                      <span className="text-xs text-muted-foreground">{profileSettings.sms_opt_in && profileSettings.mobile_phone ? "Text updates enabled" : "Profile mobile number needed for texts"}</span>
                    </div>
                    {updates.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {updates.slice(0, 4).map((update) => (
                          <li key={update.id} className="border border-border bg-muted/50 px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-display text-xs uppercase text-primary">{kindLabel[update.kind]}</span>
                              <span className="text-[11px] text-muted-foreground">{formatUpdateTime(update.created_at)}{update.sent_via_sms ? " · texted" : ""}</span>
                            </div>
                            {update.message && <p className="mt-1 text-foreground/80">{update.message}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">No updates yet — Anneke will add them here as the visit happens.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
};

export default Account;
