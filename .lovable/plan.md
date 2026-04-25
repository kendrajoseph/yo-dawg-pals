# Payments Tab Upgrade — Invoices, Receipts, Reminders

Turns the current read-only list into a workable A/R inbox. Every row is clickable and opens a detail drawer with full payment actions.

---

## 1. New Row Behavior — Clickable + Action Menu

Each booking row in the Payments tab becomes:
- **Whole row clickable** → opens a side **Booking Payment Drawer** (right-side sheet).
- **Inline kebab "⋯" menu** on the right for fast actions without opening the drawer:
  - Send invoice
  - Send receipt
  - Send reminder
  - Charge saved card
  - Mark paid manually (cash / e-transfer)
  - Issue refund (full or partial)
  - Edit amount / add line item
  - Copy public payment link
  - View history

Status pill colors: `paid` (green), `outstanding` (amber), `overdue` (red, auto when invoice past due), `refunded` (grey), `partial` (blue).

---

## 2. Booking Payment Drawer

Opens on row click. Three sections:

### A. Summary
- Client name, service, date/time
- Total · Paid · Outstanding · Refunded
- Saved-card status (last 4 + brand) or "no card on file"
- Stripe payment intent / charge ID (linkable)

### B. Line Items (editable)
- Base service price
- Extra time fee
- Late pickup fee
- Sibling discount
- Custom add-ons (sitter can add: "extra walk", "supplies", "tip credit", etc.)
- Each line: label, qty, unit price, total. Inline edit + delete.
- Recalculates total on save.

### C. Activity timeline
- Every invoice sent, receipt sent, reminder sent, charge attempt, refund, manual mark-paid — with timestamp, channel (email/SMS), and who triggered it.

---

## 3. Invoices

- **Generate invoice** from a booking → creates an `invoices` row with line items snapshot, due date (default = booking start - 24h, configurable), invoice number (`INV-YYYY-####`).
- **Send invoice email** via `send-transactional-email` using new template `invoice-issued`. Includes:
  - Itemized breakdown
  - Total + due date
  - "Pay now" button → public payment page (Stripe Checkout, off-session if card on file, else hosted checkout)
- **Public payment link**: `/pay/:invoiceToken` route, no login required, opens Stripe Checkout. Token is single-use-resettable.
- Invoice status: `draft` → `sent` → `paid` / `overdue` / `void`.

## 4. Receipts

- Auto-sent on successful payment (webhook + manual charge) via new template `payment-receipt`.
- Includes: receipt number, amount paid, payment method (card brand + last 4), date, line items, refund policy link.
- Manual "Resend receipt" from drawer or kebab.

## 5. Reminders

- **Manual**: kebab → "Send reminder" — uses template `payment-reminder`. Sitter picks tone preset (Friendly / Firm / Final notice) and channel (Email + optional SMS via `send-client-message`).
- **Automated**: optional toggle per invoice + global default. Cadence: 3 days before due, day of due, 3 days overdue, 7 days overdue. Configurable in a small "Reminders" settings card at top of Payments tab.
- Reminder log stored so we don't double-send.

## 6. Refunds

- Full or partial via Stripe API (new edge function `refund-payment`).
- Updates `bookings.refund_id`, creates timeline entry, optionally sends `refund-issued` email.

## 7. Manual Payment Recording

- "Mark as paid" dialog: amount, method (cash/etransfer/other), reference note. Updates `payment_status` + `payment_amount_cents` and records in timeline. No Stripe call.

---

## 8. Top-of-Tab Dashboard

Replace the simple filter bar with:
- **Stat tiles**: Outstanding total $, Overdue total $, Paid this month $, Avg days to pay
- **Filters**: status (all/outstanding/overdue/paid/refunded), date range, client search
- **Bulk actions** (checkbox per row): Send reminders to selected, Export CSV
- **Reminders settings** collapsible card

---

## 9. Database Changes

New tables:
```
invoices (id, booking_id, sitter_id, customer_id, invoice_number, status,
          subtotal_cents, total_cents, amount_paid_cents, due_date,
          public_token, sent_at, paid_at, voided_at, notes, created_at, updated_at)

invoice_line_items (id, invoice_id, label, quantity, unit_price_cents,
                    total_cents, kind, sort_order, created_at)
  -- kind: 'service' | 'extra_time' | 'late_fee' | 'discount' | 'custom' | 'tip'

payment_events (id, booking_id, invoice_id, kind, channel, amount_cents,
                metadata, created_by, created_at)
  -- kind: 'invoice_sent' | 'reminder_sent' | 'receipt_sent' | 'charge_attempt'
  --       | 'charge_succeeded' | 'charge_failed' | 'refund' | 'manual_paid' | 'voided'

reminder_settings (sitter_id PK, auto_enabled, cadence jsonb, default_tone)
```

RLS: sitter-scoped (Anneke email gate, matching existing pattern). Customers can SELECT their own invoices via `customer_id`. Public payment page reads invoice by `public_token` through a SECURITY DEFINER RPC (no direct table access).

Add to `bookings`:
- `payment_status` extends to support `partial` and `overdue` (already text, just new values).

## 10. Edge Functions

- `create-invoice` — generates invoice + line items from a booking, optionally sends email.
- `send-invoice-email` — wraps `send-transactional-email` with `invoice-issued` template.
- `send-payment-reminder` — same wrap, `payment-reminder` template, supports SMS via Twilio.
- `send-payment-receipt` — `payment-receipt` template; called by webhook + manual.
- `refund-payment` — Stripe refund (full/partial), updates booking + invoice, emits event.
- `pay-invoice-public` — public endpoint, validates `public_token`, returns Stripe Checkout URL.
- `process-reminder-cron` — scheduled (daily) using existing `pg_cron` pattern; reads `reminder_settings` + outstanding invoices.
- Update `payments-webhook` to: create receipt event, send receipt email, mark invoice paid, handle partial payments.
- Update `charge-saved-card` to record `payment_events` and trigger receipt.

## 11. New Email Templates (transactional)

In `supabase/functions/_shared/transactional-email-templates/`:
- `invoice-issued.tsx` — itemized invoice + Pay Now button
- `payment-receipt.tsx` — receipt with line items + payment method
- `payment-reminder.tsx` — accepts `tone` prop (friendly/firm/final), pulled from preset copy
- `refund-issued.tsx` — refund confirmation

All four registered in `registry.ts`. Branded with existing Yo Dawg styling (cream bg, navy headers, font-display).

## 12. Public Payment Page

New route `/pay/:token`:
- Read-only invoice view (line items, total, due date, business info)
- "Pay $X" button → calls `pay-invoice-public` → redirects to Stripe Checkout
- Success/cancel return URLs map back to `/pay/:token?status=paid|cancelled`
- No auth required.

## 13. UI Files Touched

- `src/pages/SitterDashboard.tsx` — Payments tab rewrite, drawer, dialogs, kebab menu
- `src/components/payments/PaymentDrawer.tsx` (new)
- `src/components/payments/InvoiceLineItemsEditor.tsx` (new)
- `src/components/payments/SendReminderDialog.tsx` (new)
- `src/components/payments/RefundDialog.tsx` (new)
- `src/components/payments/MarkPaidDialog.tsx` (new)
- `src/pages/PublicInvoice.tsx` (new) + route in `src/App.tsx`
- `src/lib/invoices.ts` (new) — helpers for totals, status derivation, formatting

---

## Out of Scope (call out for follow-ups)

- Recurring/subscription billing
- Multi-currency
- Tax line items (GST/PST) — can add as a `kind: 'tax'` line later
- Customer-facing self-serve invoice list inside `/account` (this plan only adds the public token page)

---

## Build Order

1. DB migrations (invoices, line_items, payment_events, reminder_settings) + RLS
2. Email templates + registry
3. Edge functions (create-invoice, send-invoice-email, send-payment-reminder, send-payment-receipt, refund-payment, pay-invoice-public)
4. Update `payments-webhook` + `charge-saved-card` to emit events + receipts
5. Payment Drawer + dialogs (UI)
6. Payments tab rewrite (stats, filters, clickable rows, kebab menu, bulk actions)
7. Public `/pay/:token` page + route
8. Reminder cron job
9. End-to-end test with a sandbox Stripe booking

Reply **"go"** to build all of it, or call out anything to cut/add first.