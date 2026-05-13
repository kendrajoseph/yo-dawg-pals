import { useEffect, useMemo, useRef, useState } from "react";
import { Send, RotateCcw, Check, X, ChevronDown, Wrench } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { SitterPageHeader } from "@/components/sitter/SitterPageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { track } from "@/integrations/posthog/PostHogProvider";
import assistantAvatar from "@/assets/assistant-avatar.png";

type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
};

type PendingApproval = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  preview: Record<string, unknown>;
};

const STORAGE_KEY = "yodawg-assistant-convo-v1";

const SUGGESTIONS = [
  "What's on my schedule today?",
  "Show me pending walk requests",
  "Find bookings for the Smiths",
  "Which invoices are still unpaid?",
];

export default function SitterAssistant() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load persisted conversation
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
        if (parsed.pending) setPending(parsed.pending);
      }
    } catch {}
    textareaRef.current?.focus();
  }, []);

  // Persist on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, pending }));
    } catch {}
  }, [messages, pending]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending, busy]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role === "user" || (m.role === "assistant" && m.content)),
    [messages]
  );

  const callAssistant = async (nextMessages: ChatMsg[], approval?: PendingApproval & { approved: boolean }) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: {
          messages: nextMessages,
          approval: approval
            ? { toolCallId: approval.toolCallId, toolName: approval.toolName, args: approval.args, approved: approval.approved }
            : undefined,
        },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; messages?: ChatMsg[]; pendingApproval?: PendingApproval | null; error?: string };
      if (!result?.ok) throw new Error(result?.error ?? "Assistant failed");
      setMessages(result.messages ?? []);
      setPending(result.pendingApproval ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Assistant error", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    track("assistant_chat_send", { length: text.length });
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    await callAssistant(next);
  };

  const approve = async (approved: boolean) => {
    if (!pending) return;
    const decision = pending;
    setPending(null);
    await callAssistant(messages, { ...decision, approved });
  };

  const reset = () => {
    if (busy) return;
    setMessages([]);
    setPending(null);
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    textareaRef.current?.focus();
  };

  return (
    <SitterShell>
      <SitterPageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <img src={assistantAvatar} alt="" className="h-7 w-7" width={512} height={512} loading="lazy" />
            Assistant
          </span>
        }
        description="Ask me to find anything, change a booking, send an invoice, update the schedule — anything on the site."
        actions={
          <Button variant="outline" size="sm" onClick={reset} disabled={busy || messages.length === 0}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            New chat
          </Button>
        }
      />

      <Card className="border border-border p-0 shadow-soft flex flex-col h-[calc(100vh-220px)] min-h-[480px]">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {visibleMessages.length === 0 && !busy ? (
            <EmptyState onPick={(s) => send(s)} />
          ) : (
            visibleMessages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))
          )}

          {/* Render tool-call summaries inline (assistant messages with tool_calls but no content) */}
          {messages.map((m, i) =>
            m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0 && !m.content ? (
              <ToolCallStrip key={`tc-${i}`} toolCalls={m.tool_calls} results={collectToolResults(messages, m.tool_calls)} />
            ) : null
          )}

          {pending && <ApprovalCard pending={pending} onApprove={() => approve(true)} onDecline={() => approve(false)} disabled={busy} />}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              Thinking…
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              placeholder="Ask anything about your bookings, clients, invoices, schedule…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              disabled={busy || !!pending}
              className="flex-1 resize-none"
            />
            <Button onClick={() => send()} disabled={busy || !input.trim() || !!pending} className="self-end">
              <Send className="mr-1.5 h-4 w-4" />
              Send
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Reads run automatically. Anything that changes data, sends a message, or charges money will ask you to confirm first.
          </p>
        </div>
      </Card>
    </SitterShell>
  );
}

function collectToolResults(all: ChatMsg[], toolCalls: NonNullable<ChatMsg["tool_calls"]>) {
  const ids = new Set(toolCalls.map((t) => t.id));
  return all.filter((m) => m.role === "tool" && m.tool_call_id && ids.has(m.tool_call_id));
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  if (msg.role === "assistant" && msg.content) {
    return (
      <div className="flex items-start gap-3">
        <img src={assistantAvatar} alt="" className="mt-0.5 h-7 w-7 shrink-0" width={28} height={28} loading="lazy" />
        <div className="flex-1 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</div>
      </div>
    );
  }
  return null;
}

function ToolCallStrip({
  toolCalls,
  results,
}: {
  toolCalls: NonNullable<ChatMsg["tool_calls"]>;
  results: ChatMsg[];
}) {
  return (
    <div className="ml-10 space-y-2">
      {toolCalls.map((tc) => {
        const result = results.find((r) => r.tool_call_id === tc.id);
        return <ToolCallRow key={tc.id} name={tc.function.name} args={tc.function.arguments} result={result?.content ?? null} />;
      })}
    </div>
  );
}

function ToolCallRow({ name, args, result }: { name: string; args: string; result: string | null }) {
  const [open, setOpen] = useState(false);
  const niceName = name.replace(/_/g, " ");
  return (
    <div className="rounded-md border border-border bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
      >
        <Wrench className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">{niceName}</span>
        <span className="ml-auto text-muted-foreground">{result ? "done" : "running…"}</span>
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border px-2 py-2 space-y-1.5">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">arguments</div>
            <pre className="overflow-x-auto whitespace-pre-wrap text-[11px]">{prettyJson(args)}</pre>
          </div>
          {result && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">result</div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px]">{prettyJson(result)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function prettyJson(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function ApprovalCard({
  pending,
  onApprove,
  onDecline,
  disabled,
}: {
  pending: PendingApproval;
  onApprove: () => void;
  onDecline: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 ml-10">
      <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">Confirm action</div>
      <div className="text-sm font-medium">{pending.summary}</div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Tool: <span className="font-mono">{pending.toolName}</span>
      </div>
      <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-[11px]">
        {JSON.stringify(pending.preview, null, 2)}
      </pre>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDecline} disabled={disabled}>
          <X className="mr-1 h-3.5 w-3.5" />
          Don't do it
        </Button>
        <Button size="sm" onClick={onApprove} disabled={disabled}>
          <Check className="mr-1 h-3.5 w-3.5" />
          Yes, do it
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
      <img src={assistantAvatar} alt="" className="h-16 w-16" width={64} height={64} loading="lazy" />
      <div>
        <p className="text-base font-medium">Hey Anneke — what do you need?</p>
        <p className="text-sm text-muted-foreground mt-1">
          I can search, summarize, and run actions across the whole site. Try one of these:
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted transition"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
