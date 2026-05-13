import { useState, useRef, useEffect } from "react";
import { Send, RotateCcw, X, Check, Wrench, ChevronDown, Sparkles, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import assistantAvatar from "@/assets/assistant-avatar.png";

const SUGGESTIONS = [
  "What's on my schedule today?",
  "Show me pending walk requests",
  "Find bookings for the Smiths",
  "Which invoices are still unpaid?",
];

type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [firstOpen, setFirstOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const {
    visibleMessages,
    input,
    setInput,
    busy,
    pending,
    textareaRef,
    send,
    approve,
    reset,
    messages,
  } = useAssistantChat();

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleMessages.length, pending, busy]);

  const handleOpen = () => {
    setOpen(true);
    if (!firstOpen) setFirstOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSend = async (textOverride?: string) => {
    await send(textOverride);
  };

  // Click outside to close
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
      {/* Floating launcher button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Open assistant"
        title="Open assistant"
      >
        <img src={assistantAvatar} alt="" className="h-9 w-9 rounded-full" width={36} height={36} loading="lazy" />
      </button>

      {/* Chat popover */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-50 w-[90vw] max-w-md sm:w-96"
        >
          <Card className="flex flex-col overflow-hidden border border-border shadow-xl"
            style={{ height: "70vh", maxHeight: 640 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <img src={assistantAvatar} alt="" className="h-6 w-6 rounded-full" width={24} height={24} loading="lazy" />
              <span className="flex-1 text-sm font-medium">Assistant</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset} disabled={busy} title="New chat">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose} title="Close">
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
              {visibleMessages.length === 0 && !busy ? (
                <EmptyState onPick={(s) => handleSend(s)} />
              ) : (
                visibleMessages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} />
                ))
              )}

              {messages.map((m, i) =>
                m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0 && !m.content ? (
                  <ToolCallStrip key={`tc-${i}`} toolCalls={m.tool_calls} results={collectToolResults(messages, m.tool_calls)} />
                ) : null
              )}

              {pending && (
                <ApprovalCard
                  pending={pending}
                  onApprove={() => approve(true)}
                  onDecline={() => approve(false)}
                  disabled={busy}
                />
              )}

              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                  Thinking…
                </div>
              )}
            </div>

            {/* Input */}
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
                      handleSend();
                    }
                  }}
                  rows={2}
                  disabled={busy || !!pending}
                  className="flex-1 resize-none min-h-0"
                />
                <Button onClick={() => handleSend()} disabled={busy || !input.trim() || !!pending} className="self-end h-9 w-9 p-0" size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Reads run auto. Writes ask you first.
              </p>
            </div>
          </Card>
        </div>
      )}
    </>
  );
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
      <div className="flex items-start gap-2.5">
        <img src={assistantAvatar} alt="" className="mt-0.5 h-6 w-6 shrink-0 rounded-full" width={24} height={24} loading="lazy" />
        <div className="flex-1 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</div>
      </div>
    );
  }
  return null;
}

function collectToolResults(all: ChatMsg[], toolCalls: NonNullable<ChatMsg["tool_calls"]>) {
  const ids = new Set(toolCalls.map((t) => t.id));
  return all.filter((m) => m.role === "tool" && m.tool_call_id && ids.has(m.tool_call_id));
}

function ToolCallStrip({
  toolCalls,
  results,
}: {
  toolCalls: NonNullable<ChatMsg["tool_calls"]>;
  results: ChatMsg[];
}) {
  return (
    <div className="ml-9 space-y-1.5">
      {toolCalls.map((tc) => {
        const result = results.find((r) => r.tool_call_id === tc.id);
        return <ToolCallRow key={tc.id} name={tc.function.name} args={tc.function.arguments} result={result?.content ?? null} />;
      })}
    </div>
  );
}

function ToolCallRow({ name, args, result }: { name: string; args: string; result: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const niceName = name.replace(/_/g, " ");
  return (
    <div className="rounded-md border border-border bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
      >
        <Wrench className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">{niceName}</span>
        <span className="ml-auto text-muted-foreground">{result ? "done" : "running…"}</span>
        <ChevronDown className={`h-3 w-3 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="border-t border-border px-2 py-2 space-y-1.5">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">arguments</div>
            <pre className="overflow-x-auto whitespace-pre-wrap text-[11px]">{prettyJson(args)}</pre>
          </div>
          {result && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">result</div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[11px]">{prettyJson(result)}</pre>
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
  pending: { toolName: string; summary: string; preview: Record<string, unknown> };
  onApprove: () => void;
  onDecline: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 p-3 ml-9">
      <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">Confirm action</div>
      <div className="text-sm font-medium">{pending.summary}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        Tool: <span className="font-mono">{pending.toolName}</span>
      </div>
      <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-[11px]">
        {JSON.stringify(pending.preview, null, 2)}
      </pre>
      <div className="mt-2 flex justify-end gap-2">
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
