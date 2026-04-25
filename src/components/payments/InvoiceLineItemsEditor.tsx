import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/lib/invoices";

export type DraftLineItem = {
  label: string;
  quantity: number;
  unit_price_cents: number;
  kind: "service" | "extra_time" | "late_fee" | "discount" | "custom" | "tip" | "tax";
};

type Props = {
  items: DraftLineItem[];
  onChange: (items: DraftLineItem[]) => void;
};

export function InvoiceLineItemsEditor({ items, onChange }: Props) {
  const update = (i: number, patch: Partial<DraftLineItem>) => {
    const copy = [...items];
    copy[i] = { ...copy[i], ...patch };
    onChange(copy);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([...items, { label: "", quantity: 1, unit_price_cents: 0, kind: "custom" }]);

  const subtotal = items.reduce((s, li) => s + Math.round(li.unit_price_cents * (li.quantity || 0)), 0);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.map((li, i) => (
          <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-md border border-border bg-muted/40 p-2">
            <div className="col-span-12 md:col-span-5">
              <Label className="text-[11px] uppercase">Label</Label>
              <Input value={li.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Service, fee, discount…" />
            </div>
            <div className="col-span-3 md:col-span-2">
              <Label className="text-[11px] uppercase">Qty</Label>
              <Input type="number" step="1" min="0" value={li.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })} />
            </div>
            <div className="col-span-4 md:col-span-2">
              <Label className="text-[11px] uppercase">Unit ($)</Label>
              <Input type="number" step="0.01" value={(li.unit_price_cents / 100).toString()} onChange={(e) => update(i, { unit_price_cents: Math.round((Number(e.target.value) || 0) * 100) })} />
            </div>
            <div className="col-span-4 md:col-span-2">
              <Label className="text-[11px] uppercase">Kind</Label>
              <Select value={li.kind} onValueChange={(v: any) => update(i, { kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="extra_time">Extra time</SelectItem>
                  <SelectItem value="late_fee">Late fee</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                  <SelectItem value="tip">Tip</SelectItem>
                  <SelectItem value="tax">Tax</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 flex items-end justify-end">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="col-span-12 text-right text-xs text-muted-foreground">
              Line total: {formatCents(Math.round(li.unit_price_cents * (li.quantity || 0)))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4" /> Add line
        </Button>
        <div className="text-sm font-display uppercase">Subtotal: {formatCents(subtotal)}</div>
      </div>
    </div>
  );
}
