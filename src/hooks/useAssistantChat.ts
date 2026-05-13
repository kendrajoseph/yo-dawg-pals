import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string | null;
  created_at: string;
  pending_actions?: AssistantPendingAction[];
};

export type AssistantPendingAction = {
  id: string;
  action_type: string;
  action_summary: string;
  status: "pending" | "confirmed" | "cancelled" | "failed" | "expired";
};

export function useAssistantChat() {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionsBusy, setActionsBusy] = useState<Set<string>>(new Set());
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
    })();
  }, [user?.id]);

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

    const pendingByMessage = new Map<string, AssistantPendingAction[]>();
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

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    const tempUser: AssistantMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, tempUser]);
    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: { conversation_id: conversationId, message: text },
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
      setMessages((m) => m.filter((msg) => msg.id !== tempUser.id));
    } finally {
      setBusy(false);
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
        const n = new Set(s);
        n.delete(actionId);
        return n;
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
        const n = new Set(s);
        n.delete(actionId);
        return n;
      });
    }
  };

  const reset = async () => {
    if (!user?.id || busy) return;
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

  return {
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
  };
}
