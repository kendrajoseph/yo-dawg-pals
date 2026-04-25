## Services & pricing manager

Replace the placeholder at **Sitter Settings → Services & pricing** with a real admin UI where Anneke can edit existing services and manage the priced variants customers actually book.

### What you'll be able to do

For each of the 7 existing services (Solo Walk, Group Walk, Pet Sitting, Boarding, Meet & Greet, Training, Dog Walking):
- Edit the service **name**, **description**, and **active/inactive** toggle
- Add, edit, and remove **pricing variants** under it (e.g. add a "Solo Walk · 45 min · $40" option)
- For each variant: set name, duration (minutes), price (dollars), payment mode (full / deposit / free), and active/inactive

Service-level rules that affect booking flow (approval required, capacity mode, scheduling mode, fee structures) stay locked — those are tied to backend logic and shouldn't be casually changed from the UI.

### Page layout

```text
Settings → Services & pricing
─────────────────────────────────────────
[Service card: Solo Walk]                [Edit] [Active ✓]
  Description: One-on-one focused walk…
  ┌ Pricing options ─────────────────────┐
  │ Solo Walk · 30 min   30 min  $30.00 ✏ │
  │ Solo Walk · 60 min   60 min  $45.00 ✏ │
  │ + Add pricing option                  │
  └───────────────────────────────────────┘

[Service card: Group Walk]               [Edit] [Active ✓]
  …
```

- Inline edit dialogs for service details and for each variant
- "Add pricing option" opens a dialog with name, duration, price, payment mode
- Delete variant uses a confirm dialog (and is blocked with a helpful message if any bookings reference it)

### Files to add / change

- **New**: `src/pages/sitter/settings/Services.tsx` — main page using `SettingsLayout`
- **New**: `src/components/sitter/settings/ServiceEditDialog.tsx` — edit name/description/active for a service
- **New**: `src/components/sitter/settings/VariantEditDialog.tsx` — create/edit a variant (name, duration, price in $, payment mode, active)
- **Edit**: `src/App.tsx` — point `/sitter/settings/services` to the new `Services` page instead of the redirect placeholder

### Permissions

`services` and `service_variants` already have RLS policies that allow `admin` role to manage them, and Anneke has the admin role — no schema or policy changes needed.

### Safety

- Price input collected in dollars, stored as cents
- Duration validated as a positive integer
- Slug auto-generated from variant name on create (server-unique constraint already exists)
- Deleting a variant referenced by bookings is blocked at the DB level (`ON DELETE SET NULL` on bookings means delete will succeed but unlink old bookings) — UI will warn before delete and show count of past bookings using it
- Variants list refreshes after each change so prices update immediately on the booking page
