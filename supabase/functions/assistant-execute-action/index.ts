// ============================================================================
// FILE: supabase/functions/assistant-execute-action/index.ts
// ============================================================================
// Called when AJ taps "Confirm" on a pending action.
// Executes the action against existing edge functions or direct DB writes.
// ============================================================================

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const bodySchema = z.object({
  pending_action_id: z.string().uuid(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // 1. Load and verify the pending action
    const { data: action, error: aErr } = await admin
      .from("assistant_pending_actions")
      .select("*")
      .eq("id", parsed.data.pending_action_id)
      .single();

    if (aErr || !action) return json({ error: "Action not found" }, 404);
    if ((action as any).sitter_id !== user.id) return json({ error: "Forbidden" }, 403);
    if ((action as any).status !== "pending") {
      return json({ error: `Action already ${(action as any).status}` }, 400);
    }
    if (new Date((action as any).expires_at) < new Date()) {
      await admin
        .from("assistant_pending_actions")
        .update({ status: "expired" })
        .eq("id", (action as any).id);
      return json({ error: "Action expired" }, 400);
    }

    // 2. Dispatch on action_type
    const a = action as any;
    let result: any;
    let success = false;

    try {
      switch (a.action_type) {
        case "block_date": {
          const { error } = await admin
            .from("blocked_dates")
            .insert({
              sitter_id: user.id,
              blocked_date: a.action_payload.date,
              reason: a.action_payload.reason,
            });
          if (error) throw new Error(error.message);
          result = { blocked: a.action_payload.date };
          success = true;
          break;
        }

        case "send_payment_reminder": {
          const { data, error } = await admin.functions.invoke("send-payment-reminder", {
            headers: { Authorization: `Bearer ${serviceKey}` },
            body: { invoice_id: a.action_payload.invoice_id },
          });
          if (error) throw new Error(error.message);
          result = data;
          success = true;
          break;
        }

        case "approve_booking": {
          // Use the existing approval flow via booking-workflow
          const { data, error } = await admin.functions.invoke("booking-workflow", {
            headers: { Authorization: `Bearer ${serviceKey}` },
            body: {
              action: "approve",
              booking_id: a.action_payload.booking_id,
            },
          });
          if (error) throw new Error(error.message);
          result = data;
          success = true;
          break;
        }

        case "mark_invoice_paid": {
          // Update invoice status directly
          const { data: inv } = await admin
            .from("invoices")
            .select("total_cents")
            .eq("id", a.action_payload.invoice_id)
            .single();
          if (!inv) throw new Error("Invoice not found");

          const { error } = await admin
            .from("invoices")
            .update({
              status: "paid",
              amount_paid_cents: (inv as any).total_cents,
              paid_at: new Date().toISOString(),
              payment_method: a.action_payload.payment_method,
              admin_notes: a.action_payload.note,
            })
            .eq("id", a.action_payload.invoice_id)
            .eq("sitter_id", user.id);
          if (error) throw new Error(error.message);
          result = { invoice_id: a.action_payload.invoice_id, marked_paid: true };
          success = true;
          break;
        }

        case "send_client_message": {
          const { data, error } = await admin.functions.invoke("send-client-message", {
            headers: { Authorization: `Bearer ${serviceKey}` },
            body: {
              clientId: a.action_payload.client_id,
              subject: a.action_payload.subject,
              body: a.action_payload.body,
            },
          });
          if (error) throw new Error(error.message);
          result = data;
          success = true;
          break;
        }

        default:
          throw new Error(`Unknown action type: ${a.action_type}`);
      }

      // 3. Mark as confirmed and store result
      await admin
        .from("assistant_pending_actions")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          result,
        })
        .eq("id", a.id);

      return json({ ok: true, result });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      await admin
        .from("assistant_pending_actions")
        .update({
          status: "failed",
          result: { error: errorMsg },
        })
        .eq("id", a.id);
      return json({ error: errorMsg }, 500);
    }
  } catch (error) {
    console.error("assistant-execute-action error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
