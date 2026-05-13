# Anneke's site assistant — rework plan

Reshape `/sitter/assistant` from a single-purpose schedule planner into a chat-based AI helper that can search and act across the whole sitter side: bookings, invoices, services, schedule, extras, clients, pets, and messages.

## Behaviour

- **One ongoing conversation.** No thread sidebar. "New chat" button clears it. History kept in `localStorage` so a refresh doesn't lose context.
- **Streaming chat** with markdown-rendered assistant replies and tool-call cards.
- **Tool policy:**
  - Reads (search bookings, look up invoice, list today's schedule, read pet notes…) — run automatically.
  - Writes (approve/decline a booking, reschedule, cancel, add an extra/line item, send invoice, send reminder, mark paid, refund, message a client, edit availability) — assistant proposes the action; Anneke sees a confirm card with the parameters and must click **Approve** before it runs.
- **Scope:** sitter/admin only. Tools refuse if the caller isn't `sitter` or `admin`.

## What gets built

### 1. New edge function: `assistant-chat`

Server-side chat endpoint using Vercel AI SDK + Lovable AI Gateway (`google/gemini-3-flash-preview`), `streamText` with `toUIMessageStreamResponse`, `stopWhen: stepCountIs(50)`.

System prompt explains: "You are Anneke's operations assistant for the Yo Dawg sitter dashboard. Prefer searching first. Never invent IDs. For any mutating action, call the tool with `confirm: false` first to surface a preview; only call again with `confirm: true` after Anneke has approved."

Tools (all server-side, JWT-validated, role-checked):

**Search / read (auto-run):**
- `search_bookings` — by client name, pet name, date range, status, service slug
- `get_booking` — full detail incl. line items, payments, pet, client contact
- `list_today_schedule` — confirmed bookings for today/tomorrow
- `list_pending_requests` — grouped, mirrors current `requestGroups`
- `search_clients` — by name/email/phone, returns id + summary
- `get_client` — profile, pets, recent bookings, outstanding balance
- `search_invoices` — by status, client, date
- `get_invoice` — line items, payments, public link
- `list_services` — services + variants + prices
- `list_availability` — weekday blocks + walk windows + blocked dates

**Mutations (need approval — `needsApproval: true`):**
- `approve_booking` / `decline_booking` (single id; reuses existing approve/decline logic)
- `cancel_booking` (calls `cancel-booking` function)
- `reschedule_booking` (updates `scheduled_start_at` / `_end_at`)
- `add_booking_line_item` — extras, late fees, custom (writes to invoice, creates one if missing)
- `create_invoice` (calls `create-invoice`)
- `send_invoice_email` (calls `send-invoice-email`)
- `send_payment_reminder` (calls `send-payment-reminder`)
- `mark_invoice_paid` (calls existing mark-paid path)
- `refund_payment` (calls `refund-payment`)
- `charge_saved_card` (calls `charge-saved-card`)
- `send_client_message` (calls `send-client-message`)
- `send_booking_update` (calls `send-booking-update`)
- `add_blocked_date`, `create_availability_block`, `upsert_walk_window` (port from current `assistant-schedule-execute`)

Each mutation tool, when called with `confirm: false` (default), returns `{ status: "needs_approval", preview: {...} }` instead of executing. The UI renders the preview and lets Anneke click Approve, which re-sends the same tool call with `confirm: true`.

### 2. Frontend rebuild — `src/pages/sitter/Assistant.tsx`

Rename `ScheduleAssistant.tsx` → `Assistant.tsx`. Update route in `App.tsx` (`/sitter/assistant`) and any nav labels from "Schedule assistant" to "Assistant".

Install AI Elements primitives:
```
bun x ai-elements@latest add conversation message prompt-input shimmer tool
```

UI structure:
- `SitterPageHeader` — title "Assistant", description "Ask me to find anything, change a booking, send an invoice, update the schedule…", "New chat" button on the right.
- `Conversation` / `ConversationContent` — full-height transcript with sticky-to-bottom.
- `Message` + `MessageResponse` — markdown assistant text. No background on assistant bubbles; user bubbles use `bg-primary text-primary-foreground`.
- `Tool` accordions for tool calls (`defaultOpen={false}`), with custom renderers per tool category (booking card, invoice card, schedule list).
- **Approval card** for `status: "needs_approval"` tool outputs: shows tool name + plain-English summary + parameter table + Approve / Discard buttons. Approve re-sends the tool call with `confirm: true`.
- `PromptInput` with `PromptInputTextarea` and `PromptInputFooter` containing `PromptInputSubmit` (`justify-end`). Textarea autofocused on load, after send, after stream end, after New chat.
- `Shimmer` "Thinking…" while `status === "submitted"`.

Client uses `useChat({ id: "anneke-assistant", transport: new DefaultChatTransport({ api: <assistant-chat URL> }) })`. Persist `messages` to `localStorage` on change; restore on mount (guarded by `typeof window !== "undefined"`).

Identity: small generated avatar/icon for the assistant (not `Sparkles`).

### 3. Cleanup

- Keep the old `assistant-schedule-plan` and `assistant-schedule-execute` functions in place for now (the new tools port their logic). Mark the old planner as deprecated in a code comment; remove in a follow-up once the new flow is verified.
- Remove the planner-style "Plan ready / Apply plan" footer UI from the old page (replaced by per-tool approval cards).

## Technical details

- AI SDK on the server (`npm:ai`, `npm:zod`, `npm:@ai-sdk/openai-compatible`) inside `supabase/functions/assistant-chat/index.ts`.
- Add `[functions.assistant-chat]` with `verify_jwt = false` to `supabase/config.toml`; validate JWT in code via `auth.getClaims`, then check `user_roles` for `sitter` or `admin`.
- Tool inputs use Zod with narrow shapes; tool results stay compact (return summaries + ids, not raw rows of 40 columns).
- Mutation tools wrap their work in try/catch and return `{ ok, message, error? }`; surface errors as a red-tinted assistant response.
- Handle gateway 429 / 402 explicitly with toast + visible error message.
- No new tables needed. No migrations.

## Files touched

- **New:** `supabase/functions/assistant-chat/index.ts`, `supabase/functions/_shared/ai-gateway.ts` (provider helper), `src/components/ai-elements/*` (installed by CLI), `src/pages/sitter/Assistant.tsx`
- **Edited:** `supabase/config.toml`, `src/App.tsx` (route), any sidebar/nav file pointing to "Schedule assistant"
- **Deprecated (kept for now):** `src/pages/sitter/ScheduleAssistant.tsx` (replaced by `Assistant.tsx`)

## Out of scope

- Multi-thread history / database-backed chat persistence (one conversation, localStorage only).
- Mobile-specific redesign beyond what AI Elements gives by default.
- New business logic — every mutation tool wraps an existing edge function or table operation.