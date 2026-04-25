import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Send, AlertTriangle, Bell } from "lucide-react";
import { format } from "date-fns";
import { SitterShell } from "@/components/sitter/SitterShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type {
  AssistantDashboardContext,
  AssistantPlanResponse,
  AssistantExecutionResponse,
  AssistantNotificationPreview,
} from "@/lib/scheduleAssistant";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  plan?: AssistantPlanResponse;
  preview?: AssistantNotificationPreview[];
};

export default function SitterScheduleAssistant() {
  const { user } = useAuth();
  const [context, setContext] = useState<AssistantDashboardContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plan, setPlan] = useState<AssistantPlanResponse | null>(null);
  const [preview, setPreview] = useState<AssistantNotificationPreview[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Load minimal context the planner needs
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [services, availability, walkWindows, blocked, requests] = await Promise.all([
          supabase.from("services")
            .select("id, name, slug, duration_minutes, payment_mode, scheduling_mode, requires_pet_approval, approval_required")
            .eq("is_active", true),
          supabase.from("availability")
            .select("id, weekday, start_minute, end_minute, max_bookings, availability_services(service_id, services(slug))")
            .eq("sitter_id", user.id),
          supabase.from("walk_windows")
            .select("id, service_id, weekday, start_minute, end_minute, window_label, max_bookings, services(slug)")
            .eq("sitter_id", user.id),
          supabase.from("blocked_dates").select("id, blocked_date, reason").eq("sitter_id", user.id),
          supabase.from("bookings")
            .select("id, status, customer_id, booking_kind, requested_date, requested_end_date, requested_window_label, requested_window_start_minute, requested_window_end_minute, recurrence_label, request_group_id, request_group_label, services(slug, name), pets(name), profiles:customer_id(full_name)")
            .eq("sitter_id", user.id).eq("status", "requested"),
        ]);

        if (cancelled) return;

        const ctx: AssistantDashboardContext = {
          today: format(new Date(), "yyyy-MM-dd"),
          services: ((services.data ?? []) as any[]).map((s) => ({
            id: s.id, name: s.name, slug: s.slug, duration_minutes: s.duration_minutes,
            payment_mode: s.payment_mode, scheduling_mode: s.scheduling_mode,
            requires_pet_approval: s.requires_pet_approval, approval_required: s.approval_required,
          })),
          availability: ((availability.data ?? []) as any[]).map((a) => ({
            id: a.id, weekday: a.weekday, start_minute: a.start_minute, end_minute: a.end_minute,
            max_bookings: a.max_bookings,
            service_slugs: (a.availability_services ?? []).map((row: any) => row.services?.slug).filter(Boolean),
          })),
          walkWindows: ((walkWindows.data ?? []) as any[]).map((w) => ({
            id: w.id, service_slug: w.services?.slug ?? "", weekday: w.weekday,
            start_minute: w.start_minute, end_minute: w.end_minute,
            window_label: w.window_label, max_bookings: w.max_bookings,
          })),
          blockedDates: ((blocked.data ?? []) as any[]).map((b) => ({ id: b.id, blocked_date: b.blocked_date, reason: b.reason })),
          requestGroups: groupRequests((requests.data ?? []) as any[]),
        };
        setContext(ctx);
      } catch (err) {
        console.error("assistant context error", err);
        if (!cancelled) setContextError(err instanceof Error ? err.message : "Failed to load context");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const counts = useMemo(() => ({
    services: context?.services.length ?? 0,
    availability: context?.availability.length ?? 0,
    requests: context?.requestGroups.reduce((acc, g) => acc + g.bookings.length, 0) ?? 0,
  }), [context]);

  const submit = async () => {
    const trimmed = command.trim();
    if (!trimmed || !context) return;
    setBusy(true);
    setPlan(null);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: trimmed }]);
    try {
      const { data, error } = await supabase.functions.invoke("assistant-schedule-plan", {
        body: { command: trimmed, context },
      });
      if (error) throw error;
      if ((data as any)?.fallback) {
        setUnavailable(true);
        setMessages((m) => [...m, { id: `s-${Date.now()}`, role: "system", content: "Assistant is temporarily unavailable. You can still approve requests manually from the Inbox." }]);
        return;
      }
      if (!(data as any)?.ok || !(data as any)?.plan) {
        const desc = (data as any)?.error ?? "Try rephrasing the command.";
        toast({ title: "Couldn't build a plan", description: desc, variant: "destructive" });
        return;
      }
      const p = (data as any).plan as AssistantPlanResponse;
      setPlan(p);
      setCommand("");
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: p.summary, plan: p }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // Graceful fallback rather than blank screen
      setUnavailable(true);
      setMessages((m) => [...m, { id: `s-${Date.now()}`, role: "system", content: `Assistant is temporarily unavailable (${message}). You can still approve requests manually from the Inbox.` }]);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!plan) return;
    if (plan.operations.length === 0) {
      toast({ title: "Nothing to apply", description: plan.followUpQuestions[0] ?? "The assistant needs more detail before it can make changes." });
      return;
    }
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("assistant-schedule-execute", {
        body: { operations: plan.operations, appUrl: window.location.origin, previewOnly: false },
      });
      if (error) throw error;
      if ((data as any)?.fallback || !(data as any)?.ok) {
        toast({ title: "Couldn't apply changes", description: (data as any)?.error ?? "Try again in a moment.", variant: "destructive" });
        return;
      }
      const result = data as AssistantExecutionResponse;
      setPreview(result.notificationPreview ?? []);
      setMessages((m) => [...m, { id: `ap-${Date.now()}`, role: "assistant", content: result.summary || "Assistant actions applied.", preview: result.notificationPreview ?? [] }]);
      if (result.warnings.length > 0) toast({ title: "Applied with warnings", description: result.warnings[0] });
      else toast({ title: "Changes applied" });
    } catch (err) {
      toast({ title: "Couldn't apply changes", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const sendNotifications = async () => {
    if (!preview.length) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("assistant-schedule-execute", {
        body: {
          operations: [{ type: "send_preview_notifications", summary: "Send the prepared client notifications", bookingIds: preview.map((p) => p.bookingId) }],
          appUrl: window.location.origin,
          previewOnly: false,
          sendNotifications: true,
        },
      });
      if (error) throw error;
      if ((data as any)?.fallback || !(data as any)?.ok) {
        toast({ title: "Notifications didn't send", description: (data as any)?.error ?? "Try again later.", variant: "destructive" });
        return;
      }
      toast({ title: "Client notifications sent" });
      setPreview([]);
    } catch (err) {
      toast({ title: "Notifications didn't send", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <SitterShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-primary inline-flex items-center gap-2">
            <Sparkles className="h-6 w-6" />Schedule assistant
          </h1>
          <p className="text-sm text-muted-foreground">
            Type a natural-language command — e.g. "Approve all walk requests for Friday morning" or "Block off May 6–8 for vet".
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{counts.services} services</Badge>
          <Badge variant="outline">{counts.availability} availability blocks</Badge>
          <Badge variant="outline">{counts.requests} pending requests</Badge>
        </div>
      </div>

      {unavailable && (
        <Card className="mb-4 border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div className="text-sm">
              The assistant is temporarily unavailable. You can still approve requests manually in the <a className="underline" href="/sitter/inbox">Inbox</a>.
            </div>
          </div>
        </Card>
      )}

      {contextError && (
        <Card className="mb-4 border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">Couldn't load schedule context: {contextError}</p>
        </Card>
      )}

      <Card className="border border-border p-0 shadow-soft">
        <div ref={scrollerRef} className="max-h-[40vh] min-h-[200px] overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Start by describing what you want to do. The assistant will return a plan you can review before anything happens.
            </p>
          ) : messages.map((msg) => (
            <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] rounded-md p-3 text-sm ${
                msg.role === "user" ? "bg-primary text-primary-foreground"
                : msg.role === "system" ? "bg-amber-100 text-amber-900"
                : "bg-muted text-foreground"}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.plan && msg.plan.operations.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                    {msg.plan.operations.map((op, i) => (<li key={i}>{op.summary || op.type}</li>))}
                  </ul>
                )}
                {msg.plan && msg.plan.followUpQuestions.length > 0 && (
                  <div className="mt-2 text-xs italic">
                    Needs clarification: {msg.plan.followUpQuestions.join(" · ")}
                  </div>
                )}
                {msg.preview && msg.preview.length > 0 && (
                  <div className="mt-2 text-xs">
                    {msg.preview.length} client notifications ready to send.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {plan && plan.operations.length > 0 && (
          <div className="border-t border-border p-3 flex flex-wrap items-center justify-between gap-2 bg-muted/40">
            <div className="text-xs text-muted-foreground">
              Plan ready · confidence <span className="font-medium">{plan.confidence}</span>
              {plan.warnings.length > 0 ? <> · {plan.warnings.length} warning{plan.warnings.length > 1 ? "s" : ""}</> : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setPlan(null); }}>Discard plan</Button>
              <Button size="sm" onClick={apply} disabled={applying}>{applying ? "Applying…" : "Apply plan"}</Button>
            </div>
          </div>
        )}

        {preview.length > 0 && (
          <div className="border-t border-border p-3 flex flex-wrap items-center justify-between gap-2 bg-muted/40">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Bell className="h-3.5 w-3.5" />{preview.length} client notification{preview.length > 1 ? "s" : ""} prepared
            </div>
            <Button size="sm" onClick={sendNotifications} disabled={applying}>
              {applying ? "Sending…" : "Send notifications"}
            </Button>
          </div>
        )}

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              placeholder={`e.g. "Approve all of Friday's pending solo walks at the requested times."`}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              rows={2}
              disabled={busy || !context}
              className="flex-1 resize-none"
            />
            <Button onClick={submit} disabled={busy || !command.trim() || !context} className="self-end">
              <Send className="mr-1.5 h-4 w-4" />{busy ? "Thinking…" : "Send"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Plans are previewed before anything is changed — nothing is applied until you click "Apply plan".
          </p>
        </div>
      </Card>
    </SitterShell>
  );
}

function groupRequests(rows: any[]): AssistantDashboardContext["requestGroups"] {
  const map = new Map<string, AssistantDashboardContext["requestGroups"][number]>();
  for (const r of rows) {
    const id = r.request_group_id ?? r.id;
    const label = r.request_group_label ?? r.recurrence_label ?? "Single visit";
    const existing = map.get(id) ?? { id, label, bookings: [] };
    existing.bookings.push({
      id: r.id,
      status: r.status,
      service_slug: r.services?.slug ?? null,
      service_name: r.services?.name ?? null,
      pet_name: r.pets?.name ?? null,
      customer_name: r.profiles?.full_name ?? "Client",
      booking_kind: r.booking_kind ?? null,
      requested_date: r.requested_date ?? null,
      requested_end_date: r.requested_end_date ?? null,
      requested_window_label: r.requested_window_label ?? null,
      requested_window_start_minute: r.requested_window_start_minute ?? null,
      requested_window_end_minute: r.requested_window_end_minute ?? null,
      recurrence_label: r.recurrence_label ?? null,
      request_group_id: r.request_group_id ?? null,
      request_group_label: r.request_group_label ?? null,
    });
    map.set(id, existing);
  }
  return [...map.values()];
}
