import { useState, useRef, useEffect } from "react";
import { Send, RotateCcw, Check, X, Minimize2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAssistantChat, type AssistantMessage, type AssistantPendingAction } from "@/hooks/useAssistantChat";
import assistantAvatar from "@/assets/assistant-avatar.png";

const SUGGESTIONS = [
  "What's on my schedule today?",
  "Show me pending walk requests",
  "Find overdue invoices",
  "How much did I make last week?",
];

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    setInput,
    busy,
    actionsBusy,
    textareaRef,
    send,
    confirmAction,
    cancelAction,
    reset,
  } = useAssistantChat();

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Open assistant"
        title="Open assistant"
      >
        <img src={assistantAvatar} alt="" className="h-9 w-9 rounded-full" width={36} height={36} loading="lazy" />
      </button>

      {open && (
        <div ref={panelRef} className="fixed bottom-24 right-6 z-50 w-[90vw] max-w-md sm:w-96">
          <Card className="flex flex-col overflow-hidden border border-border shadow-xl" style={{ height: "70vh", maxHeight: 640 }}>
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <img src={assistantAvatar} alt="" className="h-6 w-6 rounded-full" width={24} height={24} loading="lazy" />
              <span className="flex-1 text-sm font-medium">Assistant</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset} disabled={busy} title="New chat">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} title="Close">
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
              {messages.length === 0 && !busy ? (
                <EmptyState onPick={(s) => send(s)} />
              ) : (
                messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onConfirm={confirmAction}
                    onCancel={cancelAction}
                    busy={actionsBusy}
                  />
                ))
              )}

              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>

            <div className="border-t border-border p-2 bg-card">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  placeholder="Ask anything…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  disabled={busy}
                  className="flex-1 resize-none min-h-0"
                />
                <Button onClick={() => send()} disabled={busy || !input.trim()} className="self-end h-9 w-9 p-0" size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Reads run auto. Writes ask you first.</p>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function MessageBubble({
  message,
  onConfirm,
  onCancel,
  busy,
}: {
  message: AssistantMessage;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  busy: Set<string>;
}) {
  const isUser = message.role === "user";
  const display = isUser && message.content
    ? message.content.replace(/^\[Today is [^\]]+\]\s*/, "")
    : message.content;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
          {display}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <img src={assistantAvatar} alt="" className="mt-0.5 h-6 w-6 shrink-0 rounded-full" width={24} height={24} loading="lazy" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{display}</div>
        {message.pending_actions && message.pending_actions.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.pending_actions.map((a) => (
              <PendingActionCard
                key={a.id}
                action={a}
                busy={busy.has(a.id)}
                onConfirm={() => onConfirm(a.id)}
                onCancel={() => onCancel(a.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PendingActionCard({
  action,
  busy,
  onConfirm,
  onCancel,
}: {
  action: AssistantPendingAction;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (action.status !== "pending") {
    const label =
      action.status === "confirmed" ? "✓ Done"
      : action.status === "cancelled" ? "Cancelled"
      : action.status === "failed" ? "⚠️ Failed"
      : "Expired";
    return (
      <div className="rounded border border-border bg-card px-2 py-1 text-[11px]">
        <Badge variant={action.status === "confirmed" ? "default" : "outline"} className="text-[10px]">{label}</Badge>
        <span className="ml-1.5 text-muted-foreground">{action.action_summary}</span>
      </div>
    );
  }
  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">Awaiting confirmation</div>
      <div className="mt-0.5 text-xs">{action.action_summary}</div>
      <div className="mt-2 flex gap-1.5">
        <Button size="sm" onClick={onConfirm} disabled={busy} className="h-7 text-xs">
          {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
          Confirm
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={busy} className="h-7 text-xs">
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-6 space-y-3">
      <img src={assistantAvatar} alt="" className="h-12 w-12" width={48} height={48} loading="lazy" />
      <div>
        <p className="text-sm font-medium">Hey Anneke — what do you need?</p>
        <p className="text-xs text-muted-foreground mt-1">
          I can search, summarize, and run actions across the whole site.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] hover:bg-muted transition"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
