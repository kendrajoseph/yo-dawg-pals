// ============================================================================
// FILE: supabase/functions/handle-telegram-webhook/index.ts
// ============================================================================
// Receives all Telegram updates: button taps, text messages, commands.
// Routes to the right handler.
//
// Setup notes:
//   verify_jwt = false (Telegram doesn't send a JWT)
//   Set this URL as the bot webhook (the setup guide explains how)
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  sendTelegramMessage,
  editTelegramMessage,
  answerCallbackQuery,
  escapeMd,
  type TelegramInlineKeyboard,
} from "../_shared/telegram.ts";

// Webhook secret protects against spoofed requests. Set this when registering
// the webhook with Telegram (X-Telegram-Bot-Api-Secret-Token header).
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  // Secret token check
  if (WEBHOOK_SECRET) {
    const provided = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (provided !== WEBHOOK_SECRET) {
      console.warn("Rejected Telegram webhook: bad secret");
      return new Response("Forbidden", { status: 403 });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  try {
    // Handle button taps (inline keyboard callbacks)
    if (update.callback_query) {
      await handleCallbackQuery(supabase, update.callback_query);
      return new Response("ok", { status: 200 });
    }

    // Handle text messages
    if (update.message?.text) {
      await handleTextMessage(supabase, update.message);
      return new Response("ok", { status: 200 });
    }

    // Anything else (photos, stickers, etc): log and ignore for now
    console.log("Unhandled Telegram update type", Object.keys(update));
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("handle-telegram-webhook error", error);
    // Always return 200 to Telegram, otherwise it retries indefinitely
    return new Response("ok", { status: 200 });
  }
});

// ============================================================================
// TEXT MESSAGE HANDLER
// ============================================================================
async function handleTextMessage(supabase: any, message: any) {
  const chatId = message.chat.id as number;
  const text = (message.text as string).trim();
  const from = message.from;

  // Log inbound
  await supabase.from("telegram_messages_log").insert({
    telegram_chat_id: chatId,
    direction: "inbound",
    message_type: "text",
    body: text,
    raw_payload: message,
  });

  // Look up the sitter for this chat (may be null if not yet linked)
  const sitterId = await getSitterIdForChat(supabase, chatId);

  // /start: welcome message
  if (text === "/start" || text === "/start@yodawg_bot") {
    await sendTelegramMessage({
      chatId,
      text: [
        "*Welcome to Yo Dawg* 🐾",
        "",
        "To link this chat to your account, go to your sitter settings on yodawg.ca and click *Connect Telegram*.",
        "",
        "You'll get a code like `/link a1b2c3`. Paste it here and you're set.",
      ].join("\n"),
    });
    return;
  }

  // /link <token>: redeem the linking token
  if (text.startsWith("/link ")) {
    const token = text.slice(6).trim().toLowerCase();
    const { data: linkedSitterId, error } = await supabase.rpc("redeem_telegram_link_token", {
      p_token: token,
      p_chat_id: chatId,
      p_username: from.username || null,
      p_first_name: from.first_name || null,
    });

    if (error || !linkedSitterId) {
      await sendTelegramMessage({
        chatId,
        text: "That code is invalid or expired. Generate a fresh one from your sitter settings.",
      });
      return;
    }

    await sendTelegramMessage({
      chatId,
      text: [
        `✅ All set, ${escapeMd(from.first_name || "there")}.`,
        "",
        "You'll get tomorrow's schedule here every evening at 8 PM. Tap buttons to log pickup and drop-off as you go.",
        "",
        "Commands:",
        "• `/today` — see today's run",
        "• `/tomorrow` — see tomorrow's schedule now",
        "• `/undo` — reverse the last update you logged",
        "• `/help` — show this list",
      ].join("\n"),
    });
    return;
  }

  // Below here, all commands require a linked sitter
  if (!sitterId) {
    await sendTelegramMessage({
      chatId,
      text: "This chat isn't linked to a sitter yet. Send `/start` for instructions.",
    });
    return;
  }

  // Update sitter_id on the log row we just inserted
  await supabase
    .from("telegram_messages_log")
    .update({ sitter_id: sitterId })
    .eq("telegram_chat_id", chatId)
    .is("sitter_id", null);

  // /today, /tomorrow: send schedule on demand
  if (text === "/today" || text === "/tomorrow") {
    const target = text === "/today" ? "today" : "tomorrow";
    await sendScheduleDigest(supabase, sitterId, chatId, target);
    return;
  }

  // /undo: reverse last update
  if (text === "/undo") {
    await handleUndo(supabase, sitterId, chatId);
    return;
  }

  // /help
  if (text === "/help") {
    await sendTelegramMessage({
      chatId,
      text: [
        "*Commands*",
        "• `/today` — today's schedule",
        "• `/tomorrow` — tomorrow's schedule",
        "• `/undo` — reverse your last logged update",
        "",
        "For schedule changes (block a date, add availability, etc), describe what you want and I'll set it up for you to confirm.",
      ].join("\n"),
    });
    return;
  }

  // Anything else: treat as natural-language AI command
  await handleAiCommand(supabase, sitterId, chatId, text);
}

// ============================================================================
// CALLBACK QUERY HANDLER (button taps)
// ============================================================================
async function handleCallbackQuery(supabase: any, query: any) {
  const callbackId = query.id as string;
  const chatId = query.message.chat.id as number;
  const messageId = query.message.message_id as number;
  const data = query.data as string;

  // Log it
  await supabase.from("telegram_messages_log").insert({
    telegram_chat_id: chatId,
    direction: "inbound",
    message_type: "callback_query",
    body: data,
    raw_payload: query,
  });

  const sitterId = await getSitterIdForChat(supabase, chatId);
  if (!sitterId) {
    await answerCallbackQuery({ callbackQueryId: callbackId, text: "Chat not linked.", showAlert: true });
    return;
  }

  // Callback data format: "evt:<kind>:<bookingId>"
  //   kind = "pickup" | "dropoff" | "arrived" | "departed"
  //   bookingId = uuid
  const parts = data.split(":");
  if (parts[0] === "evt" && parts.length === 3) {
    const kind = parts[1] as "pickup" | "dropoff" | "arrived" | "departed";
    const bookingId = parts[2];
    await logBookingEvent(supabase, {
      sitterId,
      chatId,
      messageId,
      callbackId,
      bookingId,
      kind,
    });
    return;
  }

  // Unknown callback
  await answerCallbackQuery({ callbackQueryId: callbackId, text: "Unknown action." });
}

// ============================================================================
// LOG A BOOKING EVENT (pickup/dropoff/etc) FROM A BUTTON TAP
// ============================================================================
async function logBookingEvent(supabase: any, opts: {
  sitterId: string;
  chatId: number;
  messageId: number;
  callbackId: string;
  bookingId: string;
  kind: "pickup" | "dropoff" | "arrived" | "departed";
}) {
  const { sitterId, chatId, callbackId, bookingId, kind } = opts;

  // Verify the booking belongs to this sitter
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("id, sitter_id, customer_id, pets(name), services(name, slug)")
    .eq("id", bookingId)
    .single();

  if (bErr || !booking || booking.sitter_id !== sitterId) {
    await answerCallbackQuery({ callbackQueryId: callbackId, text: "Booking not found.", showAlert: true });
    return;
  }

  // Check if already logged (idempotency)
  const { data: existing } = await supabase
    .from("booking_updates")
    .select("id, created_at")
    .eq("booking_id", bookingId)
    .eq("kind", kind)
    .is("undone_at", null)
    .maybeSingle();

  if (existing) {
    const t = new Date(existing.created_at).toLocaleTimeString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Toronto",
    });
    await answerCallbackQuery({
      callbackQueryId: callbackId,
      text: `Already logged at ${t}. Send /undo to reverse.`,
      showAlert: true,
    });
    return;
  }

  // Insert the event
  const petName = booking.pets?.name || "the dog";
  const message = `${kindPastTense(kind)} ${petName}`;
  const { error: insertErr } = await supabase.from("booking_updates").insert({
    booking_id: bookingId,
    kind,
    message,
    sent_via_sms: false,
    created_by: sitterId,
    source: "telegram",
  });

  if (insertErr) {
    await answerCallbackQuery({
      callbackQueryId: callbackId,
      text: "Couldn't save. Try the dashboard.",
      showAlert: true,
    });
    return;
  }

  // Trigger the standard client notification (SMS + email)
  // Re-using existing send-booking-update flow keeps the client path consistent
  try {
    await supabase.functions.invoke("send-booking-update", {
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: {
        bookingId,
        kind,
        note: undefined,
        sendSms: true,
        skipInsert: true, // already inserted above
      },
    });
  } catch (e) {
    console.warn("send-booking-update from telegram failed", e);
    // Don't surface to AJ; the event is already logged
  }

  // Confirm to AJ with a toast
  const now = new Date().toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });
  await answerCallbackQuery({
    callbackQueryId: callbackId,
    text: `${kindLabel(kind)} logged at ${now} ✓`,
    showAlert: false,
  });

  // Send a small confirmation message that doesn't ping (so the chat thread shows history)
  await sendTelegramMessage({
    chatId,
    text: `✓ *${escapeMd(kindLabel(kind))}* — ${escapeMd(petName)} at ${now}`,
    disableNotification: true,
  });

  // Log outbound
  await supabase.from("telegram_messages_log").insert({
    sitter_id: sitterId,
    telegram_chat_id: chatId,
    direction: "outbound",
    message_type: "system",
    body: `${kindLabel(kind)} logged for booking ${bookingId}`,
    related_booking_id: bookingId,
  });
}

// ============================================================================
// UNDO LAST UPDATE
// ============================================================================
async function handleUndo(supabase: any, sitterId: string, chatId: number) {
  // Find AJ's most recent active update
  const { data: last } = await supabase
    .from("booking_updates")
    .select("id, kind, booking_id, created_at, bookings(pets(name))")
    .eq("created_by", sitterId)
    .is("undone_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) {
    await sendTelegramMessage({
      chatId,
      text: "Nothing to undo. Your update history is empty.",
    });
    return;
  }

  const { error } = await supabase
    .from("booking_updates")
    .update({ undone_at: new Date().toISOString(), undone_by: sitterId })
    .eq("id", last.id);

  if (error) {
    await sendTelegramMessage({ chatId, text: "Couldn't undo. Try again." });
    return;
  }

  const petName = (last as any).bookings?.pets?.name || "dog";
  await sendTelegramMessage({
    chatId,
    text: `↩️ Undone: *${escapeMd(kindLabel(last.kind))}* for ${escapeMd(petName)}.\n\n_Note: the client was already notified when you tapped the button. You may want to text them directly if this was an error._`,
  });
}

// ============================================================================
// AI COMMAND HANDLER (free-form text)
// ============================================================================
async function handleAiCommand(supabase: any, sitterId: string, chatId: number, text: string) {
  // Telegram AI chat is intentionally lightweight: we forward to the existing
  // assistant-schedule-plan, but for complex actions (which require lots of
  // context) we tell AJ to use the dashboard.
  //
  // For now: acknowledge and link to dashboard. Real AI chat in Telegram
  // requires loading full scheduling context (services, availability, walk
  // windows, blocked dates, requests) which is several queries and tons of
  // tokens. Better to keep that in the dashboard's Schedule Assistant page
  // where context is already loaded.
  //
  // Future enhancement: when the user sends a recognized intent like
  // "block off saturday" we can do the simple cases directly here. But
  // for safety, route to dashboard for now.

  const dashboardUrl = `https://yodawg.ca/sitter/assistant?prompt=${encodeURIComponent(text)}`;
  await sendTelegramMessage({
    chatId,
    text: [
      `Got it. To run schedule changes I need to load your services and availability, which works best in the dashboard.`,
      ``,
      `Open this link, your message is already filled in:`,
      dashboardUrl,
    ].join("\n"),
  });
}

// ============================================================================
// SHARED HELPERS
// ============================================================================
async function getSitterIdForChat(supabase: any, chatId: number): Promise<string | null> {
  const { data } = await supabase
    .from("sitter_telegram_links")
    .select("sitter_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return data?.sitter_id ?? null;
}

function kindLabel(kind: "pickup" | "dropoff" | "arrived" | "departed"): string {
  return {
    pickup: "Pickup",
    dropoff: "Drop-off",
    arrived: "Arrived",
    departed: "Departed",
  }[kind];
}

function kindPastTense(kind: "pickup" | "dropoff" | "arrived" | "departed"): string {
  return {
    pickup: "Picked up",
    dropoff: "Dropped off",
    arrived: "Arrived at",
    departed: "Left",
  }[kind];
}

// ============================================================================
// DIGEST SENDER (called from /today, /tomorrow, and from cron)
// ============================================================================
async function sendScheduleDigest(
  supabase: any,
  sitterId: string,
  chatId: number,
  target: "today" | "tomorrow",
) {
  const tz = "America/Toronto";
  const now = new Date();
  const targetDate = new Date(now);
  if (target === "tomorrow") targetDate.setDate(targetDate.getDate() + 1);

  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, start_at, end_at, scheduled_start_at, scheduled_end_at, status, pets(name), services(name, slug)")
    .eq("sitter_id", sitterId)
    .gte("start_at", start.toISOString())
    .lte("start_at", end.toISOString())
    .not("status", "in", "(cancelled,refunded)")
    .order("start_at", { ascending: true });

  const targetLabel = target === "today" ? "Today" : "Tomorrow";
  const dateStr = targetDate.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });

  if (!bookings || bookings.length === 0) {
    await sendTelegramMessage({
      chatId,
      text: `*${targetLabel} (${escapeMd(dateStr)})*\n\nNothing scheduled. Enjoy the quiet.`,
    });
    return;
  }

  // Header
  const walkCount = bookings.filter((b: any) => b.services?.slug?.includes("walk")).length;
  const boardingCount = bookings.filter((b: any) => b.services?.slug === "boarding").length;
  const sitCount = bookings.filter((b: any) => b.services?.slug === "sitting").length;

  const summary = [
    walkCount > 0 ? `${walkCount} walk${walkCount === 1 ? "" : "s"}` : null,
    sitCount > 0 ? `${sitCount} sit${sitCount === 1 ? "" : "s"}` : null,
    boardingCount > 0 ? `${boardingCount} boarding` : null,
  ].filter(Boolean).join(" · ");

  let body = `*${targetLabel} — ${escapeMd(dateStr)}*\n${escapeMd(summary)}\n\n`;

  bookings.forEach((b: any, i: number) => {
    const startAt = new Date(b.scheduled_start_at ?? b.start_at);
    const timeStr = startAt.toLocaleTimeString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    });
    const serviceName = b.services?.name || "Service";
    const petName = b.pets?.name || "dog";
    body += `*${i + 1}. ${escapeMd(timeStr)}* — ${escapeMd(serviceName)}, ${escapeMd(petName)}\n`;
  });

  // Build inline keyboard: 2 buttons per row, pickup + dropoff (or service-appropriate)
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
