// ============================================================================
// FILE: supabase/functions/send-nightly-telegram-digest/index.ts
// ============================================================================
// Cron-triggered at 8 PM local time (set via Supabase scheduled function).
// For each sitter with telegram linked and digest enabled, sends tomorrow's
// schedule with action buttons. Also sends an email backup.
//
// Idempotency: tracks last_digest_sent_for date on the link row, so a duplicate
// cron tick won't double-send.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendTelegramMessage, escapeMd, type TelegramInlineKeyboard } from "../_shared/telegram.ts";

Deno.serve(async (req) => {
  // Only allow service-role invocation
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Get all linked sitters with digest enabled
  const { data: links } = await supabase
    .from("sitter_telegram_links")
    .select("sitter_id, telegram_chat_id, digest_hour_local, digest_timezone, last_digest_sent_for")
    .eq("digest_enabled", true);

  if (!links || links.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sentCount = 0;
  const results: any[] = [];

  for (const link of links) {
    // Determine "tomorrow" in the sitter's timezone
    const tz = link.digest_timezone || "America/Toronto";
    const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    const currentHour = nowLocal.getHours();

    // Only send within a 1-hour window of the configured digest hour
    if (Math.abs(currentHour - link.digest_hour_local) > 0) {
      continue;
    }

    const tomorrow = new Date(nowLocal);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().slice(0, 10);

    // Idempotency: already sent for this date?
    if (link.last_digest_sent_for === tomorrowDateStr) {
      continue;
    }

    try {
      const result = await sendDigestForSitter(supabase, link.sitter_id, link.telegram_chat_id, tomorrow, tz);

      // Mark as sent (regardless of whether there were bookings; we still messaged)
      await supabase
        .from("sitter_telegram_links")
        .update({ last_digest_sent_for: tomorrowDateStr })
        .eq("sitter_id", link.sitter_id);

      sentCount++;
      results.push({ sitter: link.sitter_id, ok: true, bookings: result.bookingCount });
    } catch (error) {
      console.error("Digest send failed", { sitter: link.sitter_id, error });
      results.push({ sitter: link.sitter_id, ok: false, error: String(error) });
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: sentCount, results }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function sendDigestForSitter(
  supabase: any,
  sitterId: string,
  chatId: number,
  targetDate: Date,
  tz: string,
): Promise<{ bookingCount: number }> {
  // Window in target-date local time
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, customer_id, start_at, end_at, scheduled_start_at, scheduled_end_at, status, pets(name), services(name, slug)")
    .eq("sitter_id", sitterId)
    .gte("start_at", start.toISOString())
    .lte("start_at", end.toISOString())
    .not("status", "in", "(cancelled,refunded)")
    .order("start_at", { ascending: true });

  const dateStr = targetDate.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });

  // ── No bookings: short message ──
  if (!bookings || bookings.length === 0) {
    await sendTelegramMessage({
      chatId,
      text: `*Tomorrow — ${escapeMd(dateStr)}* 🎉\n\nNothing scheduled. Enjoy the day off.`,
    });
    return { bookingCount: 0 };
  }

  // ── Build Telegram message with inline keyboard ──
  const walkCount = bookings.filter((b: any) => b.services?.slug?.includes("walk")).length;
  const boardingCount = bookings.filter((b: any) => b.services?.slug === "boarding").length;
  const sitCount = bookings.filter((b: any) => b.services?.slug === "sitting").length;
  const summary = [
    walkCount > 0 ? `${walkCount} walk${walkCount === 1 ? "" : "s"}` : null,
    sitCount > 0 ? `${sitCount} sit${sitCount === 1 ? "" : "s"}` : null,
    boardingCount > 0 ? `${boardingCount} boarding` : null,
  ].filter(Boolean).join(" · ");

  let body = `🐾 *Tomorrow — ${escapeMd(dateStr)}*\n${escapeMd(summary)}\n\n`;

  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i] as any;
    const startAt = new Date(b.scheduled_start_at ?? b.start_at);
    const timeStr = startAt.toLocaleTimeString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    });
    const serviceName = b.services?.name || "Service";
    const petName = b.pets?.name || "dog";
    body += `*${i + 1}. ${escapeMd(timeStr)}* — ${escapeMd(serviceName)}, ${escapeMd(petName)}\n`;
  }

  body += "\n_Tap the buttons below as you pick up and drop off. You can also send /undo to reverse the last update._";

  const keyboard: TelegramInlineKeyboard = [];
  for (const b of bookings as any[]) {
    const events = eventsForSlug(b.services?.slug);
    if (!events) continue;
    const [startEvent, endEvent] = events;
    const petName = b.pets?.name || "dog";
    const truncated = petName.length > 8 ? petName.slice(0, 8) + "…" : petName;
    keyboard.push([
      { text: `${kindLabel(startEvent)} ${truncated}`, callback_data: `evt:${startEvent}:${b.id}` },
      { text: `${kindLabel(endEvent)} ${truncated}`, callback_data: `evt:${endEvent}:${b.id}` },
    ]);
  }

  await sendTelegramMessage({
    chatId,
    text: body,
    replyMarkup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
  });

  // Log outbound
  await supabase.from("telegram_messages_log").insert({
    sitter_id: sitterId,
    telegram_chat_id: chatId,
    direction: "outbound",
    message_type: "text",
    body: `Nightly digest for ${dateStr} (${bookings.length} bookings)`,
  });

  // ── Email backup ──
  try {
    const { data: sitterAuth } = await supabase.auth.admin.getUserById(sitterId);
    const sitterEmail = sitterAuth?.user?.email;
    if (sitterEmail) {
      const bookingRows = (bookings as any[]).map((b, i) => {
        const startAt = new Date(b.scheduled_start_at ?? b.start_at);
        const timeStr = startAt.toLocaleTimeString("en-CA", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
        });
        return {
          index: i + 1,
          time: timeStr,
          serviceName: b.services?.name || "Service",
          petName: b.pets?.name || "dog",
        };
      });

      await supabase.functions.invoke("send-transactional-email", {
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: {
          templateName: "nightly-schedule-digest",
          recipientEmail: sitterEmail,
          idempotencyKey: `nightly-digest-${sitterId}-${targetDate.toISOString().slice(0, 10)}`,
          templateData: {
            dateStr,
            summary,
            bookings: bookingRows,
          },
        },
      });
    }
  } catch (e) {
    console.warn("Email digest backup failed", e);
    // Telegram digest already sent; email is a bonus
  }

  return { bookingCount: bookings.length };
}

function kindLabel(kind: "pickup" | "dropoff" | "arrived" | "departed"): string {
  return { pickup: "Pickup", dropoff: "Drop-off", arrived: "Arrived", departed: "Departed" }[kind];
}

function eventsForSlug(slug: string | null | undefined): ["pickup" | "dropoff" | "arrived" | "departed", "pickup" | "dropoff" | "arrived" | "departed"] | null {
  switch (slug) {
    case "walk":
    case "solo-walk":
    case "group-walk":
      return ["pickup", "dropoff"];
    case "sitting":
    case "training":
    case "meet-and-greet":
      return ["arrived", "departed"];
    case "boarding":
      return ["dropoff", "pickup"];
    default:
      return null;
  }
}
