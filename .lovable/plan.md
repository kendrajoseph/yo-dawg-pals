## What I found

Your most recent invoice (`INV-2026-0003`, May 9) is sitting in the database with `status = 'draft'` and `sent_at = null`. The `send-invoice-email` edge function has **no logs at all** — meaning nothing has ever called it for this invoice. The pipeline itself is healthy:

- Email domain `notify.yodawg.ca` is verified ✅
- `invoice-issued` template is registered in the transactional registry ✅
- `send-invoice-email` → `send-transactional-email` → queue → Mailgun is wired correctly ✅

So this is **not** a delivery failure. It's a UX trap: the invoice was created via the **Create draft** button (or **Save changes** on an existing draft), neither of which sends the email. The "Send invoice" / "Save & send" button lives inside the payment drawer, two clicks deep, and the Drafts tab on the Invoices page has no Send action at all — the only visible action on a draft row is a Delete trash icon.

## Plan

### 1. Add an inline "Send" action on every draft row in the Invoices list
On `src/pages/sitter/Invoices.tsx`, when `r.status === 'draft'`, render a small primary `Send` button next to the existing trash icon. Clicking it calls `supabase.functions.invoke('send-invoice-email', { body: { invoiceId: r.id } })` and refreshes the list. Show a toast on success/failure with the actual error message so future failures aren't silent.

### 2. Make the drawer's send action unmistakable
On `src/components/payments/PaymentDrawer.tsx`, when the loaded invoice is `draft`:
- Promote the "Send invoice" button to the primary variant (currently `outline`).
- Add a small amber banner above the actions row: "This invoice is a draft — your client hasn't received it yet."
- Rename the line-items footer button from "Save & send" → "Save and send to client" so it reads as an action, not just a save.

### 3. Surface a Drafts count badge
The Invoices KPI row shows Outstanding / Overdue / Paid, but never tells the sitter how many drafts are sitting unsent. Add a 4th tile (or a count next to the Drafts tab label) so unsent invoices can't hide.

### 4. Don't fail silently in `create-invoice`
`supabase/functions/create-invoice/index.ts` currently `try/catch`es the `send-invoice-email` invoke and only `console.error`s. Change it to (a) check the invoke result and (b) if sending fails, leave `status = 'draft'` and `sent_at = null` (currently it pre-sets `status = 'sent'` *before* attempting the send, so a failed send leaves a lying "sent" status), and return a partial-success response so the UI can surface "Created, but email didn't go through".

### 5. One-time recovery for INV-2026-0003
After the UI changes ship, click the new inline Send on the existing draft so your real outstanding invoice goes out.

## Out of scope
- SMS / Twilio messaging — confirmed working path-wise; no reported failure.
- Booking-confirmation, receipt, reminder emails — same pipeline; will benefit automatically from any infra fixes but not separately changed.
- Email template visual tweaks.
