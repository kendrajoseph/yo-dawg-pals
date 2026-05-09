import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Copy,
  CreditCard,
  FileText,
  Receipt,
  RefreshCcw,
  Send,
  Undo2,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  derivedStatus,
  formatCents,
  statusBadgeClass,
  type Invoice,
  type InvoiceLineItem,
  type PaymentEvent,
} from "@/lib/invoices";
import { InvoiceLineItemsEditor, type DraftLineItem } from "./InvoiceLineItemsEditor";
import { MarkPaidDialog } from "./MarkPaidDialog";
import { RefundDialog } from "./RefundDialog";
import { SendReminderDialog } from "./SendReminderDialog";
import { RecipientCard } from "./RecipientCard";

export type PaymentDrawerBooking = {
  id: string;
  customer_id: string;
  total_cents: number | null;
  payment_amount_cents: number | null;
  payment_status: string | null;
  paid_at: string | null;
  start_at: string;
  end_at: string;
  refund_id: string | null;
  stripe_payment_intent: string | null;
  stripe_charge_id: string | null;
  service_label: string;
  customer_name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: PaymentDrawerBooking | null;
  hasSavedCard: boolean;
  cardLast4?: string | null;
  cardBrand?: string | null;
  onChanged: () => void;
};

const PUBLIC_BASE = typeof window !== "undefined" ? window.location.origin : "https://yodawg.ca";

export function PaymentDrawer({ open, onOpenChange, booking, hasSavedCard, cardLast4, cardBrand, onChanged }: Props) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [draftItems, setDraftItems] = useState<DraftLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  useEffect(() => {
    if (!open || !booking) return;
    void loadInvoice();
  }, [open, booking?.id]);

  const loadInvoice = async () => {
    if (!booking) return;
    setLoading(true);
    try {
      const { data: inv } = await supabase
        .from("invoices")
        .select("*")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setInvoice((inv as Invoice) ?? null);

      if (inv) {
        const { data: items } = await supabase
          .from("invoice_line_items")
          .select("*")
          .eq("invoice_id", (inv as any).id)
          .order("sort_order");
        setLineItems((items as InvoiceLineItem[]) ?? []);
        setDraftItems(
          ((items as InvoiceLineItem[]) ?? []).map((li) => ({
            label: li.label,
            quantity: Number(li.quantity),
            unit_price_cents: li.unit_price_cents,
            kind: li.kind,
          })),
        );
      } else {
        setLineItems([]);
        setDraftItems([
          { label: booking.service_label, quantity: 1, unit_price_cents: booking.total_cents ?? 0, kind: "service" },
        ]);
      }

      const { data: evts } = await supabase
        .from("payment_events")
        .select("*")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setEvents((evts as PaymentEvent[]) ?? []);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const invoke = async (fn: string, body: any, label: string) => {
    setActionBusy(label);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw new Error(error.message || `${fn} failed`);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    } finally {
      setActionBusy(null);
    }
  };

  if (!booking) return null;

  const total = invoice?.total_cents ?? booking.total_cents ?? 0;
  const paid = invoice?.amount_paid_cents ?? booking.payment_amount_cents ?? 0;
  const owed = Math.max(0, total - paid);
  const status = invoice ? derivedStatus(invoice) : (booking.payment_status ?? (booking.paid_at ? "paid" : "outstanding"));
  const refunded = !!booking.refund_id;
  // An invoice is "frozen" once it's been voided / fully refunded / the booking
  // itself is cancelled. We hide outbound actions (send, charge, reminders)
  // so the sitter can't accidentally bill a client whose service was cancelled.
  const invoiceVoided = invoice?.status === "void";
  const bookingCancelled = booking.payment_status === "refunded" || (refunded && owed === 0);
  const frozen = invoiceVoided || bookingCancelled;
  const payUrl = invoice ? `${PUBLIC_BASE}/pay/${invoice.public_token}` : null;

  // Actions

  const createOrUpdateInvoice = async (sendEmail: boolean) => {
    if (draftItems.length === 0 || draftItems.some((li) => !li.label.trim())) {
      toast({ title: "Add at least one labeled line item", variant: "destructive" });
      return;
    }
    if (invoice) {
      // Replace items
      setActionBusy("save");
      try {
        await supabase.from("invoice_line_items").delete().eq("invoice_id", invoice.id);
        const subtotal = draftItems.reduce((s, li) => s + Math.round(li.unit_price_cents * (li.quantity || 0)), 0);
        await supabase.from("invoice_line_items").insert(
          draftItems.map((li, i) => ({
            invoice_id: invoice.id,
            label: li.label,
            quantity: li.quantity,
            unit_price_cents: li.unit_price_cents,
            total_cents: Math.round(li.unit_price_cents * (li.quantity || 0)),
            kind: li.kind,
            sort_order: i,
          })) as any,
        );
        await supabase.from("invoices").update({ subtotal_cents: subtotal, total_cents: subtotal }).eq("id", invoice.id);
        if (sendEmail) {
          await invoke("send-invoice-email", { invoiceId: invoice.id }, "send");
        }
        toast({ title: sendEmail ? "Invoice updated & sent" : "Invoice saved" });
      } catch (e: any) {
        toast({ title: "Save failed", description: e.message, variant: "destructive" });
      } finally {
        setActionBusy(null);
        await loadInvoice();
        onChanged();
      }
      return;
    }
    try {
      const result: any = await invoke(
        "create-invoice",
        {
          bookingId: booking.id,
          lineItems: draftItems,
          sendEmail,
        },
        sendEmail ? "send" : "save",
      );
      if (sendEmail && result?.emailError) {
        toast({ title: "Invoice created — email failed", description: result.emailError, variant: "destructive" });
      } else {
        toast({ title: sendEmail ? "Invoice created & sent" : "Invoice created" });
      }
      await loadInvoice();
      onChanged();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const sendInvoice = async () => {
    if (!invoice) return createOrUpdateInvoice(true);
    try {
      await invoke("send-invoice-email", { invoiceId: invoice.id }, "send");
      toast({ title: "Invoice sent" });
      await loadInvoice();
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    }
  };

  const sendReceipt = async () => {
    try {
      await invoke("send-payment-receipt", { bookingId: booking.id }, "receipt");
      toast({ title: "Receipt sent" });
      await loadInvoice();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const sendReminder = async (data: { tone: "friendly" | "firm" | "final"; channel: "email" | "sms" | "both" }) => {
    if (!invoice) {
      toast({ title: "Create an invoice first", variant: "destructive" });
      return;
    }
    try {
      await invoke("send-payment-reminder", { invoiceId: invoice.id, ...data }, "remind");
      toast({ title: "Reminder sent" });
      await loadInvoice();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const charge = async () => {
    try {
      await invoke("charge-saved-card", { bookingId: booking.id, environment: "sandbox" }, "charge");
      toast({ title: "Card charged" });
      await loadInvoice();
      onChanged();
    } catch (e: any) {
      toast({ title: "Charge failed", description: e.message, variant: "destructive" });
    }
  };

  const refund = async (data: { amountCents: number; reason: string; notify: boolean }) => {
    try {
      await invoke("refund-payment", { bookingId: booking.id, ...data }, "refund");
      toast({ title: "Refund issued" });
      await loadInvoice();
      onChanged();
    } catch (e: any) {
      toast({ title: "Refund failed", description: e.message, variant: "destructive" });
    }
  };

  const markPaid = async (data: { amountCents: number; method: string; reference: string }) => {
    setActionBusy("manualpaid");
    try {
      const newPaid = paid + data.amountCents;
      const fullyPaid = newPaid >= total;
      await supabase.from("bookings").update({
        payment_amount_cents: newPaid,
        payment_status: fullyPaid ? "paid" : "partial",
        paid_at: fullyPaid ? new Date().toISOString() : null,
      }).eq("id", booking.id);

      if (invoice) {
        await supabase.from("invoices").update({
          amount_paid_cents: newPaid,
          status: fullyPaid ? "paid" : "partial",
          paid_at: fullyPaid ? new Date().toISOString() : null,
        }).eq("id", invoice.id);
      }

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("payment_events").insert({
        booking_id: booking.id,
        invoice_id: invoice?.id ?? null,
        kind: "manual_paid",
        channel: data.method,
        amount_cents: data.amountCents,
        created_by: user?.id ?? null,
        metadata: { reference: data.reference },
      });

      toast({ title: "Marked paid" });
      await loadInvoice();
      onChanged();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setActionBusy(null);
    }
  };

  const copyPayLink = async () => {
    if (!payUrl) return;
    await navigator.clipboard.writeText(payUrl);
    toast({ title: "Payment link copied" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-display uppercase text-primary">
            {booking.customer_name} · {booking.service_label}
          </SheetTitle>
          <SheetDescription>{format(new Date(booking.start_at), "EEE, MMM d · p")}</SheetDescription>
        </SheetHeader>

        {/* Summary */}
        <Card className="mt-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase text-muted-foreground">Status</div>
              <span className={cn("inline-block rounded border px-2 py-0.5 text-[11px] font-display uppercase", statusBadgeClass(invoiceVoided ? "void" : refunded ? "refunded" : status))}>
                {invoiceVoided ? "cancelled" : refunded ? "refunded" : status}
              </span>
              {invoice?.invoice_number && (
                <div className="mt-1 text-xs text-muted-foreground">{invoice.invoice_number}</div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-right">
              <Stat label="Total" value={formatCents(total)} />
              <Stat label="Paid" value={formatCents(paid)} />
              <Stat label="Outstanding" value={formatCents(owed)} highlight={owed > 0 && !frozen} />
            </div>
          </div>
          <Separator className="my-3" />
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            {hasSavedCard ? <span>{cardBrand ?? "Card"} ending in {cardLast4 ?? "••••"}</span> : <span>No card on file</span>}
            {invoice?.due_date && <span>· Due {format(new Date(invoice.due_date + "T12:00:00"), "MMM d, yyyy")}</span>}
            {booking.stripe_payment_intent && <span>· {booking.stripe_payment_intent.slice(0, 18)}…</span>}
          </div>
          {frozen && (
            <div className="mt-3 rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              This invoice is cancelled because the booking was {refunded ? "refunded" : "cancelled"}. You can still view its history, but you can't send, charge, or remind on it.
            </div>
          )}
        </Card>

        {invoice && (
          <div className="mt-4">
            <RecipientCard invoiceId={invoice.id} fallbackName={booking.customer_name} />
          </div>
        )}

        {/* Draft warning */}
        {invoice?.status === "draft" && !frozen && (
          <div className="mt-4 rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            This invoice is a <strong>draft</strong> — your client hasn't received it yet. Click <strong>Send invoice</strong> below to email it.
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {!frozen && (
            <>
              <Button size="sm" variant={invoice?.status === "draft" ? "default" : "outline"} onClick={sendInvoice} disabled={!!actionBusy}>
                <FileText className="h-4 w-4" /> {invoice?.sent_at ? "Resend invoice" : "Send invoice"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReminderOpen(true)} disabled={!!actionBusy || !invoice}>
                <Bell className="h-4 w-4" /> Reminder
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={sendReceipt} disabled={!!actionBusy || paid === 0}>
            <Receipt className="h-4 w-4" /> Receipt
          </Button>
          {!frozen && hasSavedCard && owed > 0 && (
            <Button size="sm" onClick={charge} disabled={!!actionBusy}>
              <Wallet className="h-4 w-4" /> Charge {formatCents(owed)}
            </Button>
          )}
          {paid > 0 && !refunded && (
            <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)} disabled={!!actionBusy}>
              <Undo2 className="h-4 w-4" /> Refund
            </Button>
          )}
          {!frozen && (
            <Button size="sm" variant="outline" onClick={() => setMarkPaidOpen(true)} disabled={!!actionBusy || owed === 0}>
              <CreditCard className="h-4 w-4" /> Mark paid
            </Button>
          )}
          {payUrl && !frozen && (
            <Button size="sm" variant="ghost" onClick={copyPayLink}>
              <Copy className="h-4 w-4" /> Copy pay link
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={loadInvoice} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Line items editor */}
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm uppercase text-primary">Line items</h3>
          <InvoiceLineItemsEditor items={draftItems} onChange={setDraftItems} />
          {!frozen && (
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => createOrUpdateInvoice(false)} disabled={!!actionBusy}>
                {invoice ? "Save changes" : "Create draft"}
              </Button>
              <Button size="sm" onClick={() => createOrUpdateInvoice(true)} disabled={!!actionBusy}>
                <Send className="h-4 w-4" /> {invoice ? "Save and send to client" : "Create and send to client"}
              </Button>
            </div>
          )}
        </Card>

        {/* Timeline */}
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm uppercase text-primary">Activity</h3>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {events.map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                  <div>
                    <span className="font-display text-xs uppercase text-primary">{ev.kind.replace(/_/g, " ")}</span>
                    {ev.channel && <span className="ml-2 text-[11px] uppercase text-muted-foreground">via {ev.channel}</span>}
                    {ev.amount_cents != null && <span className="ml-2 text-xs">{formatCents(ev.amount_cents)}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{format(new Date(ev.created_at), "MMM d, p")}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <MarkPaidDialog
          open={markPaidOpen}
          onOpenChange={setMarkPaidOpen}
          defaultAmountCents={owed}
          onSubmit={markPaid}
        />
        <RefundDialog
          open={refundOpen}
          onOpenChange={setRefundOpen}
          maxRefundCents={paid}
          onSubmit={refund}
        />
        <SendReminderDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          onSubmit={sendReminder}
        />
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className={cn("font-display text-base", highlight ? "text-clay" : "text-primary")}>{value}</div>
    </div>
  );
}
