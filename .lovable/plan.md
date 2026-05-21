## Problem

The Sent tab on `/sitter/emails` reads from `client_messages`, which is empty (0 rows). However `email_send_log` contains **28 successfully sent emails** (invoices, receipts, reminders, walk requests, direct messages, etc.) going back to April. These were sent before the new "archive a copy to `client_messages`" behaviour was added to `send-transactional-email`, so they were never copied into the hub.

## Plan

Make the Sent tab a **union** of two sources, deduplicated by time + recipient:

1. **`client_messages`** — full fidelity (subject, body, rendered HTML, customer link). Used for all emails sent from now on, with a working "View email" button.
2. **`email_send_log`** — historical/system record. Used as a fallback so older sends still show up.

### Changes to `src/pages/sitter/Emails.tsx` (SentTab only)

- Fetch both tables in parallel, scoped to the signed-in sitter.
  - For `email_send_log`, look up the matching customer by `recipient_email` (join through `profiles` → `auth.users` via an existing helper, or query auth users by email through an edge function). Skip rows whose recipient is the sitter's own address or unknown.
  - Map `template_name` to the existing kind badges:
    - `invoice-issued` → Invoice
    - `payment-receipt` → Receipt
    - `payment-reminder` → Reminder
    - `client-direct-message` → Message
    - `walk-request-received` / `walk-schedule-confirmed` / `booking-declined` / `group-walk-payment-request` → Update
- Merge into one list, sorted by `created_at` desc. If a `client_messages` row and an `email_send_log` row refer to the same send (same recipient within ~60s and same template/kind), keep the `client_messages` row.
- For rows that come only from `email_send_log`:
  - "View email" button is disabled with tooltip "Original email not archived (sent before message hub was added)".
  - Delete button is hidden (nothing to delete; the log is append-only).
  - Subject is derived from template name + date; body shows "Sent to {recipient}".

### Out of scope

- No schema changes, no backfill SQL — the log stays as the source of truth for historical records.
- Outbox tab already reads `email_send_log` for failed/bounced/dlq, no change needed.
- Inbox tab unchanged.

## Result

The Sent tab will immediately show the 28 historical emails plus anything sent going forward (with full "View email" support for new ones).