## What we have today

- **Customer Account page** (`/account`) — shows bookings only. **No invoice section, no exports.**
- **Sitter ClientProfile** (`/sitter/clients/:id`) — already has an "Invoices" tab listing all invoices for that client (paid, sent, overdue, partial, void). **No export button.**
- **Sitter Reports** (`/sitter/reports`) — shows revenue, outstanding, aging KPIs. **No export.**
- **Sitter Invoices** (`/sitter/invoices`) — list of all invoices. **No export.**

So the answer to the question is: **partially** — Anneke can already see all invoices per client, but customers can't see their own invoices, and nobody can export.

## What this plan adds

### 1. Customer-facing invoice history

On `/account`, add a new **"Invoices"** section under the existing bookings, with:
- Invoice number, issue date, due date, status badge (paid / sent / overdue / partial / void), total, amount paid, amount due
- "View / pay" link that goes to the existing public-invoice page (`/pay/:token`) for unpaid ones, or a read-only summary for paid ones
- An **"Export CSV"** button that downloads only that customer's invoices

### 2. Per-client export on sitter ClientProfile

Add an **"Export CSV"** button on the existing Invoices tab in `/sitter/clients/:id` that downloads that single client's invoice history (one row per invoice, plus a second sheet/file with line items if simple to do — kept as a single CSV for v1).

### 3. Admin financial report on sitter Reports

On `/sitter/reports`, add a small **"Export"** card with:
- Date range picker (defaults: month-to-date, year-to-date, last 12 months, custom)
- **Export invoices CSV** — every invoice in range with: invoice #, customer name, status, issued, due, paid date, subtotal, total, paid, balance
- **Export payments CSV** — every payment event in range from `payment_events` (kind, channel, amount, booking/invoice link, customer)
- **Export bookings CSV** — every booking in range with service, customer, pet, status, total, paid status

All exports are generated client-side from existing Supabase data (no edge function needed) and download as `.csv`.

## Technical details

- New shared util `src/lib/csv.ts` — array-to-CSV serializer with proper escaping (commas, quotes, newlines) + `downloadCsv(filename, rows)`.
- Customer invoice fetch: `supabase.from("invoices").select(...).eq("customer_id", user.id)` — already covered by the existing `Customers view own invoices` RLS policy. No schema change needed.
- Sitter per-client export: reuses data already loaded in `SitterClientProfile`.
- Reports exports: extend the existing `useEffect` in `Reports.tsx` to also load the raw rows needed for export, gated by date range; reuse existing RLS (`Sitters manage own invoices`, `Sitters view own bookings`, `Sitters view own payment events`).
- Filenames: `yodawg-invoices-2026-04-25.csv`, `yodawg-payments-2026-01-01_2026-04-25.csv`, etc.
- No new tables, no new edge functions, no new dependencies.

## Files to change

- `src/lib/csv.ts` — new
- `src/pages/Account.tsx` — add Invoices section + export button
- `src/pages/sitter/ClientProfile.tsx` — add export button on Invoices tab
- `src/pages/sitter/Reports.tsx` — add Export card with date range + 3 CSV buttons

## Out of scope (ask if you want them)

- PDF receipts for individual invoices (the public invoice page already prints nicely)
- Excel/.xlsx exports (CSV opens in Excel/Sheets/Numbers fine; xlsx adds a dependency)
- Tax-summary report (HST/GST breakdown by quarter)
- Emailed monthly statements
