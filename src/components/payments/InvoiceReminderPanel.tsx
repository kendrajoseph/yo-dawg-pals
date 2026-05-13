import { useEffect, useState } from "react";
import { Bell, Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_REMINDER_RULES, ReminderRule, describeRule } from "@/lib/sitterTemplates";

type Props = {
  invoiceId: string;
};

export function InvoiceReminderPanel({ invoiceId }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sitterEnabled, setSitterEnabled] = useState(true);
  const [sitterRules, setSitterRules] = useState<ReminderRule[]>(DEFAULT_REMINDER_RULES);
  const [overrideEnabled, setOverrideEnabled] = useState<boolean | null>(null);
  const [overrideRules, setOverrideRules] = useState<ReminderRule[] | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [draftRules, setDraftRules] = useState<ReminderRule[]>([]);
  const [days, setDays] = useState(3);
  const [direction, setDirection] = useState<"before" | "after" | "on">("before");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id || !invoiceId) return;
    (async () => {
      setLoading(true);
      const [sitterRes, overrideRes] = await Promise.all([
        (supabase as any).from("sitter_reminder_settings").select("enabled, rules").eq("sitter_id", user.id).maybeSingle(),
        (supabase as any).from("invoice_reminder_overrides").select("enabled, rules").eq("invoice_id", invoiceId).maybeSingle(),
      ]);
      if (sitterRes.data) {
        setSitterEnabled(sitterRes.data.enabled);
        setSitterRules(Array.isArray(sitterRes.data.rules) && sitterRes.data.rules.length > 0 ? sitterRes.data.rules : DEFAULT_REMINDER_RULES);
      }
      if (overrideRes.data) {
        setOverrideEnabled(overrideRes.data.enabled);
        setOverrideRules(Array.isArray(overrideRes.data.rules) ? overrideRes.data.rules : null);
      }
      setLoading(false);
    })();
  }, [user?.id, invoiceId]);

  const usingOverride = overrideEnabled !== null;
  const effectiveEnabled = usingOverride ? !!overrideEnabled : sitterEnabled;
  const effectiveRules = overrideRules ?? sitterRules;

  const openEditor = () => {
    setDraftEnabled(effectiveEnabled);
    setDraftRules([...effectiveRules]);
    setEditorOpen(true);
  };

  const addDraftRule = () => {
    const offset = direction === "on" ? 0 : direction === "before" ? -Math.abs(days) : Math.abs(days);
    if (draftRules.some((r) => r.offset_days === offset && r.channel === channel)) {
      toast({ title: "Already in cadence", variant: "destructive" });
      return;
    }
    const rule: ReminderRule = { offset_days: offset, channel, label: describeRule({ offset_days: offset, channel, label: "" }) };
    setDraftRules([...draftRules, rule].sort((a, b) => a.offset_days - b.offset_days));
  };

  const removeDraft = (idx: number) => setDraftRules(draftRules.filter((_, i) => i !== idx));

  const saveOverride = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("invoice_reminder_overrides").upsert({
      invoice_id: invoiceId,
      enabled: draftEnabled,
      rules: draftRules,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setOverrideEnabled(draftEnabled);
    setOverrideRules(draftRules);
    toast({ title: "Override saved" });
    setEditorOpen(false);
  };

  const clearOverride = async () => {
    const { error } = await (supabase as any).from("invoice_reminder_overrides").delete().eq("invoice_id", invoiceId);
    if (error) {
      toast({ title: "Couldn't clear override", description: error.message, variant: "destructive" });
      return;
    }
    setOverrideEnabled(null);
    setOverrideRules(null);
    toast({ title: "Using sitter default" });
    setEditorOpen(false);
  };

  if (loading) {
    return (
      <Card className="p-3 text-xs text-muted-foreground">
        <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" /> Loading reminders…
      </Card>
    );
  }

  return (
    <>
      <Card className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Reminder schedule</div>
            {usingOverride && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Custom</span>}
          </div>
          <Button variant="ghost" size="sm" onClick={openEditor}>Customise</Button>
        </div>
        {!effectiveEnabled ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Reminders are off for this invoice. <Link to="/sitter/settings/reminders" className="underline">Default cadence</Link>
          </div>
        ) : (
          <ul className="mt-2 space-y-0.5 text-xs text-foreground/80">
            {effectiveRules.map((r, i) => (
              <li key={`${r.offset_days}-${r.channel}-${i}`}>{describeRule(r)}</li>
            ))}
            {effectiveRules.length === 0 && <li className="text-muted-foreground">No reminders.</li>}
          </ul>
        )}
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reminders for this invoice</DialogTitle>
            <DialogDescription>
              Override the sitter default just for this invoice. Clear the override to fall back to your defaults.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Send reminders</div>
                <p className="text-xs text-muted-foreground">When off, no automatic reminders for this invoice.</p>
              </div>
              <Switch checked={draftEnabled} onCheckedChange={setDraftEnabled} />
            </div>

            <ul className="divide-y divide-border rounded-md border border-border">
              {draftRules.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No rules yet.</li>
              ) : (
                draftRules.map((r, idx) => (
                  <li key={`${r.offset_days}-${r.channel}-${idx}`} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{describeRule(r)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeDraft(idx)} aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))
              )}
            </ul>

            <div className="grid gap-2 sm:grid-cols-[90px_130px_120px_auto]">
              <div>
                <Label className="text-xs">Days</Label>
                <Input type="number" min={0} max={60} value={days} onChange={(e) => setDays(Math.max(0, parseInt(e.target.value) || 0))} className="mt-1" disabled={direction === "on"} />
              </div>
              <div>
                <Label className="text-xs">When</Label>
                <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">Before due</SelectItem>
                    <SelectItem value="on">On due date</SelectItem>
                    <SelectItem value="after">After due</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" size="sm" onClick={addDraftRule}>Add</Button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {usingOverride ? (
              <Button variant="ghost" onClick={clearOverride}>Use sitter default</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
              <Button onClick={saveOverride} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save override
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
