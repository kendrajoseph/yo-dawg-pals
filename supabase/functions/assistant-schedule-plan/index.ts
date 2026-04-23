import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const bodySchema = z.object({
  command: z.string().trim().min(3).max(2000),
  context: z.object({
    today: z.string(),
    services: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        duration_minutes: z.number(),
        payment_mode: z.enum(["full", "deposit", "free"]),
        scheduling_mode: z.enum(["instant", "request", "boarding"]),
        requires_pet_approval: z.boolean(),
        approval_required: z.boolean(),
      }),
    ),
    availability: z.array(
      z.object({
        id: z.string(),
        weekday: z.number(),
        start_minute: z.number(),
        end_minute: z.number(),
        max_bookings: z.number(),
        service_slugs: z.array(z.string()),
      }),
    ),
    walkWindows: z.array(
      z.object({
        id: z.string(),
        service_slug: z.string(),
        weekday: z.number(),
        start_minute: z.number(),
        end_minute: z.number(),
        window_label: z.string(),
        max_bookings: z.number(),
      }),
    ),
    blockedDates: z.array(
      z.object({
        id: z.string(),
        blocked_date: z.string(),
        reason: z.string().nullable(),
      }),
    ),
    requestGroups: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        bookings: z.array(
          z.object({
            id: z.string(),
            status: z.string(),
            service_slug: z.string().nullable(),
            service_name: z.string().nullable(),
            pet_name: z.string().nullable(),
            customer_name: z.string(),
            booking_kind: z.string().nullable(),
            requested_date: z.string().nullable(),
            requested_end_date: z.string().nullable(),
            requested_window_label: z.string().nullable(),
            requested_window_start_minute: z.number().nullable(),
            requested_window_end_minute: z.number().nullable(),
            recurrence_label: z.string().nullable(),
            request_group_id: z.string().nullable(),
            request_group_label: z.string().nullable(),
          }),
        ),
      }),
    ),
  }),
});

const planTool = {
  type: "function",
  function: {
    name: "return_schedule_plan",
    description: "Return a structured assistant action plan for the sitter schedule and approvals.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        intent: { type: "string" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        warnings: { type: "array", items: { type: "string" } },
        followUpQuestions: { type: "array", items: { type: "string" } },
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "create_availability_blocks",
                  "update_walk_windows",
                  "add_blocked_dates",
                  "approve_requests",
                  "send_preview_notifications",
                ],
              },
              summary: { type: "string" },
              blocks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    weekday: { type: "number" },
                    startMinute: { type: "number" },
                    endMinute: { type: "number" },
                    maxBookings: { type: "number" },
                    serviceSlugs: { type: "array", items: { type: "string" } },
                  },
                  required: ["weekday", "startMinute", "endMinute", "serviceSlugs"],
                  additionalProperties: false,
                },
              },
              windows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    mode: { type: "string", enum: ["upsert", "delete"] },
                    weekday: { type: "number" },
                    serviceSlug: { type: "string" },
                    label: { type: "string" },
                    startMinute: { type: "number" },
                    endMinute: { type: "number" },
                    maxBookings: { type: "number" },
                  },
                  required: ["mode", "weekday", "serviceSlug", "label"],
                  additionalProperties: false,
                },
              },
              entries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string" },
                    reason: { type: ["string", "null"] },
                  },
                  required: ["date"],
                  additionalProperties: false,
                },
              },
              decision: { type: "string", enum: ["approve", "decline"] },
              filters: {
                type: "object",
                properties: {
                  statuses: { type: "array", items: { type: "string" } },
                  serviceSlugs: { type: "array", items: { type: "string" } },
                  requestGroupLabel: { type: ["string", "null"] },
                  customerName: { type: ["string", "null"] },
                  bookingIds: { type: "array", items: { type: "string" } },
                  relativeWindow: { type: "string", enum: ["recent", "today", "all"] },
                },
                additionalProperties: false,
              },
              bookingIds: { type: "array", items: { type: "string" } },
            },
            required: ["type", "summary"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "intent", "confidence", "warnings", "followUpQuestions", "operations"],
      additionalProperties: false,
    },
  },
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const systemPrompt = `You are a scheduling assistant for a pet care business. Convert natural language admin or sitter commands into safe structured operations only.

Rules:
- Never invent IDs. Use bookingIds only when they exactly match items in context.
- Use weekday numbers 0=Sun through 6=Sat.
- Availability blocks represent exact availability with one or more service slugs.
- Walk windows are for group/pack scheduling windows and must name the matching service slug.
- If a command is ambiguous, return followUpQuestions and no risky operations.
- For approval commands, prefer broad filters instead of guessing times.
- Include warnings whenever approvals still need manual schedule details or pet approvals.
- If the user asks to notify clients, include a send_preview_notifications operation rather than assuming messages are sent.
- Be concise and structured.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
    if (!supabaseAnonKey) throw new Error("SUPABASE_ANON_KEY is not configured");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await client.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const { data: roles, error: roleError } = await client.from("user_roles").select("role").eq("user_id", claimsData.claims.sub);
    if (roleError) return json({ error: roleError.message }, 403);

    const roleSet = new Set((roles ?? []).map((row) => row.role));
    if (!roleSet.has("admin") && !roleSet.has("sitter")) return json({ error: "Forbidden" }, 403);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              command: parsed.data.command,
              context: parsed.data.context,
            }),
          },
        ],
        tools: [planTool],
        tool_choice: { type: "function", function: { name: "return_schedule_plan" } },
      }),
    });

    if (aiResponse.status === 429) return json({ error: "Lovable AI rate limit reached. Try again in a moment." }, 429);
    if (aiResponse.status === 402) return json({ error: "Lovable AI credits are unavailable right now." }, 402);
    if (!aiResponse.ok) return json({ error: `Lovable AI planning failed (${aiResponse.status})` }, 500);

    const aiJson = await aiResponse.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) return json({ error: "Assistant plan could not be generated." }, 500);

    return json({ ok: true, plan: JSON.parse(args) });
  } catch (error) {
    console.error("assistant-schedule-plan error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});