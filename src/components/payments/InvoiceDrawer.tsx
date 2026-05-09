import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Copy, FileText, Send, Wallet } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  derivedStatus,
  formatCents,
  statusBadgeClass,
  type Invoice,
  type InvoiceLineItem,
} from "@/lib/invoices";
import { InvoiceLineItemsEditor, type DraftLineItem } from "./InvoiceLineItemsEditor";
import { RecipientCard } from "./RecipientCard";

const PUBLIC_BASE = typeof window !== "undefined" ? window.location.origin : "https://yodawg.ca";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  customerName?: string;
  onChanged: () => void;
};

export function InvoiceDrawer({ open, onOpenChange, invoiceId, customerName, onChanged }: Props) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [draftItems, setDraftItems] = useState<DraftLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

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
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sort_order");
      const li = (items as InvoiceLineItem[]) ?? [];
      setLineItems(li);
      setDraftItems(li.map((x) => ({ label: x.label, quantity: Number(x.quantity), unit_price_cents: x.unit_price_cents, kind: x.kind })));
    } finally {
      setLoading(false);
    }
  };

  if (!invoiceId) return null;

  const status = invoice ? derivedStatus(invoice) : "draft";
  const isDraft = invoice?.status === "draft";
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
    } finally {
      setBusy(null);
    }
  };

  const sendOnly = async () => {
    if (!invoice) return;
    setBusy("send");
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice-email", { body: { invoiceId: invoice.id } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Invoice sent" });
      await load();
      onChanged();
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    if (!payUrl) return;
    await navigator.clipboard.writeText(payUrl);
    toast({ title: "Pay link copied" });
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
              {owed > 0 && !isDraft && (
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Owed</span>
                  <span>{formatCents(owed)}</span>
                </div>
              )}
            </Card>

            {payUrl && !isDraft && (
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
                    <Send className="h-4 w-4" /> {busy === "send" ? "Sending…" : "Save and send to client"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={sendOnly} disabled={!!busy}>
                    <Send className="h-4 w-4" /> {busy === "send" ? "Sending…" : "Resend to client"}
                  </Button>
                  {payUrl && (
                    <Button variant="outline" asChild>
                      <a href={payUrl} target="_blank" rel="noreferrer">
                        <Wallet className="h-4 w-4" /> Open public invoice
                      </a>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
