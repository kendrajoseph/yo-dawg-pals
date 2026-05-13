import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TEMPLATES, TemplateChannel, TemplateKind, findTemplateDef, templateKey } from "@/lib/sitterTemplates";

type CustomRow = {
  id?: string;
  kind: TemplateKind;
  channel: TemplateChannel;
  subject: string | null;
  body: string;
};

export default function SettingsTemplates() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState<Record<string, CustomRow>>({});
  const [selectedKey, setSelectedKey] = useState<string>(templateKey(TEMPLATES[0].kind, TEMPLATES[0].channel));

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("sitter_message_templates")
        .select("id, kind, channel, subject, body")
        .eq("sitter_id", user.id);
      const map: Record<string, CustomRow> = {};
      (data ?? []).forEach((row: CustomRow) => {
        map[templateKey(row.kind, row.channel)] = row;
      });
      setCustom(map);
      setLoading(false);
    })();
  }, [user?.id]);

  const grouped = useMemo(() => {
    const out: Record<string, typeof TEMPLATES> = { Invoices: [], Bookings: [] };
    TEMPLATES.forEach((t) => { out[t.category].push(t); });
    return out;
  }, []);

  const def = useMemo(() => {
    const [kind, channel] = selectedKey.split("::") as [TemplateKind, TemplateChannel];
    return findTemplateDef(kind, channel);
  }, [selectedKey]);

  const current: CustomRow = custom[selectedKey] ?? {
    kind: (selectedKey.split("::")[0] as TemplateKind),
    channel: (selectedKey.split("::")[1] as TemplateChannel),
    subject: def?.defaultSubject ?? null,
    body: def?.defaultBody ?? "",
  };

  const isCustomised = !!custom[selectedKey];

  const updateCurrent = (patch: Partial<CustomRow>) => {
    setCustom((prev) => ({ ...prev, [selectedKey]: { ...current, ...patch } }));
  };

  const onSave = async () => {
    if (!user?.id || !def) return;
    setSaving(true);
    const payload = {
      sitter_id: user.id,
      kind: current.kind,
      channel: current.channel,
      subject: current.channel === "email" ? (current.subject || null) : null,
      body: current.body,
    };
    const { data, error } = await (supabase as any)
      .from("sitter_message_templates")
      .upsert(payload, { onConflict: "sitter_id,kind,channel" })
      .select("id, kind, channel, subject, body")
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    if (data) setCustom((prev) => ({ ...prev, [selectedKey]: data }));
    toast({ title: "Template saved" });
  };

  const onReset = async () => {
    if (!user?.id || !def) return;
    if (!isCustomised) return;
    const { error } = await (supabase as any)
      .from("sitter_message_templates")
      .delete()
      .eq("sitter_id", user.id)
      .eq("kind", current.kind)
      .eq("channel", current.channel);
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      return;
    }
    setCustom((prev) => {
      const next = { ...prev };
      delete next[selectedKey];
      return next;
    });
    toast({ title: "Reset to default" });
  };

  const insertVariable = (v: string) => {
    updateCurrent({ body: (current.body || "") + ` {{${v}}}` });
  };

  if (loading) {
    return (
      <SettingsLayout title="Templates" description="Customise the messages sent to your customers.">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Templates" description="Customise the messages sent to your customers. Variables in {{double braces}} get filled in automatically.">
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <Card className="p-2 shadow-soft">
          {(["Invoices", "Bookings"] as const).map((cat) => (
            <div key={cat} className="mb-2 last:mb-0">
              <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</div>
              <div className="flex flex-col">
                {grouped[cat].map((t) => {
                  const k = templateKey(t.kind, t.channel);
                  const active = k === selectedKey;
                  const customised = !!custom[k];
                  return (
                    <button
                      key={k}
                      onClick={() => setSelectedKey(k)}
                      className={cn(
                        "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        active ? "bg-primary/10 text-primary" : "hover:bg-muted",
                      )}
                    >
                      <span className="truncate">{t.label}</span>
                      <span className="ml-2 flex items-center gap-1">
                        {t.channel === "sms" && <Badge variant="outline" className="h-4 px-1 text-[9px]">SMS</Badge>}
                        {customised && <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Customised" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>

        <Card className="space-y-4 p-5 shadow-soft">
          {def && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg text-primary">{def.label}</div>
                  <p className="text-xs text-muted-foreground">{def.description}</p>
                </div>
                {isCustomised && (
                  <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
                  </Button>
                )}
              </div>

              {def.channel === "email" && (
                <div>
                  <Label htmlFor="subj">Subject</Label>
                  <Input
                    id="subj"
                    value={current.subject ?? ""}
                    onChange={(e) => updateCurrent({ subject: e.target.value })}
                    placeholder={def.defaultSubject}
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="body">{def.channel === "sms" ? "Message" : "Body"}</Label>
                <Textarea
                  id="body"
                  value={current.body}
                  onChange={(e) => updateCurrent({ body: e.target.value })}
                  rows={def.channel === "sms" ? 4 : 10}
                  className="mt-1 font-mono text-xs"
                />
                {def.channel === "sms" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Keep under 160 characters where possible.</p>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground">Available variables</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {def.variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-mono text-foreground/70 hover:bg-muted hover:text-foreground"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={onSave} disabled={saving}>
                  {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save template
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </SettingsLayout>
  );
}
