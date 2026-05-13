import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

function ruleLabel(offsetDays: number, channel: "email" | "sms"): string {
  return describeRule({ offset_days: offsetDays, channel, label: "" });
}

export default function SettingsReminders() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<ReminderRule[]>(DEFAULT_REMINDER_RULES);

  // form for new rule
  const [newDays, setNewDays] = useState(3);
  const [newDirection, setNewDirection] = useState<"before" | "after" | "on">("before");
  const [newChannel, setNewChannel] = useState<"email" | "sms">("email");

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("sitter_reminder_settings")
        .select("enabled, rules")
        .eq("sitter_id", user.id)
        .maybeSingle();
      if (data) {
        setEnabled(data.enabled);
        setRules(Array.isArray(data.rules) && data.rules.length > 0 ? data.rules : DEFAULT_REMINDER_RULES);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const addRule = () => {
    const offset = newDirection === "on" ? 0 : newDirection === "before" ? -Math.abs(newDays) : Math.abs(newDays);
    const rule: ReminderRule = {
      offset_days: offset,
      channel: newChannel,
      label: ruleLabel(offset, newChannel),
    };
    // dedupe
    if (rules.some((r) => r.offset_days === rule.offset_days && r.channel === rule.channel)) {
      toast({ title: "Already in your cadence", variant: "destructive" });
      return;
    }
    setRules([...rules, rule].sort((a, b) => a.offset_days - b.offset_days));
  };

  const removeRule = (idx: number) => setRules(rules.filter((_, i) => i !== idx));

  const onSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await (supabase as any).from("sitter_reminder_settings").upsert({
      sitter_id: user.id,
      enabled,
      rules,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reminder cadence saved" });
    }
  };

  if (loading) {
    return (
      <SettingsLayout title="Reminders" description="Auto-send invoice reminders on a cadence.">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Reminders" description="Auto-send invoice reminders on a cadence. You can override this per invoice.">
      <div className="space-y-4">
        <Card className="flex items-center justify-between p-5 shadow-soft">
          <div>
            <div className="font-medium">Send automatic reminders</div>
            <p className="text-xs text-muted-foreground">When off, you'll only send manual nudges from each invoice.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </Card>

        <Card className="space-y-3 p-5 shadow-soft">
          <div>
            <div className="font-medium">Default cadence</div>
            <p className="text-xs text-muted-foreground">These rules apply to every new invoice unless you override them.</p>
          </div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {rules.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">No reminders configured.</li>
            ) : (
              rules.map((r, idx) => (
                <li key={`${r.offset_days}-${r.channel}`} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{describeRule(r)}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRule(idx)} aria-label="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className="space-y-3 p-5 shadow-soft">
          <div className="font-medium">Add a rule</div>
          <div className="grid gap-3 sm:grid-cols-[110px_140px_140px_auto]">
            <div>
              <Label htmlFor="days" className="text-xs">Days</Label>
              <Input
                id="days"
                type="number"
                min={0}
                max={60}
                value={newDays}
                onChange={(e) => setNewDays(Math.max(0, parseInt(e.target.value) || 0))}
                className="mt-1"
                disabled={newDirection === "on"}
              />
            </div>
            <div>
              <Label className="text-xs">When</Label>
              <Select value={newDirection} onValueChange={(v) => setNewDirection(v as any)}>
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
              <Select value={newChannel} onValueChange={(v) => setNewChannel(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={addRule}>
                <Plus className="mr-1.5 h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save reminders
          </Button>
        </div>
      </div>
    </SettingsLayout>
  );
}
