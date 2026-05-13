import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Bell, Copy, Download, FileText, FilePlus2, Send, Wallet, XCircle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  derivedStatus,
  formatCents,
  statusBadgeClass,
  type Invoice,
  type InvoiceLineItem,
  type PaymentEvent,
} from "@/lib/invoices";
import { InvoiceLineItemsEditor, type DraftLineItem } from "./InvoiceLineItemsEditor";
import { RecipientCard } from "./RecipientCard";
import { MarkPaidDialog } from "./MarkPaidDialog";
import { SendReminderDialog } from "./SendReminderDialog";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";

const PUBLIC_BASE = typeof window !== "undefined" ? window.location.origin : "https://yodawg.ca";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  customerName?: string;
  onChanged: () => void;
};

export function InvoiceDrawer({ open, onOpenChange, invoiceId, customerName, onChanged }: Props) {
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [draftItems, setDraftItems] = useState<DraftLineItem[]>([]);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  useEffect(() => {
    if (!open || !invoiceId) return;
    void load();
  }, [open, invoiceId]);

  const load = async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const { data: inv } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
      setInvoice((inv as Invoice) ?? null);
      const { data: items } = await supabase
        .from("invoice_line_items").select("*").eq("invoice_id", invoiceId).order("sort_order");
      const li = (items as InvoiceLineItem[]) ?? [];
      setLineItems(li);
      setDraftItems(li.map((x) => ({ label: x.label, quantity: Number(x.quantity), unit_price_cents: x.unit_price_cents, kind: x.kind })));
      const { data: evts } = await supabase
        .from("payment_events").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false }).limit(50);
      setEvents((evts as PaymentEvent[]) ?? []);
    } finally { setLoading(false); }
  };

  if (!invoiceId) return null;

  const status = invoice ? derivedStatus(invoice) : "draft";
  const isDraft = invoice?.status === "draft";
  const isVoid = invoice?.status === "void";
  const editable = isDraft;
  const total = invoice?.total_cents ?? 0;
  const paid = invoice?.amount_paid_cents ?? 0;
  const owed = Math.max(0, total - paid);
  const payUrl = invoice ? `${PUBLIC_BASE}/pay/${invoice.public_token}` : null;

  const save = async (sendEmail: boolean) => {
    if (!invoice) return;
    if (draftItems.length === 0 || draftItems.some((li) => !li.label.trim())) {
      toast({ title: "Add at least one labeled line item", variant: "destructive" });
      return;
    }
    setBusy(sendEmail ? "send" : "save");
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
        const { data, error } = await supabase.functions.invoke("send-invoice-email", { body: { invoiceId: invoice.id } });
        if (error) throw new Error(error.message);
        if ((data as any)?.error) throw new Error((data as any).error);
      }
      toast({ title: sendEmail ? "Invoice updated & sent" : "Invoice saved" });
      await load();
      onChanged();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const sendOnly = async () => {
    if (!invoice) return;
    setBusy("send");
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice-email", { body: { invoiceId: invoice.id } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Invoice sent" });
      await load(); onChanged();
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const copyLink = async () => {
    if (!payUrl) return;
    await navigator.clipboard.writeText(payUrl);
    toast({ title: "Pay link copied" });
  };

  const recordPayment = async ({ amountCents, method, reference }: { amountCents: number; method: string; reference: string }) => {
    if (!invoice || !user?.id) return;
    if (amountCents <= 0) { toast({ title: "Amount must be > 0", variant: "destructive" }); return; }
    try {
      const { error: peErr } = await supabase.from("payment_events").insert({
        invoice_id: invoice.id,
        kind: "payment_recorded",
        channel: method,
        amount_cents: amountCents,
        metadata: { reference, manual: true },
        created_by: user.id,
      } as any);
      if (peErr) throw peErr;

      const newPaid = (invoice.amount_paid_cents ?? 0) + amountCents;
      const fullyPaid = newPaid >= (invoice.total_cents ?? 0);
      const { error: upErr } = await supabase.from("invoices").update({
        amount_paid_cents: newPaid,
        status: fullyPaid ? "paid" : "partial",
        paid_at: fullyPaid ? new Date().toISOString() : invoice.paid_at,
      } as any).eq("id", invoice.id);
      if (upErr) throw upErr;
      toast({ title: fullyPaid ? "Marked paid" : "Partial payment recorded" });
      await load(); onChanged();
    } catch (e: any) {
      toast({ title: "Couldn't record payment", description: e?.message ?? "Try again.", variant: "destructive" });
    }
  };

  const sendReminder = async ({ tone, channel }: { tone: "friendly" | "firm" | "final"; channel: "email" | "sms" | "both" }) => {
    if (!invoice) return;
    setBusy("reminder");
    try {
      const { data, error } = await supabase.functions.invoke("send-payment-reminder", {
        body: { invoiceId: invoice.id, tone, channel: channel === "sms" ? "email" : channel === "both" ? "email_sms" : "email" },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Reminder sent" });
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't send reminder", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const duplicate = async () => {
    if (!invoice || !user?.id) return;
    setBusy("dup");
    try {
      const { data: newInv, error } = await supabase.from("invoices").insert({
        sitter_id: invoice.sitter_id,
        customer_id: invoice.customer_id,
        booking_id: null,
        status: "draft",
        subtotal_cents: invoice.subtotal_cents,
        total_cents: invoice.total_cents,
        notes: invoice.notes,
        due_date: invoice.due_date,
      } as any).select("id").single();
      if (error) throw error;
      const items = lineItems.map((li, i) => ({
        invoice_id: (newInv as any).id, label: li.label, quantity: li.quantity,
        unit_price_cents: li.unit_price_cents, total_cents: li.total_cents, kind: li.kind, sort_order: i,
      }));
      if (items.length) {
        const { error: liErr } = await supabase.from("invoice_line_items").insert(items as any);
        if (liErr) throw liErr;
      }
      toast({ title: "Duplicated as draft" });
      onChanged();
    } catch (e: any) {
      toast({ title: "Couldn't duplicate", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const voidInvoice = async () => {
    if (!invoice) return;
    setBusy("void");
    try {
      const { error } = await supabase.from("invoices").update({
        status: "void", voided_at: new Date().toISOString(),
      } as any).eq("id", invoice.id);
      if (error) throw error;
      toast({ title: "Invoice voided" });
      setVoidOpen(false);
      await load(); onChanged();
    } catch (e: any) {
      toast({ title: "Couldn't void", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const downloadPdf = async () => {
    if (!invoice || !user?.id) return;
    setBusy("pdf");
    try {
      const [settingsRes, recipRes] = await Promise.all([
        supabase.from("sitter_settings").select("business_name, business_email, business_phone, business_address, payment_instructions, invoice_footer").eq("sitter_id", user.id).maybeSingle(),
        supabase.functions.invoke("get-invoice-recipient", { body: { invoiceId: invoice.id } }),
      ]);
      const r: any = (recipRes as any).data ?? {};
      downloadInvoicePdf({
        invoice, lineItems,
        customerName: r.full_name ?? customerName ?? null,
        customerEmail: r.email ?? null,
        customerPhone: r.phone ?? null,
        business: {
          name: (settingsRes.data as any)?.business_name ?? null,
          email: (settingsRes.data as any)?.business_email ?? null,
          phone: (settingsRes.data as any)?.business_phone ?? null,
          address: (settingsRes.data as any)?.business_address ?? null,
          payment_instructions: (settingsRes.data as any)?.payment_instructions ?? null,
          invoice_footer: (settingsRes.data as any)?.invoice_footer ?? null,
        },
      });
    } catch (e: any) {
      toast({ title: "Couldn't generate PDF", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {invoice?.invoice_number ?? "Invoice"}
            <Badge variant="outline" className={statusBadgeClass(status)}>{status}</Badge>
          </SheetTitle>
          <SheetDescription>
            {customerName ?? "Customer"}
            {invoice?.due_date ? ` · due ${format(new Date(invoice.due_date), "MMM d, yyyy")}` : ""}
          </SheetDescription>
        </SheetHeader>

        {loading || !invoice ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4 py-4">
            {isDraft && (
              <Card className="border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                This invoice is a <strong>draft</strong> — your client hasn't received it yet.
              </Card>
            )}
            {isVoid && (
              <Card className="border-border bg-muted p-3 text-sm text-muted-foreground">
                This invoice is <strong>void</strong>. It's kept for your records but can't be paid or resent.
              </Card>
            )}

            <RecipientCard invoiceId={invoice.id} fallbackName={customerName} />

            <Card className="p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Line items</div>
              {editable ? (
                <InvoiceLineItemsEditor items={draftItems} onChange={setDraftItems} />
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {lineItems.map((li) => (
                    <li key={li.id} className="flex items-center justify-between py-2">
                      <div>
                        <div>{li.label}</div>
                        <div className="text-xs text-muted-foreground">{li.quantity} × {formatCents(li.unit_price_cents)}</div>
                      </div>
                      <div className="font-medium">{formatCents(li.total_cents)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display text-lg">{formatCents(total)}</span>
              </div>
              {paid > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span>{formatCents(paid)}</span>
                </div>
              )}
              {owed > 0 && !isDraft && !isVoid && (
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Owed</span>
                  <span>{formatCents(owed)}</span>
                </div>
              )}
            </Card>

            {events.length > 0 && (
              <Card className="p-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Payment history</div>
                <ul className="divide-y divide-border text-sm">
                  {events.map((e) => (
                    <li key={e.id} className="flex items-center justify-between py-2">
                      <div>
                        <div className="capitalize">{e.kind.replace(/_/g, " ")} {e.channel ? `· ${e.channel}` : ""}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(e.created_at), "MMM d, yyyy h:mm a")}</div>
                      </div>
                      <div className="font-medium">{e.amount_cents != null ? formatCents(e.amount_cents) : "—"}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {payUrl && !isDraft && !isVoid && (
              <Card className="p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <code className="truncate text-muted-foreground">{payUrl}</code>
                  <Button size="sm" variant="outline" onClick={copyLink}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </Card>
            )}

            <Separator />

            <div className="flex flex-wrap gap-2">
              {isDraft ? (
                <>
                  <Button variant="outline" onClick={() => save(false)} disabled={!!busy}>
                    {busy === "save" ? "Saving…" : "Save changes"}
                  </Button>
                  <Button onClick={() => save(true)} disabled={!!busy}>
                    <Send className="h-4 w-4" /> {busy === "send" ? "Sending…" : "Save and send"}
                  </Button>
                </>
              ) : !isVoid ? (
                <>
                  <Button variant="outline" onClick={sendOnly} disabled={!!busy}>
                    <Send className="h-4 w-4" /> {busy === "send" ? "Sending…" : "Resend"}
                  </Button>
                  {owed > 0 && (
                    <>
                      <Button variant="outline" onClick={() => setReminderOpen(true)} disabled={!!busy}>
                        <Bell className="h-4 w-4" /> {busy === "reminder" ? "Sending…" : "Reminder"}
                      </Button>
                      <Button variant="outline" onClick={() => setMarkPaidOpen(true)} disabled={!!busy}>
                        <Wallet className="h-4 w-4" /> Record payment
                      </Button>
                    </>
                  )}
                </>
              ) : null}
              <Button variant="outline" onClick={downloadPdf} disabled={!!busy}>
                <Download className="h-4 w-4" /> {busy === "pdf" ? "…" : "PDF"}
              </Button>
              <Button variant="outline" onClick={duplicate} disabled={!!busy}>
                <FilePlus2 className="h-4 w-4" /> {busy === "dup" ? "…" : "Duplicate"}
              </Button>
              {!isDraft && !isVoid && (
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setVoidOpen(true)} disabled={!!busy}>
                  <XCircle className="h-4 w-4" /> Void
                </Button>
              )}
            </div>
          </div>
        )}

        <MarkPaidDialog
          open={markPaidOpen}
          onOpenChange={setMarkPaidOpen}
          defaultAmountCents={owed}
          onSubmit={recordPayment}
        />
        <SendReminderDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          onSubmit={sendReminder}
        />
        <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Void {invoice?.invoice_number}?</AlertDialogTitle>
              <AlertDialogDescription>
                Voiding keeps the invoice for your records but marks it as cancelled. The pay link will no longer work and reminders won't be sent. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy === "void"}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); voidInvoice(); }} disabled={busy === "void"} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {busy === "void" ? "Voiding…" : "Void invoice"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
