import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft, CheckCircle2, XCircle, PawPrint, User as UserIcon, Clock, CreditCard, FileText, Send, Plus,
} from "lucide-react";
import AddPetToBookingDialog from "@/components/sitter/AddPetToBookingDialog";
import { SitterShell } from "@/components/sitter/SitterShell";
import { EmptyState } from "@/components/sitter/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { approveBooking } from "@/lib/approveBooking";
import { formatCents } from "@/lib/invoices";

type GroupBooking = {
  id: string;
  customer_id: string;
  pet_id: string;
  service_id: string;
  status: string;
  bundle_position: number;
  requested_date: string | null;
  requested_end_date: string | null;
  requested_window_label: string | null;
  requested_window_start_minute: number | null;
  requested_window_end_minute: number | null;
  base_price_cents: number | null;
  total_cents: number | null;
  notes: string | null;
  pets: { id: string; name: string; species: string; photo_url: string | null } | null;
  services: {
    id: string; name: string; slug: string; duration_minutes: number;
    price_cents: number; payment_mode: "full" | "deposit" | "free";
  } | null;
  service_variants: { sibling_discount_percent: number } | null;
};

const minutesToTime = (minutes: number | null | undefined, fallback = "09:00"): string => {
  if (minutes == null) return fallback;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export default function GroupRequestDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<GroupBooking[]>([]);
  const [customerName, setCustomerName] = useState("Client");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"approve" | "decline" | null>(null);
  const [internalNotes, setInternalNotes] = useState("");
  const [addPetOpen, setAddPetOpen] = useState(false);

  // Editable pricing per booking
  const [prices, setPrices] = useState<Record<string, string>>({});

  const reload = async () => {
    if (!groupId || !user?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id, customer_id, pet_id, service_id, status, bundle_position,
        requested_date, requested_end_date, requested_window_label,
        requested_window_start_minute, requested_window_end_minute,
        base_price_cents, total_cents, notes,
        pets(id, name, species, photo_url),
        services(id, name, slug, duration_minutes, price_cents, payment_mode),
        service_variants(sibling_discount_percent)
      `)
      .eq("request_group_id", groupId)
      .eq("sitter_id", user.id)
      .order("bundle_position");

    if (error || !data || data.length === 0) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const sorted = (data as any[]).sort((a, b) => (a.bundle_position ?? 0) - (b.bundle_position ?? 0));
    setBookings(sorted);

    // Set initial prices
    const p: Record<string, string> = {};
    for (const b of sorted) {
      p[b.id] = ((b.base_price_cents ?? b.services?.price_cents ?? 0) / 100).toFixed(2);
    }
    setPrices(p);

    // Resolve customer name
    if (sorted[0]?.customer_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", sorted[0].customer_id)
        .maybeSingle();
      setCustomerName((profile as any)?.full_name ?? "Client");
    }

    setLoading(false);
  };

  useEffect(() => { void reload(); }, [groupId, user?.id]);

  const first = bookings[0];
  const service = first?.services;
  const allRequested = bookings.every((b) => b.status === "requested");

  // Compute totals with sibling discounts
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    const lines: { bookingId: string; petName: string; baseCents: number; discountCents: number; finalCents: number }[] = [];

    for (const b of bookings) {
      const baseCents = Math.round((parseFloat(prices[b.id] ?? "0") || 0) * 100);
      const discountPct = b.bundle_position > 0 ? (b.service_variants?.sibling_discount_percent ?? 0) : 0;
      const discountCents = Math.round(baseCents * discountPct / 100);
      const finalCents = baseCents - discountCents;
      subtotal += baseCents;
      totalDiscount += discountCents;
      lines.push({
        bookingId: b.id,
        petName: b.pets?.name ?? "Pet",
        baseCents,
        discountCents,
        finalCents,
      });
    }

    return { subtotal, totalDiscount, grandTotal: subtotal - totalDiscount, lines };
  }, [bookings, prices]);

  const handleApproveAll = async () => {
    if (!first || !service || !user || !allRequested) return;
    setWorking("approve");

    let allOk = true;
    let lastStatus: "confirmed" | "awaiting_payment" | undefined;
    let lastNotification = "";

    for (const b of bookings) {
      const baseCents = Math.round((parseFloat(prices[b.id] ?? "0") || 0) * 100);

      const result = await approveBooking({
        bookingId: b.id,
        sitterId: user.id,
        serviceSlug: service.slug,
        serviceDurationMinutes: service.duration_minutes,
        paymentMode: service.payment_mode,
        date: b.requested_date ?? format(new Date(), "yyyy-MM-dd"),
        startTime: minutesToTime(b.requested_window_start_minute, "09:00"),
        endTime: minutesToTime(b.requested_window_end_minute, "09:30"),
        endDate: service.slug === "boarding" ? (b.requested_end_date ?? undefined) : undefined,
        approvedBasePriceCents: baseCents,
        groupLabel: null,
        internalNotes: b === first ? (internalNotes || null) : null,
        appUrl: window.location.origin,
      });

      if (!result.ok) {
        toast({ title: `Failed to approve ${b.pets?.name}`, description: result.error, variant: "destructive" });
        allOk = false;
        break;
      }
      lastStatus = result.status;
      lastNotification = result.notificationMessage ?? "";
    }

    // Auto-create a combined invoice for the group
    if (allOk) {
      try {
        await supabase.functions.invoke("create-invoice", {
          body: {
            requestGroupId: groupId,
            sendEmail: false,
            applyTax: true,
            applySiblingDiscount: true,
          },
        });
      } catch (e) {
        console.warn("Auto-invoice creation failed (non-blocking):", e);
      }
    }

    setWorking(null);
    if (allOk) {
      toast({
        title: `All ${bookings.length} bookings ${lastStatus === "confirmed" ? "confirmed" : "approved"}`,
        description: lastNotification || `${customerName}'s ${bookings.length} pets are booked. Draft invoice created.`,
      });
      navigate("/sitter/inbox");
    }
  };

  if (loading) {
    return <SitterShell><div className="p-6 text-sm text-muted-foreground">Loading group request…</div></SitterShell>;
  }

  if (bookings.length === 0) {
    return (
      <SitterShell>
        <EmptyState title="Request group not found" description="It may have been cancelled or already processed." />
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link to="/sitter/inbox"><ArrowLeft className="mr-2 h-4 w-4" />Back to inbox</Link>
          </Button>
        </div>
      </SitterShell>
    );
  }

  return (
    <SitterShell>
      <Link to="/sitter/inbox" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />Back to inbox
      </Link>

      {/* Header */}
      {(() => {
        const byDate = new Map<string, GroupBooking[]>();
        for (const b of bookings) {
          const key = b.requested_date ?? "tbd";
          if (!byDate.has(key)) byDate.set(key, []);
          byDate.get(key)!.push(b);
        }
        const dateKeys = Array.from(byDate.keys()).sort();
        const totalVisits = bookings.length;
        const uniquePets = new Set(bookings.map((b) => b.pet_id)).size;

        return (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl text-primary">
                  {service?.name ?? "Service"} for {customerName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {uniquePets} pet{uniquePets === 1 ? "" : "s"} · {totalVisits} visit{totalVisits === 1 ? "" : "s"} across {dateKeys.length} day{dateKeys.length === 1 ? "" : "s"}
                  {first?.requested_window_label ? ` · ${first.requested_window_label}` : ""}
                </p>
              </div>
              <Button variant="outline" onClick={() => setAddPetOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />Add pet to booking
              </Button>
            </div>

            {first && (
              <AddPetToBookingDialog
                open={addPetOpen}
                onOpenChange={setAddPetOpen}
                bookingId={first.id}
                customerId={first.customer_id}
                onAdded={reload}
              />
            )}

            {dateKeys.map((dateKey) => {
              const dayBookings = byDate.get(dateKey)!;
              const dateLabel = dateKey === "tbd"
                ? "Date to be confirmed"
                : format(new Date(`${dateKey}T12:00:00`), "EEEE, MMMM d, yyyy");
              return (
                <div key={dateKey} className="mb-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <h2 className="font-display text-lg text-primary">{dateLabel}</h2>
                    <Badge variant="outline" className="text-[10px]">
                      {dayBookings.length} pet{dayBookings.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {dayBookings.map((b) => {
                      const i = bookings.findIndex((x) => x.id === b.id);
                      const line = totals.lines[i];
                      return (
                        <Card key={b.id} className="border border-border p-4 shadow-soft">
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={b.pets?.photo_url ?? undefined} />
                              <AvatarFallback><PawPrint className="h-5 w-5" /></AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">{b.pets?.name ?? "Pet"}</div>
                              <div className="text-xs text-muted-foreground capitalize">{b.pets?.species ?? "dog"}</div>
                            </div>
                            {b.bundle_position === 0 && (
                              <Badge variant="outline" className="text-[10px]">Primary</Badge>
                            )}
                            {b.bundle_position > 0 && (b.service_variants?.sibling_discount_percent ?? 0) > 0 && (
                              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px]">
                                {b.service_variants?.sibling_discount_percent}% sibling discount
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div>
                              <Label className="text-[11px] uppercase">Price ($)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={prices[b.id] ?? ""}
                                onChange={(e) => setPrices((prev) => ({ ...prev, [b.id]: e.target.value }))}
                              />
                            </div>
                            {line && line.discountCents > 0 && (
                              <div className="text-xs text-emerald-700">
                                Sibling discount: -{formatCents(line.discountCents)} → {formatCents(line.finalCents)}
                              </div>
                            )}
                            {line && line.discountCents === 0 && (
                              <div className="text-xs text-muted-foreground">
                                Subtotal: {formatCents(line.baseCents)}
                              </div>
                            )}
                          </div>

                          {b.notes && (
                            <div className="mt-3 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                              {b.notes}
                            </div>
                          )}

                          <div className="mt-2">
                            <Link to={`/sitter/pets/${b.pets?.id}`} className="text-xs text-primary hover:underline">
                              View pet profile →
                            </Link>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        );
      })()}

      {/* Pricing summary */}
      <Card className="mt-4 border border-border p-5 shadow-soft">
        <h3 className="mb-3 font-display text-lg text-primary">Invoice preview</h3>
        <div className="space-y-2 text-sm">
          {totals.lines.map((line) => (
            <div key={line.bookingId} className="flex items-center justify-between">
              <span>
                {service?.name} — {line.petName}
                {line.discountCents > 0 && (
                  <span className="ml-2 text-xs text-emerald-700">(sibling discount)</span>
                )}
              </span>
              <span className="font-display">
                {line.discountCents > 0 ? (
                  <>
                    <span className="line-through text-muted-foreground mr-2">{formatCents(line.baseCents)}</span>
                    {formatCents(line.finalCents)}
                  </>
                ) : (
                  formatCents(line.baseCents)
                )}
              </span>
            </div>
          ))}
          <Separator />
          {totals.totalDiscount > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Total sibling discount</span>
              <span className="font-display">-{formatCents(totals.totalDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-medium">
            <span>Total</span>
            <span className="font-display text-lg text-primary">{formatCents(totals.grandTotal)}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A draft invoice will be auto-created when you approve. You can edit it before sending.
        </p>
      </Card>

      {/* Internal notes */}
      <Card className="mt-4 border border-border p-5 shadow-soft">
        <Label className="text-xs uppercase">Internal notes (only you see this)</Label>
        <Textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Gate codes, special instructions, anything to remember..."
          rows={3}
          className="mt-1.5"
        />
      </Card>

      {/* Actions */}
      {allRequested && (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={handleApproveAll} disabled={!!working} className="flex-1 sm:flex-none">
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {working === "approve"
              ? "Approving…"
              : `Approve all ${bookings.length} pets`
            }
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // For decline, navigate to the first booking's individual request page
              // which has the full decline flow with reason categories
              navigate(`/sitter/requests/${first.id}`);
            }}
            disabled={!!working}
          >
            <XCircle className="mr-1.5 h-4 w-4" />Decline
          </Button>
        </div>
      )}

      {!allRequested && (
        <Card className="mt-4 border border-dashed border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            Some bookings in this group have already been processed. Use the individual booking pages to manage them.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {bookings.map((b) => (
              <Button key={b.id} variant="outline" size="sm" asChild>
                <Link to={`/sitter/requests/${b.id}`}>{b.pets?.name ?? "Pet"} ({b.status})</Link>
              </Button>
            ))}
          </div>
        </Card>
      )}
    </SitterShell>
  );
}
