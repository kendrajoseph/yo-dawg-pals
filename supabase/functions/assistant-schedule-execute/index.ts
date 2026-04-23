import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.1";

const blockSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  maxBookings: z.number().int().min(1).max(20).optional(),
  serviceSlugs: z.array(z.string()).min(1),
});

const windowSchema = z.object({
  mode: z.enum(["upsert", "delete"]),
  weekday: z.number().int().min(0).max(6),
  serviceSlug: z.string(),
  label: z.string().min(1),
  startMinute: z.number().int().min(0).max(1439).optional(),
  endMinute: z.number().int().min(1).max(1440).optional(),
  maxBookings: z.number().int().min(1).max(20).optional(),
});

const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_availability_blocks"), summary: z.string(), blocks: z.array(blockSchema).min(1) }),
  z.object({ type: z.literal("update_walk_windows"), summary: z.string(), windows: z.array(windowSchema).min(1) }),
  z.object({
    type: z.literal("add_blocked_dates"),
    summary: z.string(),
    entries: z.array(z.object({ date: z.string(), reason: z.string().nullable().optional() })).min(1),
  }),
  z.object({
    type: z.literal("approve_requests"),
    summary: z.string(),
    decision: z.enum(["approve", "decline"]),
    filters: z.object({
      statuses: z.array(z.string()).optional(),
      serviceSlugs: z.array(z.string()).optional(),
      requestGroupLabel: z.string().nullable().optional(),
      customerName: z.string().nullable().optional(),
      bookingIds: z.array(z.string()).optional(),
      relativeWindow: z.enum(["recent", "today", "all"]).optional(),
    }),
  }),
  z.object({ type: z.literal("send_preview_notifications"), summary: z.string(), bookingIds: z.array(z.string()).min(1) }),
]);

const bodySchema = z.object({
  operations: z.array(operationSchema).min(1),
  appUrl: z.string().url().optional(),
  previewOnly: z.boolean().default(false),
});

const MIN_BUFFER_MINUTES = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hasBufferedMinuteConflict = (ranges: Array<{ start: number; end: number }>, start: number, end: number) =>
  ranges.some((range) => start < range.end + MIN_BUFFER_MINUTES && end > range.start - MIN_BUFFER_MINUTES);

const formatDateKey = (value: string | null | undefined) => (value ? value.slice(0, 10) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
    if (!supabaseAnonKey) throw new Error("SUPABASE_ANON_KEY is not configured");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await client.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const userId = claimsData.claims.sub;
    const [{ data: roles, error: rolesError }, { data: profileUser, error: profileUserError }] = await Promise.all([
      client.from("user_roles").select("role").eq("user_id", userId),
      admin.auth.admin.getUserById(userId),
    ]);
    if (rolesError) return json({ error: rolesError.message }, 403);
    if (profileUserError || !profileUser.user) return json({ error: "Unable to verify user" }, 401);

    const roleSet = new Set((roles ?? []).map((row) => row.role));
    if (!roleSet.has("admin") && !roleSet.has("sitter")) return json({ error: "Forbidden" }, 403);

    const [serviceRows, availabilityRows, availabilityServiceRows, walkWindowRows, blockedDateRows, bookingRows, profileRows, approvalRows] = await Promise.all([
      admin.from("services").select("id, name, slug, payment_mode, duration_minutes, boarding_checkin_minute, boarding_checkout_minute, extra_time_fee_cents, extra_time_increment_minutes, late_pickup_fee_cents, requires_pet_approval, approval_required").eq("is_active", true),
      admin.from("availability").select("id, weekday, start_minute, end_minute, max_bookings").eq("sitter_id", userId),
      admin.from("availability_services").select("availability_id, service_id"),
      admin.from("walk_windows").select("id, service_id, weekday, start_minute, end_minute, window_label, max_bookings, sort_order").eq("sitter_id", userId),
      admin.from("blocked_dates").select("id, blocked_date, reason").eq("sitter_id", userId),
      admin.from("bookings").select("id, customer_id, sitter_id, pet_id, service_id, service_variant_id, status, booking_kind, requested_date, requested_end_date, requested_window_label, requested_window_start_minute, requested_window_end_minute, request_group_id, request_group_label, recurrence_label, start_at, end_at, scheduled_start_at, scheduled_end_at, services(name, slug, payment_mode, duration_minutes, boarding_checkin_minute, boarding_checkout_minute, requires_pet_approval), service_variants(name, duration_minutes, payment_mode, price_cents), pets(name)").eq("sitter_id", userId).order("created_at", { ascending: false }),
      admin.from("profiles").select("id, full_name").neq("id", "00000000-0000-0000-0000-000000000000"),
      admin.from("sitter_pet_approvals").select("pet_id, service_id, status").eq("sitter_id", userId),
    ]);

    const services = serviceRows.data ?? [];
    const availability = availabilityRows.data ?? [];
    const availabilityLinks = availabilityServiceRows.data ?? [];
    const walkWindows = walkWindowRows.data ?? [];
    const blockedDates = blockedDateRows.data ?? [];
    const bookings = (bookingRows.data ?? []) as any[];
    const profiles = new Map((profileRows.data ?? []).map((row) => [row.id, row.full_name || "Client"]));
    const approvals = new Map((approvalRows.data ?? []).map((row) => [`${row.pet_id}:${row.service_id}`, row.status]));
    const servicesBySlug = new Map(services.map((service) => [service.slug, service]));
    const servicesById = new Map(services.map((service) => [service.id, service]));

    const applied: Array<{ type: string; count: number }> = [];
    const warnings: string[] = [];
    const followUpQuestions: string[] = [];
    const notificationPreview: Array<any> = [];

    for (const operation of parsed.data.operations) {
      if (operation.type === "create_availability_blocks") {
        let count = 0;
        for (const block of operation.blocks) {
          if (block.endMinute <= block.startMinute) {
            warnings.push(`Skipped ${operation.summary}: end time must be after start time.`);
            continue;
          }

          const sameDayRanges = availability.filter((row) => row.weekday === block.weekday).map((row) => ({ start: row.start_minute, end: row.end_minute }));
          if (hasBufferedMinuteConflict(sameDayRanges, block.startMinute, block.endMinute)) {
            warnings.push(`Skipped a block on weekday ${block.weekday} because it conflicts with an existing availability block.`);
            continue;
          }

          const serviceIds = block.serviceSlugs.map((slug) => servicesBySlug.get(slug)?.id).filter(Boolean) as string[];
          if (serviceIds.length !== block.serviceSlugs.length) {
            warnings.push(`Skipped a block because one or more services were not recognized.`);
            continue;
          }

          if (!parsed.data.previewOnly) {
            const { data: inserted, error } = await admin.from("availability").insert({
              sitter_id: userId,
              weekday: block.weekday,
              start_minute: block.startMinute,
              end_minute: block.endMinute,
              max_bookings: block.maxBookings ?? 1,
            }).select("id, weekday, start_minute, end_minute, max_bookings").single();
            if (error || !inserted) {
              warnings.push(`Could not create an availability block: ${error?.message ?? "unknown error"}`);
              continue;
            }

            const linkRows = serviceIds.map((serviceId) => ({ availability_id: inserted.id, service_id: serviceId }));
            const { error: linkError } = await admin.from("availability_services").insert(linkRows);
            if (linkError) {
              warnings.push(`Created a block but failed to attach services: ${linkError.message}`);
            }
            availability.push(inserted);
            availabilityLinks.push(...linkRows);
          }
          count += 1;
        }
        applied.push({ type: operation.type, count });
      }

      if (operation.type === "update_walk_windows") {
        let count = 0;
        for (const window of operation.windows) {
          const service = servicesBySlug.get(window.serviceSlug);
          if (!service) {
            warnings.push(`Skipped walk window for ${window.serviceSlug} because that service was not found.`);
            continue;
          }

          const existing = walkWindows.find(
            (item) => item.weekday === window.weekday && item.service_id === service.id && item.window_label.toLowerCase() === window.label.toLowerCase(),
          );

          if (window.mode === "delete") {
            if (!existing) {
              warnings.push(`No existing walk window matched ${window.label} on weekday ${window.weekday}.`);
              continue;
            }
            if (!parsed.data.previewOnly) {
              const { error } = await admin.from("walk_windows").delete().eq("id", existing.id);
              if (error) {
                warnings.push(`Could not delete walk window ${window.label}: ${error.message}`);
                continue;
              }
            }
            count += 1;
            continue;
          }

          if (window.startMinute == null || window.endMinute == null || window.endMinute <= window.startMinute) {
            warnings.push(`Skipped ${window.label} because its time range is incomplete.`);
            continue;
          }

          const sameDayRanges = walkWindows
            .filter((item) => item.weekday === window.weekday && item.id !== existing?.id)
            .map((item) => ({ start: item.start_minute, end: item.end_minute }));

          if (hasBufferedMinuteConflict(sameDayRanges, window.startMinute, window.endMinute)) {
            warnings.push(`Skipped ${window.label} because walk windows need a 30 minute gap.`);
            continue;
          }

          if (!parsed.data.previewOnly) {
            if (existing) {
              const { error } = await admin.from("walk_windows").update({
                start_minute: window.startMinute,
                end_minute: window.endMinute,
                max_bookings: window.maxBookings ?? existing.max_bookings,
                window_label: window.label,
                service_id: service.id,
              }).eq("id", existing.id);
              if (error) {
                warnings.push(`Could not update walk window ${window.label}: ${error.message}`);
                continue;
              }
            } else {
              const sortOrder = walkWindows.filter((item) => item.weekday === window.weekday && item.service_id === service.id).length;
              const { error } = await admin.from("walk_windows").insert({
                sitter_id: userId,
                service_id: service.id,
                weekday: window.weekday,
                start_minute: window.startMinute,
                end_minute: window.endMinute,
                window_label: window.label,
                max_bookings: window.maxBookings ?? 4,
                sort_order: sortOrder,
              });
              if (error) {
                warnings.push(`Could not create walk window ${window.label}: ${error.message}`);
                continue;
              }
            }
          }
          count += 1;
        }
        applied.push({ type: operation.type, count });
      }

      if (operation.type === "add_blocked_dates") {
        let count = 0;
        for (const entry of operation.entries) {
          const exists = blockedDates.some((item) => formatDateKey(item.blocked_date) === entry.date);
          if (exists) {
            warnings.push(`Skipped ${entry.date} because it is already blocked.`);
            continue;
          }
          if (!parsed.data.previewOnly) {
            const { error } = await admin.from("blocked_dates").insert({ sitter_id: userId, blocked_date: entry.date, reason: entry.reason ?? null });
            if (error) {
              warnings.push(`Could not block ${entry.date}: ${error.message}`);
              continue;
            }
          }
          count += 1;
        }
        applied.push({ type: operation.type, count });
      }

      if (operation.type === "approve_requests") {
        const statuses = operation.filters.statuses ?? ["requested"];
        let targetBookings = bookings.filter((booking) => statuses.includes(booking.status));

        if (operation.filters.serviceSlugs?.length) {
          targetBookings = targetBookings.filter((booking) => operation.filters.serviceSlugs?.includes(booking.services?.slug));
        }
        if (operation.filters.bookingIds?.length) {
          const idSet = new Set(operation.filters.bookingIds);
          targetBookings = targetBookings.filter((booking) => idSet.has(booking.id));
        }
        if (operation.filters.requestGroupLabel) {
          const match = operation.filters.requestGroupLabel.toLowerCase();
          targetBookings = targetBookings.filter((booking) => (booking.request_group_label ?? "").toLowerCase().includes(match));
        }
        if (operation.filters.customerName) {
          const match = operation.filters.customerName.toLowerCase();
          targetBookings = targetBookings.filter((booking) => (profiles.get(booking.customer_id) ?? "").toLowerCase().includes(match));
        }
        if (operation.filters.relativeWindow === "today") {
          const today = new Date().toISOString().slice(0, 10);
          targetBookings = targetBookings.filter((booking) => formatDateKey(booking.requested_date ?? booking.start_at) === today);
        }
        if (operation.filters.relativeWindow === "recent") {
          targetBookings = targetBookings.slice(0, 5);
        }

        if (targetBookings.length === 0) {
          warnings.push(`No bookings matched the request action: ${operation.summary}`);
          applied.push({ type: operation.type, count: 0 });
          continue;
        }

        if (operation.decision === "decline") {
          if (!parsed.data.previewOnly) {
            const ids = targetBookings.map((booking) => booking.id);
            const { error } = await admin.from("bookings").update({ status: "cancelled" }).in("id", ids);
            if (error) {
              warnings.push(`Could not decline matching requests: ${error.message}`);
              applied.push({ type: operation.type, count: 0 });
              continue;
            }
          }
          applied.push({ type: operation.type, count: targetBookings.length });
          continue;
        }

        let approvedCount = 0;
        for (const booking of targetBookings) {
          const service = servicesById.get(booking.service_id) ?? booking.services;
          const paymentMode = booking.service_variants?.payment_mode ?? service?.payment_mode ?? "deposit";
          const petApprovalStatus = approvals.get(`${booking.pet_id}:${booking.service_id}`);

          if (service?.requires_pet_approval && petApprovalStatus !== "approved") {
            warnings.push(`Skipped ${booking.pets?.name ?? "pet"} for ${service?.name ?? "service"} because pet approval is still pending.`);
            continue;
          }

          if (!booking.requested_date || booking.requested_window_start_minute == null || booking.requested_window_end_minute == null) {
            followUpQuestions.push(`Add a confirmed time for ${booking.pets?.name ?? "this request"} before auto-approving it.`);
            continue;
          }

          const startAt = new Date(`${booking.requested_date}T00:00:00`);
          startAt.setMinutes(booking.requested_window_start_minute);
          const endDate = booking.requested_end_date ?? booking.requested_date;
          const endAt = new Date(`${endDate}T00:00:00`);
          endAt.setMinutes(booking.requested_window_end_minute);

          const hasConflict = bookings.some((existing) => {
            if (existing.id === booking.id || ["cancelled", "completed", "refunded"].includes(existing.status)) return false;
            const existingStart = new Date(existing.scheduled_start_at ?? existing.start_at).getTime();
            const existingEnd = new Date(existing.scheduled_end_at ?? existing.end_at).getTime();
            const nextStart = startAt.getTime();
            const nextEnd = endAt.getTime();
            return nextStart < existingEnd + MIN_BUFFER_MINUTES * 60 * 1000 && nextEnd > existingStart - MIN_BUFFER_MINUTES * 60 * 1000;
          });
          if (hasConflict) {
            warnings.push(`Skipped ${booking.pets?.name ?? "request"} because it overlaps another booking.`);
            continue;
          }

          const nextStatus = paymentMode === "free" ? "confirmed" : "awaiting_payment";
          const payload = {
            scheduled_start_at: startAt.toISOString(),
            scheduled_end_at: endAt.toISOString(),
            approved_at: new Date().toISOString(),
            approved_by: userId,
            group_assignment_label: booking.requested_window_label ?? null,
            base_price_cents: booking.service_variants?.price_cents ?? 0,
            payment_amount_cents: paymentMode === "free" ? 0 : booking.service_variants?.price_cents ?? 0,
            total_cents: booking.service_variants?.price_cents ?? 0,
            status: nextStatus,
          };

          if (!parsed.data.previewOnly) {
            const { error } = await admin.from("bookings").update(payload).eq("id", booking.id);
            if (error) {
              warnings.push(`Could not approve ${booking.id}: ${error.message}`);
              continue;
            }
          }

          if (nextStatus === "confirmed" || nextStatus === "awaiting_payment") {
            const authUser = await admin.auth.admin.getUserById(booking.customer_id);
            notificationPreview.push({
              bookingId: booking.id,
              recipientName: profiles.get(booking.customer_id) ?? "Client",
              recipientEmail: authUser.data.user?.email ?? "",
              serviceName: service?.name ?? booking.services?.name ?? "Service",
              petName: booking.pets?.name ?? "your dog",
              templateName: nextStatus === "confirmed" ? "walk-schedule-confirmed" : "group-walk-payment-request",
              statusAfter: nextStatus,
              scheduledStartAt: startAt.toISOString(),
              groupLabel: booking.requested_window_label ?? null,
              payUrl: nextStatus === "awaiting_payment" ? `${parsed.data.appUrl ?? req.headers.get("origin")}/booking/${booking.id}/checkout` : null,
            });
          }

          approvedCount += 1;
        }
        applied.push({ type: operation.type, count: approvedCount });
      }

      if (operation.type === "send_preview_notifications") {
        const idSet = new Set(operation.bookingIds);
        const matching = notificationPreview.filter((item) => idSet.has(item.bookingId));
        if (matching.length === 0) warnings.push("No notification previews were ready for the selected bookings yet.");
        applied.push({ type: operation.type, count: matching.length });
      }
    }

    return json({
      ok: true,
      summary: applied.map((item) => `${item.count} ${item.type}`).join(" · "),
      warnings,
      followUpQuestions,
      applied,
      notificationPreview,
    });
  } catch (error) {
    console.error("assistant-schedule-execute error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});