import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const { data: authData, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { action, bookingId, scheduledStartAt, scheduledEndAt, groupLabel, internalNotes, appUrl } = await req.json();
    if (!action || !bookingId) return json({ error: "Missing action or bookingId" }, 400);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, customer_id, sitter_id, status, payment_amount_cents, services(name, slug), pets(name)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) return json({ error: "Booking not found" }, 404);

    const isSitter = booking.sitter_id === authData.user.id;
    const isCustomer = booking.customer_id === authData.user.id;
    if (!isSitter && !isCustomer) return json({ error: "Forbidden" }, 403);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", booking.customer_id)
      .maybeSingle();
    const { data: customerAuth } = await supabase.auth.admin.getUserById(booking.customer_id);
    const customerEmail = customerAuth.user?.email;
    const customerName = profile?.full_name || customerEmail || "there";

    if (action === "request_received") {
      if (!isCustomer) return json({ error: "Forbidden" }, 403);
      if (!customerEmail) return json({ error: "Missing customer email" }, 400);

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "walk-request-received",
          recipientEmail: customerEmail,
          idempotencyKey: `walk-request-${bookingId}`,
          templateData: {
            customerName,
            serviceName: booking.services?.name || "Walk",
            petName: booking.pets?.name || "your dog",
          },
        },
      });
      return json({ ok: true });
    }

    if (!isSitter) return json({ error: "Forbidden" }, 403);
    if (!scheduledStartAt || !scheduledEndAt) return json({ error: "Missing scheduled time" }, 400);

    const commonPatch = {
      scheduled_start_at: scheduledStartAt,
      scheduled_end_at: scheduledEndAt,
      approved_at: new Date().toISOString(),
      approved_by: authData.user.id,
      group_assignment_label: groupLabel || null,
      internal_notes: internalNotes || null,
    };

    if (action === "schedule_solo_walk") {
      const { error } = await supabase
        .from("bookings")
        .update({ ...commonPatch, status: "confirmed" })
        .eq("id", bookingId);
      if (error) return json({ error: error.message }, 400);
      if (!customerEmail) return json({ ok: true });

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "walk-schedule-confirmed",
          recipientEmail: customerEmail,
          idempotencyKey: `solo-confirmed-${bookingId}`,
          templateData: {
            customerName,
            serviceName: booking.services?.name || "Solo Walk",
            petName: booking.pets?.name || "your dog",
            scheduledStartAt,
          },
        },
      });
      return json({ ok: true });
    }

    if (action === "approve_group_walk") {
      const { error } = await supabase
        .from("bookings")
        .update({ ...commonPatch, status: "awaiting_payment" })
        .eq("id", bookingId);
      if (error) return json({ error: error.message }, 400);
      if (!customerEmail) return json({ ok: true });

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "group-walk-payment-request",
          recipientEmail: customerEmail,
          idempotencyKey: `group-payment-${bookingId}`,
          templateData: {
            customerName,
            serviceName: booking.services?.name || "Group Walk",
            petName: booking.pets?.name || "your dog",
            scheduledStartAt,
            groupLabel: groupLabel || "your matched group",
            payUrl: `${appUrl || req.headers.get("origin")}/booking/${bookingId}/checkout`,
          },
        },
      });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("booking-workflow error", error);
    return json({ error: (error as Error).message }, 500);
  }
});
