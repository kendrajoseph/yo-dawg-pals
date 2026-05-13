import { useEffect, useState } from "react";
import { SettingsLayout } from "./SettingsLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

type SitterSettings = {
  tax_enabled: boolean;
  tax_rate_percent: number;
  tax_label: string;
  tax_registration_number: string | null;
  default_due_days: number;
  auto_invoice_on_confirm: boolean;
  business_name: string | null;
  business_email: string | null;
  business_phone: string | null;
  business_address: string | null;
  payment_instructions: string | null;
  invoice_footer: string | null;
};

type ReminderSettings = {
  auto_enabled: boolean;
  default_tone: "friendly" | "firm" | "final";
  cadence: { on_due?: boolean; before_due_days?: number[]; after_due_days?: number[] };
};

const DEFAULT_REMINDER: ReminderSettings = {
  auto_enabled: false,
  default_tone: "friendly",
  cadence: { on_due: true, before_due_days: [3], after_due_days: [3, 7] },
};

const DEFAULT_SETTINGS: SitterSettings = {
  tax_enabled: false,
  tax_rate_percent: 13,
  tax_label: "HST",
  tax_registration_number: null,
  default_due_days: 7,
  auto_invoice_on_confirm: true,
  business_name: null,
  business_email: null,
  business_phone: null,
  business_address: null,
  payment_instructions: null,
  invoice_footer: null,
};

export default function SettingsInvoicing() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SitterSettings>(DEFAULT_SETTINGS);
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const [s, r] = await Promise.all([
        supabase.from("sitter_settings").select("*").eq("sitter_id", user.id).maybeSingle(),
        supabase.from("reminder_settings").select("*").eq("sitter_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (s.data) setSettings({ ...DEFAULT_SETTINGS, ...(s.data as any) });
      if (r.data) setReminder({ ...DEFAULT_REMINDER, ...(r.data as any), cadence: { ...DEFAULT_REMINDER.cadence, ...((r.data as any).cadence ?? {}) } });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const update = <K extends keyof SitterSettings>(key: K, value: SitterSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const updateReminderCadence = (key: "on_due" | "before_due_days" | "after_due_days", value: any) =>
    setReminder((r) => ({ ...r, cadence: { ...r.cadence, [key]: value } }));

  const toggleDay = (kind: "before_due_days" | "after_due_days", day: number) => {
    const cur = (reminder.cadence[kind] ?? []) as number[];
    const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day].sort((a, b) => a - b);
    updateReminderCadence(kind, next);
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    const payload = { sitter_id: user.id, ...settings };
    const reminderPayload = { sitter_id: user.id, ...reminder };
    const [s, r] = await Promise.all([
      supabase.from("sitter_settings").upsert(payload, { onConflict: "sitter_id" }),
      supabase.from("reminder_settings").upsert(reminderPayload, { onConflict: "sitter_id" }),
    ]);
    setSaving(false);
    if (s.error || r.error) {
      toast({ title: "Couldn't save", description: (s.error?.message || r.error?.message) ?? "", variant: "destructive" });
      return;
    }
    toast({ title: "Settings saved" });
  };

  if (loading) {
    return (
      <SettingsLayout title="Invoicing" description="Defaults that apply when you create or send invoices.">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Invoicing" description="Defaults that apply when you create or send invoices.">
      <div className="space-y-4">
        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-1 font-display text-lg text-primary">Business details</h3>
          <p className="mb-4 text-xs text-muted-foreground">Shown on invoice PDFs and emails.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Business name</Label>
              <Input value={settings.business_name ?? ""} onChange={(e) => update("business_name", e.target.value)} placeholder="Yo Dawg Pet Care" />
            </div>
            <div>
              <Label>Business email</Label>
              <Input value={settings.business_email ?? ""} onChange={(e) => update("business_email", e.target.value)} placeholder="hello@yodawg.ca" />
            </div>
            <div>
              <Label>Business phone</Label>
              <Input value={settings.business_phone ?? ""} onChange={(e) => update("business_phone", e.target.value)} placeholder="(647) 555-0123" />
            </div>
            <div>
              <Label>Tax registration #</Label>
              <Input value={settings.tax_registration_number ?? ""} onChange={(e) => update("tax_registration_number", e.target.value)} placeholder="GST/HST # (optional)" />
            </div>
            <div className="sm:col-span-2">
              <Label>Business address</Label>
              <Textarea rows={3} value={settings.business_address ?? ""} onChange={(e) => update("business_address", e.target.value)} placeholder="Street, City, Province, Postal" />
            </div>
          </div>
        </Card>

        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-1 font-display text-lg text-primary">Defaults</h3>
          <p className="mb-4 text-xs text-muted-foreground">Used when you create or send a new invoice.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Default due (days from issue)</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={settings.default_due_days}
                onChange={(e) => update("default_due_days", Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={settings.auto_invoice_on_confirm}
                  onCheckedChange={(v) => update("auto_invoice_on_confirm", v)}
                />
                <span>Auto-create invoice when a booking is confirmed</span>
              </label>
            </div>
          </div>
        </Card>

        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-1 font-display text-lg text-primary">Tax</h3>
          <p className="mb-4 text-xs text-muted-foreground">Applied automatically to new invoices when enabled.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={settings.tax_enabled} onCheckedChange={(v) => update("tax_enabled", v)} />
                <span>Charge tax</span>
              </label>
            </div>
            <div>
              <Label>Tax label</Label>
              <Input value={settings.tax_label} onChange={(e) => update("tax_label", e.target.value)} placeholder="HST" />
            </div>
            <div>
              <Label>Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={settings.tax_rate_percent}
                onChange={(e) => update("tax_rate_percent", Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </Card>

        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-1 font-display text-lg text-primary">Payment instructions & footer</h3>
          <p className="mb-4 text-xs text-muted-foreground">Optional text shown at the bottom of invoices.</p>
          <div className="space-y-3">
            <div>
              <Label>How to pay</Label>
              <Textarea rows={3} value={settings.payment_instructions ?? ""} onChange={(e) => update("payment_instructions", e.target.value)} placeholder="e.g. Send e-transfer to hello@yodawg.ca — password: pups" />
            </div>
            <div>
              <Label>Invoice footer</Label>
              <Textarea rows={2} value={settings.invoice_footer ?? ""} onChange={(e) => update("invoice_footer", e.target.value)} placeholder="Thanks for trusting us with your pup!" />
            </div>
          </div>
        </Card>

        <Card className="border border-border p-5 shadow-soft">
          <h3 className="mb-1 font-display text-lg text-primary">Reminders</h3>
          <p className="mb-4 text-xs text-muted-foreground">Auto-send reminder emails for unpaid invoices.</p>

          <div className="mb-3 flex items-center gap-2 text-sm">
            <Switch checked={reminder.auto_enabled} onCheckedChange={(v) => setReminder((r) => ({ ...r, auto_enabled: v }))} />
            <span>Send reminders automatically on the cadence below</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Default tone</Label>
              <Select value={reminder.default_tone} onValueChange={(v: any) => setReminder((r) => ({ ...r, default_tone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly nudge</SelectItem>
                  <SelectItem value="firm">Firm reminder</SelectItem>
                  <SelectItem value="final">Final notice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={reminder.cadence.on_due === true}
                  onCheckedChange={(c) => updateReminderCadence("on_due", c === true)}
                />
                <span>Send on the due date</span>
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Days BEFORE due</Label>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 7, 14].map((d) => (
                  <label key={d} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${(reminder.cadence.before_due_days ?? []).includes(d) ? "border-primary bg-primary/10" : "border-border bg-muted/40"}`}>
                    <Checkbox
                      checked={(reminder.cadence.before_due_days ?? []).includes(d)}
                      onCheckedChange={() => toggleDay("before_due_days", d)}
                    />
                    {d}d
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Days AFTER due</Label>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 7, 14, 30].map((d) => (
                  <label key={d} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${(reminder.cadence.after_due_days ?? []).includes(d) ? "border-primary bg-primary/10" : "border-border bg-muted/40"}`}>
                    <Checkbox
                      checked={(reminder.cadence.after_due_days ?? []).includes(d)}
                      onCheckedChange={() => toggleDay("after_due_days", d)}
                    />
                    {d}d
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="lg">
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </SettingsLayout>
  );
}
