
## Remove "Training" service

The Training service will be removed from the homepage services grid. A short note will be added under Dog Walking explaining basic training is included.

### Changes

**`src/components/ServicesSection.tsx`**
- Remove the `Training` entry (icon, copy, price, slug) from the `services` array.
- Remove the now-unused `GraduationCap` import and `dog7` from the services import (keep `dog7` in the `packStrip` so the illustration band stays full).
- Update Dog Walking's `desc` to mention "basic leash manners and training cues included."
- Grid will naturally reflow from 4 columns to 3 on large screens (`lg:grid-cols-3`).

### Notes

- No database changes — the `services` table may still contain a "training" row, but it won't appear in the homepage grid. If you also want it hidden from the `/book` flow (which lists everything from the `services` table), say the word and I'll deactivate it via a migration (`is_active = false`).
