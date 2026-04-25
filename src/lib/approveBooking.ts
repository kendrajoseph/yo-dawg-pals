import { supabase } from "@/integrations/supabase/client";

/**
 * Shared approval / decline logic so the legacy /sitter-classic dashboard
 * and the new /sitter/requests/:id page stay in lock-step.
 *
 * Mirrors src/pages/SitterDashboard.tsx::approveRequest and ::declineRequest.
 */

export type ApproveBookingInput = {
  bookingId: string;
  sitterId: string;
  serviceSlug: string;
  serviceDurationMinutes: number;
  paymentMode: "full" | "deposit" | "free";
  // Times in HH:MM (24h) for the chosen day. For boarding the slug uses fixed checkin/checkout times.
  date: string; // yyyy-MM-dd
  startTime: string;
  endTime: string;
  endDate?: string; // yyyy-MM-dd, only used by boarding
  approvedBasePriceCents: number;
  extraTimeMinutes?: number;
  extraTimeFeeCents?: number;
  latePickupFeeCents?: number;
  groupLabel?: string | null;
  internalNotes?: string | null;
  appUrl: string;
};

export type ApproveBookingResult = {
  ok: boolean;
  status?: "confirmed" | "awaiting_payment";
  error?: string;
  notificationStatus?: string;
  notificationMessage?: string;
};

const timeToMinutes = (value: string): number => {
  const [h = "0", m = "0"] = value.split(":");
  return Number(h) * 60 + Number(m);
};

export async function approveBooking(input: ApproveBookingInput): Promise<ApproveBookingResult> {
  const {
    bookingId,
    sitterId,
    serviceSlug,
    serviceDurationMinutes,
    paymentMode,
    date,
    startTime,
    endTime,
    endDate,
    approvedBasePriceCents,
    extraTimeMinutes = 0,
    extraTimeFeeCents = 0,
    latePickupFeeCents = 0,
    groupLabel,
    internalNotes,
    appUrl,
  } = input;

  const startMinute = timeToMinutes(startTime);
  const endMinute = timeToMinutes(endTime);
  if (serviceSlug !== "boarding" && endMinute <= startMinute) {
    return { ok: false, error: "End time must be after start time." };
  }
  if (serviceSlug !== "boarding" && endMinute - startMinute < serviceDurationMinutes) {
    return { ok: false, error: `This service needs at least ${serviceDurationMinutes} minutes.` };
  }

  const startAt = new Date(`${date}T00:00:00`);
  startAt.setMinutes(startMinute);
  const endAt = new Date(`${endDate || date}T00:00:00`);
  endAt.setMinutes(endMinute);

  const totalCents = approvedBasePriceCents + extraTimeFeeCents + latePickupFeeCents;
  const paymentAmount =
    paymentMode === "free" ? 0 : paymentMode === "deposit" ? Math.round(totalCents * 0.25) : totalCents;
  const nextStatus: "confirmed" | "awaiting_payment" =
    paymentMode === "free" ? "confirmed" : "awaiting_payment";

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      scheduled_start_at: startAt.toISOString(),
      scheduled_end_at: endAt.toISOString(),
      approved_at: new Date().toISOString(),
      approved_by: sitterId,
      group_assignment_label: groupLabel || null,
      internal_notes: internalNotes || null,
      base_price_cents: approvedBasePriceCents,
      extra_time_minutes: extraTimeMinutes,
      extra_time_fee_cents: extraTimeFeeCents,
      late_pickup_fee_cents: latePickupFeeCents,
      total_cents: totalCents,
      payment_amount_cents: paymentAmount,
      status: nextStatus,
    })
    .eq("id", bookingId);

  if (updateError) return { ok: false, error: updateError.message };

  const workflowAction = nextStatus === "confirmed" ? "schedule_solo_walk" : "approve_group_walk";
  const { error: workflowError, data: workflowData } = await supabase.functions.invoke(
    "booking-workflow",
    {
      body: {
        action: workflowAction,
        bookingId,
        scheduledStartAt: startAt.toISOString(),
        scheduledEndAt: endAt.toISOString(),
        groupLabel: groupLabel || null,
        internalNotes: internalNotes || null,
        appUrl,
      },
    },
  );

  if (workflowError) {
    return {
      ok: true,
      status: nextStatus,
      notificationStatus: "failed",
      notificationMessage: workflowError.message,
    };
  }

  // Best-effort audit entry — failures here don't block the approval
  await supabase.from("booking_updates").insert({
    booking_id: bookingId,
    created_by: sitterId,
    kind: "approval",
    message: `Approved (${nextStatus.replace(/_/g, " ")}).`,
    sent_via_sms: false,
  });

  return {
    ok: true,
    status: nextStatus,
    notificationStatus: (workflowData as any)?.notificationStatus,
    notificationMessage: (workflowData as any)?.notificationMessage,
  };
}

export async function declineBooking(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setPetServiceFit(
  sitterId: string,
  petId: string,
  serviceId: string,
  status: "approved" | "declined" | "pending",
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("sitter_pet_approvals").upsert(
    { sitter_id: sitterId, pet_id: petId, service_id: serviceId, status, notes: notes ?? null },
    { onConflict: "sitter_id,pet_id,service_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
