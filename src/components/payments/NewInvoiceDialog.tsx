import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { InvoiceLineItemsEditor, type DraftLineItem } from "./InvoiceLineItemsEditor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type Client = { id: string; full_name: string | null; phone: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (invoiceId: string) => void;
};

export function NewInvoiceDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [items, setItems] = useState<DraftLineItem[]>([{ label: "", quantity: 1, unit_price_cents: 0, kind: "service" }]);
  const [defaultDueDays, setDefaultDueDays] = useState(7);
  const [dueDate, setDueDate] = useState<string>("");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxLabel, setTaxLabel] = useState("HST");
  const [taxRate, setTaxRate] = useState<number>(13);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);

  // Load clients + sitter settings on open
  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    (async () => {
      const [bRes, mRes, sRes] = await Promise.all([
        supabase.from("bookings").select("customer_id").eq("sitter_id", user.id),
        supabase.from("profiles").select("id").eq("created_by_sitter_id", user.id),
        supabase.from("sitter_settings").select("default_due_days, tax_enabled, tax_label, tax_rate_percent").eq("sitter_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;

      const ids = new Set<string>();
      for (const b of bRes.data ?? []) ids.add((b as any).customer_id);
      for (const m of mRes.data ?? []) ids.add((m as any).id);

      const list: Client[] = [];
      if (ids.size > 0) {
        const { data } = await supabase.from("profiles").select("id, full_name, phone").in("id", [...ids]);
        for (const p of data ?? []) list.push(p as any);
      }
      list.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
      setClients(list);

      const ss = sRes.data as any;
      const days = ss?.default_due_days ?? 7;
      setDefaultDueDays(days);
      setDueDate(format(addDays(new Date(), days), "yyyy-MM-dd"));
      if (ss?.tax_enabled) {
        setTaxEnabled(true);
        setTaxLabel(ss.tax_label ?? "HST");
        setTaxRate(Number(ss.tax_rate_percent ?? 13));
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setSelected(null);
    setSearch("");
    setItems([{ label: "", quantity: 1, unit_price_cents: 0, kind: "service" }]);
    setNotes("");
    setBusy(null);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) => (c.full_name ?? "").toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q));
  }, [clients, search]);

  const subtotal = items.reduce((s, li) => s + Math.round(li.unit_price_cents * (li.quantity || 0)), 0);
  const taxAmount = taxEnabled ? Math.round((subtotal * taxRate) / 100) : 0;
  const total = subtotal + taxAmount;

  const submit = async (sendNow: boolean) => {
    if (!user?.id) return;
    if (!selected) {
      toast({ title: "Pick a client", variant: "destructive" });
      return;
    }
    if (items.length === 0 || items.some((li) => !li.label.trim())) {
      toast({ title: "Add at least one labeled line item", variant: "destructive" });
      return;
    }
    setBusy(sendNow ? "send" : "draft");
    try {
      // Create invoice
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert({
          sitter_id: user.id,
          customer_id: selected.id,
          status: "draft",
          subtotal_cents: subtotal,
          total_cents: total,
          tax_cents: taxAmount,
          tax_label: taxEnabled ? taxLabel : null,
          tax_rate_percent: taxEnabled ? taxRate : null,
          due_date: dueDate || null,
          notes: notes.trim() || null,
        } as any)
        .select("id")
        .single();
      if (invErr) throw invErr;

      const invoiceId = (inv as any).id as string;

      // Insert line items
      const linePayload = items.map((li, i) => ({
        invoice_id: invoiceId,
        label: li.label,
        quantity: li.quantity,
        unit_price_cents: li.unit_price_cents,
        total_cents: Math.round(li.unit_price_cents * (li.quantity || 0)),
        kind: li.kind,
        sort_order: i,
      }));
      if (taxEnabled && taxAmount > 0) {
        linePayload.push({
          invoice_id: invoiceId,
          label: `${taxLabel} (${taxRate}%)`,
          quantity: 1,
          unit_price_cents: taxAmount,
          total_cents: taxAmount,
          kind: "tax",
          sort_order: items.length,
        });
      }
      const { error: liErr } = await supabase.from("invoice_line_items").insert(linePayload as any);
      if (liErr) throw liErr;

      if (sendNow) {
        const { data, error } = await supabase.functions.invoke("send-invoice-email", { body: { invoiceId } });
        if (error) throw new Error(error.message);
        if ((data as any)?.error) throw new Error((data as any).error);
      }

      toast({ title: sendNow ? "Invoice sent" : "Draft saved" });
      onCreated(invoiceId);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Couldn't create invoice", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase text-primary">New invoice</DialogTitle>
          <DialogDescription>Bill any client — booking optional. Saved as draft until you send.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client picker */}
          <div>
            <Label>Client</Label>
            {selected ? (
              <Card className="mt-1 flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">{selected.full_name ?? "Unnamed"}</div>
                  <div className="text-xs text-muted-foreground">{selected.phone ?? "No phone on file"}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Change</Button>
              </Card>
            ) : (
              <>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" className="pl-8" />
                </div>
                <ul className="mt-2 max-h-44 divide-y divide-border overflow-y-auto rounded-md border border-border">
                  {filtered.length === 0 ? (
                    <li className="p-3 text-xs text-muted-foreground">No matching clients.</li>
                  ) : (
                    filtered.slice(0, 50).map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => setSelected(c)}
                        >
                          <span className="font-medium">{c.full_name ?? "Unnamed"}</span>
                          <span className="text-xs text-muted-foreground">{c.phone ?? ""}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </div>

          {/* Line items */}
          <div>
            <Label>Line items</Label>
            <div className="mt-1">
              <InvoiceLineItemsEditor items={items} onChange={setItems} />
            </div>
          </div>

          {/* Tax / due / notes */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <div className="mt-1 text-[11px] text-muted-foreground">Default {defaultDueDays} days from today</div>
            </div>
            <div>
              <Label>Tax</Label>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={taxEnabled}
                  onChange={(e) => setTaxEnabled(e.target.checked)}
                />
                <Input
                  className="h-9 w-20"
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  disabled={!taxEnabled}
                />
                <Input
                  className="h-9 w-20"
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                  disabled={!taxEnabled}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <Label>Total</Label>
              <div className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-right font-display text-lg">
                ${(total / 100).toFixed(2)}
              </div>
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible to client on the invoice" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!busy}>Cancel</Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={!!busy}>{busy === "draft" ? "Saving…" : "Save draft"}</Button>
          <Button onClick={() => submit(true)} disabled={!!busy}>{busy === "send" ? "Sending…" : "Save & send"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
