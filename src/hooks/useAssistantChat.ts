import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { track } from "@/integrations/posthog/PostHogProvider";

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

type PendingApproval = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  preview: Record<string, unknown>;
};

const STORAGE_KEY = "yodawg-assistant-convo-v1";

export function useAssistantChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingApproval | null>(null);
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

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role === "user" || (m.role === "assistant" && m.content)),
    [messages]
  );

  const callAssistant = useCallback(async (
    nextMessages: ChatMsg[],
    approval?: PendingApproval & { approved: boolean }
  ) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: {
          messages: nextMessages,
          approval: approval
            ? {
                toolCallId: approval.toolCallId,
                toolName: approval.toolName,
                args: approval.args,
                approved: approval.approved,
              }
            : undefined,
        },
      });
      if (error) throw error;
      const result = data as {
        ok?: boolean;
        messages?: ChatMsg[];
        pendingApproval?: PendingApproval | null;
        error?: string;
      };
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
  }, []);

  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    track("assistant_chat_send", { length: text.length });
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    await callAssistant(next);
  }, [input, busy, messages, callAssistant]);

  const approve = useCallback(async (approved: boolean) => {
    if (!pending) return;
    const decision = pending;
    setPending(null);
    await callAssistant(messages, { ...decision, approved });
  }, [pending, messages, callAssistant]);

  const reset = useCallback(() => {
    if (busy) return;
    setMessages([]);
    setPending(null);
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    textareaRef.current?.focus();
  }, [busy]);

  return {
    messages,
    visibleMessages,
    input,
    setInput,
    busy,
    pending,
    textareaRef,
    send,
    approve,
    reset,
  };
}
