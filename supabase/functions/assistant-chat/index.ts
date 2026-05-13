// ============================================================================
// FILE: supabase/functions/assistant-chat/index.ts
// ============================================================================
// Main chat endpoint. Handles a single user message:
//   1. Persist user message
//   2. Load conversation history
//   3. Loop: call Lovable AI → execute tools → append results → repeat (max 8 iters)
//   4. Persist final assistant message
//   5. Return response with any pending actions
//
// Uses a supported Lovable AI gateway chat model with function calling support.
// ============================================================================

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";
import {
  getToolDefinitions,
  executeTool,
  type ToolContext,
} from "../_shared/assistant-tools.ts";

const MAX_TOOL_ITERATIONS = 8;
const MODEL = "google/gemini-3-flash-preview";

const bodySchema = z.object({
  conversation_id: z.string().uuid().nullish(),
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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    // User client (RLS-bound)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for reads (bypasses RLS but scoped to sitter_id manually)
    // We use service client because RLS still has the legacy hardcoded-email checks
    // that we said we'd fix later. For now, scope manually by sitter_id.
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Verify sitter role
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: any) => r.role === "sitter" || r.role === "admin")) {
      return json({ error: "Forbidden" }, 403);
    }

    const sitterId = user.id;

    // 1. Get or create conversation
    let conversationId = parsed.data.conversation_id;
    if (!conversationId) {
      // Find most recent conversation or create new
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

    // 2. Persist user message
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

    // 3. Load recent history (last 30 messages, trimmed for context size)
    const { data: history } = await admin
      .from("assistant_messages")
      .select("role, content, tool_calls, tool_call_id, tool_name")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(30);

    const messages = buildMessagesArray(history ?? []);

    // 4. Tool calling loop
    const toolCtx: ToolContext = { supabase: admin, sitterId, conversationId };
    let iteration = 0;
    let finalAssistantMessage: { content: string; tool_calls?: any } | null = null;
    const pendingActionIds: string[] = [];

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Lovable-API-Key": lovableApiKey,
          "X-Lovable-AIG-SDK": "openai-compatible-fetch",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          tools: getToolDefinitions(),
        }),
      });

      if (aiResponse.status === 429) return json({ error: "AI is rate-limited. Try again in a moment." }, 429);
      if (aiResponse.status === 402) return json({ error: "AI credits unavailable." }, 402);
      if (!aiResponse.ok) {
        const text = await aiResponse.text();
        console.error("AI call failed", { status: aiResponse.status, text });
        return json(
          {
            error: "The assistant could not reach AI right now. Please try again.",
            fallback: true,
          },
          aiResponse.status >= 500 ? 503 : 200,
        );
      }

      const aiJson = await aiResponse.json();
      const choice = aiJson.choices?.[0]?.message;
      if (!choice) return json({ error: "Empty AI response" }, 500);

      // No tool calls → we're done
      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        finalAssistantMessage = { content: choice.content ?? "" };
        break;
      }

      // Persist assistant message with tool calls
      const assistantMsgRecord = {
        conversation_id: conversationId,
        role: "assistant",
        content: choice.content ?? null,
        tool_calls: choice.tool_calls,
      };
      messages.push({
        role: "assistant",
        content: choice.content ?? null,
        tool_calls: choice.tool_calls,
      });

      // Execute each tool call and append results
      for (const toolCall of choice.tool_calls) {
        const name = toolCall.function.name;
        let args: any = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          args = {};
        }

        const { ok, result, error } = await executeTool(name, args, toolCtx);
        const resultContent = ok ? JSON.stringify(result) : JSON.stringify({ error });

        // If this was a propose_* call, remember the pending action id
        if (ok && result?.pending_action_id) {
          pendingActionIds.push(result.pending_action_id);
        }

        await admin.from("assistant_messages").insert({
          conversation_id: conversationId,
          role: "tool",
          content: resultContent,
          tool_call_id: toolCall.id,
          tool_name: name,
        });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: resultContent,
        });
      }

      // Also persist the assistant message that triggered the calls
      await admin.from("assistant_messages").insert(assistantMsgRecord);
    }

    if (!finalAssistantMessage) {
      // Hit iteration limit
      finalAssistantMessage = {
        content: "I worked on that but ran out of iterations. Try a simpler request, or check the dashboard.",
      };
    }

    // 5. Persist final assistant message and bump conversation timestamp
    const { data: savedFinal } = await admin
      .from("assistant_messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: finalAssistantMessage.content,
      })
      .select("id")
      .single();

    await admin
      .from("assistant_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    // Attach pending actions to the final message
    if (pendingActionIds.length > 0 && savedFinal) {
      await admin
        .from("assistant_pending_actions")
        .update({ message_id: (savedFinal as any).id })
        .in("id", pendingActionIds);
    }

    // Fetch pending action details to return
    const { data: pendingActions } = pendingActionIds.length > 0
      ? await admin
          .from("assistant_pending_actions")
          .select("id, action_type, action_summary, action_payload")
          .in("id", pendingActionIds)
      : { data: [] };

    return json({
      ok: true,
      conversation_id: conversationId,
      reply: finalAssistantMessage.content,
      pending_actions: pendingActions ?? [],
    });
  } catch (error) {
    console.error("assistant-chat error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// Convert stored history rows into OpenAI/Claude-compatible message format
function buildMessagesArray(rows: any[]): any[] {
  const out: any[] = [];
  for (const r of rows) {
    if (r.role === "user") {
      out.push({ role: "user", content: r.content });
    } else if (r.role === "assistant") {
      if (r.tool_calls) {
        out.push({
          role: "assistant",
          content: r.content,
          tool_calls: r.tool_calls,
        });
      } else {
        out.push({ role: "assistant", content: r.content });
      }
    } else if (r.role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: r.tool_call_id,
        content: r.content,
      });
    }
  }
  return out;
}
