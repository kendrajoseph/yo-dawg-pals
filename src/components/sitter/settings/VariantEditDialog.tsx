import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type VariantRow = {
  id: string;
  service_id: string;
  slug: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  payment_mode: string;
  unit_label: string | null;
  sort_order: number;
  is_active: boolean;
};

const PAYMENT_MODES = [
  { value: "full", label: "Full upfront payment" },
  { value: "deposit", label: "Deposit only" },
  { value: "free", label: "Free (no payment)" },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function VariantEditDialog({
  variant,
  serviceId,
  serviceSlug,
  defaultSortOrder,
  open,
  onOpenChange,
  onSaved,
}: {
  variant: VariantRow | null;
  serviceId: string;
  serviceSlug: string;
  defaultSortOrder: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const isNew = !variant;
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [priceDollars, setPriceDollars] = useState("0.00");
  const [paymentMode, setPaymentMode] = useState("full");
  const [unitLabel, setUnitLabel] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (variant) {
        setName(variant.name);
        setDuration(String(variant.duration_minutes));
        setPriceDollars((variant.price_cents / 100).toFixed(2));
        setPaymentMode(variant.payment_mode);
        setUnitLabel(variant.unit_label ?? "");
        setIsActive(variant.is_active);
      } else {
        setName("");
        setDuration("30");
        setPriceDollars("0.00");
        setPaymentMode("full");
        setUnitLabel("");
        setIsActive(true);
      }
    }
  }, [variant, open]);

  const save = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const dur = parseInt(duration, 10);
    if (!Number.isFinite(dur) || dur <= 0) {
      toast({ title: "Duration must be a positive number of minutes", variant: "destructive" });
      return;
    }
    const dollars = parseFloat(priceDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      toast({ title: "Price must be 0 or more", variant: "destructive" });
      return;
    }
    const cents = Math.round(dollars * 100);

    setSaving(true);
    if (isNew) {
      // Generate a unique slug
      const baseSlug = `${serviceSlug}-${slugify(name)}` || `${serviceSlug}-variant`;
      let slug = baseSlug;
      let i = 2;
      // Try a few suffixes if the slug exists
      while (true) {
        const { data: existing } = await supabase.from("service_variants").select("id").eq("slug", slug).maybeSingle();
        if (!existing) break;
        slug = `${baseSlug}-${i++}`;
        if (i > 50) break;
      }
      const { error } = await supabase.from("service_variants").insert({
        service_id: serviceId,
        slug,
        name: name.trim(),
        duration_minutes: dur,
        price_cents: cents,
        payment_mode: paymentMode,
        unit_label: unitLabel.trim() || null,
        is_active: isActive,
        sort_order: defaultSortOrder,
      });
      setSaving(false);
      if (error) {
        toast({ title: "Couldn't add option", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Pricing option added" });
    } else {
      const { error } = await supabase
        .from("service_variants")
        .update({
          name: name.trim(),
          duration_minutes: dur,
          price_cents: cents,
          payment_mode: paymentMode,
          unit_label: unitLabel.trim() || null,
          is_active: isActive,
        })
        .eq("id", variant!.id);
      setSaving(false);
      if (error) {
        toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Pricing option updated" });
    }
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add pricing option" : "Edit pricing option"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solo Walk · 45 min" maxLength={80} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Duration (minutes)</Label>
              <Input type="number" min={1} step={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div>
              <Label>Price (USD)</Label>
              <Input type="number" min={0} step="0.01" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Payment mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unit label (optional)</Label>
            <Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="e.g. per night, per visit" maxLength={40} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Inactive options are hidden from the booking page.</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : isNew ? "Add option" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
