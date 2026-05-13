import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";
import {
  TOOLS,
  executeTool,
  type ToolContext,
} from "../_shared/assistant-tools.ts";

const MAX_TOOL_ITERATIONS = 8;
const MODEL = "claude-haiku-4-5";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 2048;

const bodySchema = z.object({
  conversation_id: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(4000),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const systemPrompt = `You are AJ's personal business assistant for Yo Dawg, a Hamilton-Ontario dog walking and pet care service.

You help AJ with:
- Finding bookings, invoices, clients, pets in her database
- Understanding her revenue, schedule, and inbox
- Drafting messages to clients
- Proposing actions like sending reminders, approving requests, blocking dates

GROUND RULES:
- Use tools to fetch real data. NEVER invent IDs, names, prices, or dates.
- For read queries, just call the tool and answer with what you find.
- For destructive actions (sending, marking paid, approving), use the propose_* tools. These create pending actions that AJ confirms with a tap.
- When AJ asks ambiguous questions like "find Sarah's invoice" and there are multiple Sarahs, list them and ask which one.
- Be conversational and concise. AJ is often on her phone between walks. Keep replies tight.
- When listing items, include the most relevant fields (amount, date, status). Use simple formatting.
- Today's date will be in the user's first message context. Use it for "today", "this week", "overdue" calculations.
- Money is in CAD. Times are Eastern (Hamilton).

WHAT YOU DO NOT DO:
- Don't suggest schedule changes that require complex multi-step setup. For those, suggest AJ open the Schedule Assistant page on the dashboard.
- Don't make up information. If a tool returned nothing, say so.
- Don't ask for confirmation before reading or drafting. Only confirm destructive actions (and the propose_* tools handle that for you).`;

function getAnthropicTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: any) => r.role === "sitter" || r.role === "admin")) {
      return json({ error: "Forbidden" }, 403);
    }

    const sitterId = user.id;

    let conversationId = parsed.data.conversation_id;
    if (!conversationId) {
      const { data: existing } = await admin
        .from("assistant_conversations")
        .select("id")
        .eq("sitter_id", sitterId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        conversationId = (existing as any).id;
      } else {
        const { data: created } = await admin
          .from("assistant_conversations")
          .insert({ sitter_id: sitterId, title: parsed.data.message.slice(0, 60) })
          .select("id")
          .single();
        conversationId = (created as any)?.id;
      }
    }
    if (!conversationId) return json({ error: "Could not create conversation" }, 500);

    const today = new Date().toLocaleDateString("en-CA", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Toronto",
    });
    const userMessageContent = `[Today is ${today}]\n\n${parsed.data.message}`;

    await admin.from("assistant_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMessageContent,
    });

    const { data: history } = await admin
      .from("assistant_messages")
      .select("role, content, tool_calls, tool_call_id, tool_name")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(30);

    const messages = buildAnthropicMessages(history ?? []);

    const toolCtx: ToolContext = { supabase: admin, sitterId, conversationId };
    let iteration = 0;
    let finalAssistantText: string | null = null;
    const pendingActionIds: string[] = [];

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const aiResponse = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          tools: getAnthropicTools(),
          messages,
        }),
      });

      if (aiResponse.status === 429) {
        return json({ error: "AI is rate-limited. Try again in a moment." }, 429);
      }
      if (aiResponse.status === 401 || aiResponse.status === 403) {
        return json({ error: "Anthropic API key is invalid or unauthorized." }, 500);
      }
      if (!aiResponse.ok) {
        const text = await aiResponse.text();
        console.error("Anthropic call failed", { status: aiResponse.status, text });
        return json({ error: `AI call failed (${aiResponse.status})` }, 500);
      }

      const aiJson = await aiResponse.json();
      const contentBlocks = aiJson.content ?? [];
      const toolUseBlocks = contentBlocks.filter((b: any) => b.type === "tool_use");
      const textBlocks = contentBlocks.filter((b: any) => b.type === "text");

      if (toolUseBlocks.length === 0) {
        finalAssistantText = textBlocks.map((b: any) => b.text).join("\n").trim();
        break;
      }

      const assistantContent = contentBlocks;

      await admin.from("assistant_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: textBlocks.map((b: any) => b.text).join("\n").trim() || null,
        tool_calls: toolUseBlocks,
      });

      messages.push({ role: "assistant", content: assistantContent });

      const toolResultBlocks: any[] = [];
      for (const toolUse of toolUseBlocks) {
        const { ok, result, error } = await executeTool(toolUse.name, toolUse.input, toolCtx);
        const content = ok ? JSON.stringify(result) : JSON.stringify({ error });

        if (ok && result?.pending_action_id) {
          pendingActionIds.push(result.pending_action_id);
        }

        await admin.from("assistant_messages").insert({
          conversation_id: conversationId,
          role: "tool",
          content,
          tool_call_id: toolUse.id,
          tool_name: toolUse.name,
        });

        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content,
          is_error: !ok,
        });
      }

      messages.push({ role: "user", content: toolResultBlocks });
    }

    if (!finalAssistantText) {
      finalAssistantText =
        "I worked on that but ran out of iterations. Try a simpler request, or check the dashboard.";
    }

    const { data: savedFinal } = await admin
      .from("assistant_messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: finalAssistantText,
      })
      .select("id")
      .single();

    await admin
      .from("assistant_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    if (pendingActionIds.length > 0 && savedFinal) {
      await admin
        .from("assistant_pending_actions")
        .update({ message_id: (savedFinal as any).id })
        .in("id", pendingActionIds);
    }

    const { data: pendingActions } = pendingActionIds.length > 0
      ? await admin
          .from("assistant_pending_actions")
          .select("id, action_type, action_summary, action_payload")
          .in("id", pendingActionIds)
      : { data: [] };

    return json({
      ok: true,
      conversation_id: conversationId,
      reply: finalAssistantText,
      pending_actions: pendingActions ?? [],
    });
  } catch (error) {
    console.error("assistant-chat error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function buildAnthropicMessages(rows: any[]): any[] {
  const out: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.role === "user") {
      out.push({ role: "user", content: r.content });
    } else if (r.role === "assistant") {
      if (r.tool_calls && Array.isArray(r.tool_calls) && r.tool_calls.length > 0) {
        const toolUses = r.tool_calls.map(normalizeAnthropicToolUse).filter(Boolean);
        const toolResults: any[] = [];
        const resultIds = new Set<string>();

        let j = i + 1;
        while (j < rows.length && rows[j].role === "tool") {
          const toolRow = rows[j];
          if (toolRow.tool_call_id && toolUses.some((tc: any) => tc.id === toolRow.tool_call_id)) {
            resultIds.add(toolRow.tool_call_id);
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolRow.tool_call_id,
              content: toolRow.content,
            });
          }
          j++;
        }

        const completeToolUses = toolUses.filter((tc: any) => resultIds.has(tc.id));
        const blocks: any[] = [];
        if (r.content) blocks.push({ type: "text", text: r.content });
        blocks.push(...completeToolUses);
        if (blocks.length === 0) {
          continue;
        }
        out.push({ role: "assistant", content: blocks });
        if (completeToolUses.length > 0) {
          out.push({ role: "user", content: toolResults.filter((tr) => resultIds.has(tr.tool_use_id)) });
          i = j - 1;
        }
      } else {
        out.push({ role: "assistant", content: r.content ?? "" });
      }
    }
  }

  return out;
}

function normalizeAnthropicToolUse(toolCall: any): any | null {
  if (!toolCall || typeof toolCall !== "object") return null;

  if (toolCall.type === "tool_use") {
    const id = typeof toolCall.id === "string" ? toolCall.id : null;
    const name = typeof toolCall.name === "string" ? toolCall.name : null;
    if (!id || !name) return null;
    return {
      type: "tool_use",
      id,
      name,
      input: normalizeToolInput(toolCall.input),
    };
  }

  const id = typeof toolCall.id === "string" ? toolCall.id : null;
  const functionCall = toolCall.function;
  const name =
    typeof toolCall.name === "string"
      ? toolCall.name
      : typeof functionCall?.name === "string"
        ? functionCall.name
        : null;

  if (!id || !name) return null;

  return {
    type: "tool_use",
    id,
    name,
    input: normalizeToolInput(toolCall.input ?? functionCall?.arguments ?? toolCall.arguments),
  };
}

function normalizeToolInput(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  if (typeof input === "string" && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}
