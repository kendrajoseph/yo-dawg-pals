import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Check, X, Loader2, RotateCcw } from "lucide-react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { SitterPageHeader } from "@/components/sitter/SitterPageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import assistantAvatar from "@/assets/assistant-avatar.png";

type Message = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string | null;
  created_at: string;
  pending_actions?: PendingAction[];
};

type PendingAction = {
  id: string;
  action_type: string;
  action_summary: string;
  status: "pending" | "confirmed" | "cancelled" | "failed" | "expired";
};

const SAMPLE_PROMPTS = [
  "Find overdue invoices",
  "Who hasn't paid this month?",
  "What's tomorrow look like?",
  "Show me Moose's recent bookings",
  "How much did I make last week?",
  "What's in my inbox?",
];

export default function SitterAssistant() {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [actionsBusy, setActionsBusy] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: convo } = await supabase
        .from("assistant_conversations")
        .select("id")
        .eq("sitter_id", user.id)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convo) {
        setConversationId((convo as any).id);
        await loadMessages((convo as any).id);
      }
      textareaRef.current?.focus();
    })();
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const loadMessages = async (convoId: string) => {
    const { data } = await supabase
      .from("assistant_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", convoId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true });

    if (!data) return;

    const assistantIds = data.filter((m: any) => m.role === "assistant").map((m: any) => m.id);
    const { data: pending } = assistantIds.length
      ? await supabase
          .from("assistant_pending_actions")
          .select("id, message_id, action_type, action_summary, status")
          .in("message_id", assistantIds)
      : { data: [] };

    const pendingByMessage = new Map<string, PendingAction[]>();
    for (const p of pending ?? []) {
      const list = pendingByMessage.get((p as any).message_id) ?? [];
      list.push(p as any);
      pendingByMessage.set((p as any).message_id, list);
    }

    setMessages(
      data
        .filter((m: any) => m.content)
        .map((m: any) => ({ ...m, pending_actions: pendingByMessage.get(m.id) ?? [] })),
    );
  };

  const sendMessage = async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || sending) return;

    setSending(true);
    setInput("");

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, tempUserMsg]);

    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: { conversation_id: conversationId, message: messageText },
      });
      if (error) throw error;
      const result = data as any;

      if (result.conversation_id) {
        setConversationId(result.conversation_id);
        await loadMessages(result.conversation_id);
      }
    } catch (err) {
      toast({
        title: "Couldn't reach the assistant",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
      setMessages((m) => m.filter((msg) => msg.id !== tempUserMsg.id));
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const confirmAction = async (actionId: string) => {
    setActionsBusy((s) => new Set(s).add(actionId));
    try {
      const { error } = await supabase.functions.invoke("assistant-execute-action", {
        body: { pending_action_id: actionId },
      });
      if (error) throw error;
      toast({ title: "Done ✓" });
      if (conversationId) await loadMessages(conversationId);
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setActionsBusy((s) => {
        const next = new Set(s);
        next.delete(actionId);
        return next;
      });
    }
  };

  const cancelAction = async (actionId: string) => {
    setActionsBusy((s) => new Set(s).add(actionId));
    try {
      const { error } = await supabase.functions.invoke("assistant-cancel-action", {
        body: { pending_action_id: actionId },
      });
      if (error) throw error;
      if (conversationId) await loadMessages(conversationId);
    } catch (err) {
      toast({ title: "Couldn't cancel", description: String(err), variant: "destructive" });
    } finally {
      setActionsBusy((s) => {
        const next = new Set(s);
        next.delete(actionId);
        return next;
      });
    }
  };

  const startNewConversation = async () => {
    if (!user?.id || sending) return;
    const { data } = await supabase
      .from("assistant_conversations")
      .insert({ sitter_id: user.id, title: "New chat" })
      .select("id")
      .single();
    if (data) {
      setConversationId((data as any).id);
      setMessages([]);
      textareaRef.current?.focus();
    }
  };

  return (
    <SitterShell>
      <SitterPageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <img src={assistantAvatar} alt="" className="h-7 w-7" width={28} height={28} loading="lazy" />
            Assistant
          </span>
        }
        description="Ask anything about your business. I can find things, draft messages, and propose actions."
        actions={
          <Button size="sm" variant="outline" onClick={startNewConversation} disabled={sending}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            New chat
          </Button>
        }
      />

      <Card className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col border border-border shadow-soft">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {messages.length === 0 && !sending ? (
            <EmptyState onTry={sendMessage} />
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onConfirm={confirmAction}
                  onCancel={cancelAction}
                  busy={actionsBusy}
                />
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 sm:p-4">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Find overdue invoices, what's tomorrow look like, how much did I make last week..."
              rows={2}
              className="flex-1 resize-none"
              disabled={sending}
            />
            <Button onClick={() => sendMessage()} disabled={sending || !input.trim()} className="self-end h-[60px]">
              <Send className="h-4 w-4" />
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

function MessageBubble({
  message,
  onConfirm,
  onCancel,
  busy,
}: {
  message: Message;
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
        <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap">
          {display}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <img src={assistantAvatar} alt="" className="mt-0.5 h-7 w-7 shrink-0 rounded-full" width={28} height={28} loading="lazy" />
      <div className="flex-1 min-w-0">
        <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{display}</div>
        {message.pending_actions && message.pending_actions.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.pending_actions.map((action) => (
              <PendingActionCard
                key={action.id}
                action={action}
                busy={busy.has(action.id)}
                onConfirm={() => onConfirm(action.id)}
                onCancel={() => onCancel(action.id)}
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
  action: PendingAction;
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
      <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
        <Badge variant={action.status === "confirmed" ? "default" : "outline"}>{label}</Badge>
        <span className="ml-2 text-muted-foreground">{action.action_summary}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">Awaiting confirmation</div>
      <div className="mt-1 text-sm">{action.action_summary}</div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onConfirm} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
          Confirm
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
          <X className="mr-1 h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ onTry }: { onTry: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <img src={assistantAvatar} alt="" className="h-16 w-16" width={64} height={64} loading="lazy" />
      <h3 className="mt-4 font-display text-xl text-primary">How can I help?</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Ask anything about your bookings, invoices, clients, or schedule. I can also draft messages and propose actions.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onTry(p)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
