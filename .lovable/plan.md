
Goal: update the Solo Walk prices so the booking experience and service card stay consistent.

1. Update the Solo Walk marketing card
- Edit `src/components/ServicesSection.tsx`.
- Change the Solo Walk card pricing text to the new values the user wants shown.
- Keep the existing “30 or 60 min” style aligned with the displayed pricing.

2. Update the actual booking price source
- Add or adjust a database migration that updates the active Solo Walk service variant records in Lovable Cloud so the booking flow uses the correct amount.
- Target the `service_variants` rows for Solo Walk rather than changing generated types or hardcoded frontend-only pricing.
- If there are separate 30-minute and 60-minute Solo Walk variants, update both amounts.
- If the current data model only has one Solo Walk variant, expand the seed/update logic so Solo Walk can correctly represent both 30-minute and 60-minute options.

3. Keep booking and dashboard displays in sync
- Verify the updated variant prices flow through the existing reads in:
  - `src/pages/Book.tsx`
  - `src/pages/SitterDashboard.tsx`
  - any related booking summary/checkout displays that read `service_variants.price_cents`
- No manual edits to generated Supabase type files.

4. Validate copy and display consistency
- Ensure the homepage service card, service selection cards in booking, and any booking summary all reflect the same Solo Walk pricing structure.
- Preserve all existing Group Walk, Pet Sitting, and Boarding pricing.

Technical details
- Likely files:
  - `src/components/ServicesSection.tsx`
  - `supabase/migrations/<new_migration>.sql`
- Important note:
  - the homepage service card is currently hardcoded, but the booking flow reads from `services`/`service_variants`, so both layers should be updated together to avoid mismatched prices.
