# Remove add-on price from booking duration line

On the booking page (`/book`), under the selected date, the duration currently shows like:

> `30 min · $50.00 / 30 min add-on`

You want it to just show:

> `30 min`

## Change

**File:** `src/pages/Book.tsx` (line 1144)

Replace the template literal that appends the extra-time fee with a simple duration string:

```tsx
{`${activeVariant.duration_minutes} min`}
```

That's the only change. The underlying `extra_time_fee_cents` field stays intact in the database and is still used elsewhere (e.g. sitter dashboard, actual billing logic) — we're only hiding it from the customer-facing booking form.

## Notes

- No database, RLS, or edge function changes.
- No impact on pricing or checkout — purely cosmetic copy.
- Sitter Dashboard's "Fees: $X add-on" line for completed bookings is unaffected.
