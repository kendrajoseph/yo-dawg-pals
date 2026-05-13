## Goal
Replace the three "coming soon" stubs (Reminders, Templates, Branding) with real, working settings backed by the database, and wire them into the invoice-sending flow.

## Scope (this loop)
- **Branding**: business name, logo, address, phone, website. Used on invoice PDFs/emails and the public pay page.
- **Templates**: editable subject + body for invoice emails (sent / paid / reminder / overdue), booking emails (request / approved / declined), and SMS versions of reminder + booking-status messages. Variables like `{{customer_name}}`, `{{invoice_number}}`, `{{amount}}`, `{{due_date}}`, `{{pay_url}}`, `{{business_name}}` are supported.
- **Reminders**: a default cadence (e.g. "3 days before due", "on due date", "7 days overdue") with per-invoice override (enable/disable, custom rules).

## Out of scope (next loop)
- The actual cron job that sweeps invoices and dispatches reminders. We'll store the rules and provide a "Send reminder now" button that uses the rules immediately. The scheduled dispatcher can be added once you've reviewed the templates output.
- Live preview rendering of templates with sample data (we'll show variable hints but not a live render).

## Schema

### `sitter_branding` (one row per sitter)
- `sitter_id uuid PK` — references the auth user
- `business_name text`
- `logo_url text` (Supabase storage public URL)
- `footer_address text`, `footer_phone text`, `footer_website text`
- `updated_at`

### `sitter_message_templates`
- `id uuid PK`
- `sitter_id uuid`
- `kind text` — `invoice_sent | invoice_paid | invoice_reminder | invoice_overdue | booking_requested | booking_approved | booking_declined`
- `channel text` — `email | sms`
- `subject text` (null for SMS)
- `body text`
- `updated_at`
- Unique on `(sitter_id, kind, channel)` — one template per (kind, channel)

### `sitter_reminder_settings` (one row per sitter)
- `sitter_id uuid PK`
- `enabled boolean default true`
- `rules jsonb` — array of `{ offset_days: int, channel: 'email'|'sms', label: string }`
- `updated_at`

### `invoice_reminder_overrides`
- `invoice_id uuid PK`
- `enabled boolean` (overrides sitter default)
- `rules jsonb` (null = use sitter default)
- `updated_at`

### Storage
- Reuse existing `avatars` bucket for logo uploads (path `branding/{sitter_id}/logo.{ext}`).

### RLS
- Sitters manage their own rows on all four tables.
- `sitter_branding` is also publicly readable (so the public pay page can show the brand without auth).

## UI

### `/sitter/settings/branding`
- Form: logo upload (preview), business name, address, phone, website.
- Save → writes to `sitter_branding`.

### `/sitter/settings/templates`
- Two-column layout: left = template list grouped by category (Invoice / Booking) with channel badges, right = editor (subject + body textareas, variable chip helper, "Reset to default" button).
- Defaults seeded in code (not DB) — empty rows mean "use built-in default".

### `/sitter/settings/reminders`
- Toggle: enabled.
- Rule list with add/remove. Each rule = `[number] days [before/after] due, via [email/sms]`.
- Sensible defaults pre-populated on first visit.

### Invoice integration
- `InvoiceDrawer` gets a small "Reminder schedule" panel (read-only summary + "Customize" link that opens a per-invoice override dialog backed by `invoice_reminder_overrides`).
- "Send reminder now" button on invoices already exists; we'll route it through the new template (uses the `invoice_reminder` email template).

## Files

**New:**
- `src/pages/sitter/settings/Branding.tsx`
- `src/pages/sitter/settings/Templates.tsx`
- `src/pages/sitter/settings/Reminders.tsx`
- `src/lib/sitterTemplates.ts` — default template strings + variable substitution helper.

**Edited:**
- `src/App.tsx` — replace the three `SettingsRedirect` routes with the real pages.
- `src/pages/sitter/settings/SettingsHome.tsx` — keep tiles pointing to the new pages.
- `src/components/sitter/InvoiceDrawer.tsx` — add reminder-schedule panel + per-invoice override.

**Deleted:**
- `src/pages/sitter/settings/SettingsRedirect.tsx` (no longer needed once all three routes have real pages).

## Migration order
1. Create the four tables + RLS in one migration.
2. Build the three settings pages + the helper lib.
3. Wire the override panel into `InvoiceDrawer`.
4. (Defer) cron-based dispatcher.

After approval I'll start with the migration, then implement the UI.
