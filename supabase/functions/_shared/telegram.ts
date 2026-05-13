// ============================================================================
// FILE: supabase/functions/_shared/telegram.ts
// ============================================================================
// Shared utilities for sending and receiving Telegram messages.
// Uses Bot API directly: https://core.telegram.org/bots/api
// ============================================================================

const TELEGRAM_API_BASE = "https://api.telegram.org";

export function getBotToken(): string {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
}

export type TelegramInlineButton = {
  text: string;
  callback_data: string;
};

export type TelegramInlineKeyboard = TelegramInlineButton[][];

/**
 * Send a message to a Telegram chat. Supports inline keyboards.
 * Returns the sent message_id so we can edit later (e.g. to mark a button done).
 */
export async function sendTelegramMessage(opts: {
  chatId: number;
  text: string;
  parseMode?: "Markdown" | "HTML";
  replyMarkup?: { inline_keyboard: TelegramInlineKeyboard };
  disableNotification?: boolean;
}): Promise<{ ok: true; message_id: number } | { ok: false; error: string }> {
  const token = getBotToken();
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        parse_mode: opts.parseMode ?? "Markdown",
        reply_markup: opts.replyMarkup,
        disable_notification: opts.disableNotification,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || `HTTP ${res.status}` };
    }
    return { ok: true, message_id: data.result.message_id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Edit an existing message's text/keyboard. Used to update the nightly schedule
 * as AJ taps buttons (so the visual state stays in sync).
 */
export async function editTelegramMessage(opts: {
  chatId: number;
  messageId: number;
  text: string;
  parseMode?: "Markdown" | "HTML";
  replyMarkup?: { inline_keyboard: TelegramInlineKeyboard };
}): Promise<{ ok: boolean; error?: string }> {
  const token = getBotToken();
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        message_id: opts.messageId,
        text: opts.text,
        parse_mode: opts.parseMode ?? "Markdown",
        reply_markup: opts.replyMarkup,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Acknowledge a callback query (the spinning indicator when AJ taps a button).
 * Optional toast text shows briefly on her screen.
 */
export async function answerCallbackQuery(opts: {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}): Promise<void> {
  const token = getBotToken();
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: opts.callbackQueryId,
        text: opts.text,
        show_alert: opts.showAlert ?? false,
      }),
    });
  } catch (error) {
    console.error("answerCallbackQuery failed", error);
  }
}

/**
 * Markdown escape for user-provided text that goes into a Markdown message.
 * Without this, a dog named "Mr. Brackets [the dog]" would break the message.
 */
export function escapeMd(input: string): string {
  return input.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
