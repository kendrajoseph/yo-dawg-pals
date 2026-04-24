# Final Build Plan — Yo Dawg Updates

All previously approved items, plus moving the AI Schedule Assistant to the top of the Schedule page.

## 1. Branding & Copy
- Rename "Maya & Biscuit" → "Teresa & Poppy" everywhere (Hero, email templates, sample copy).
- Internal-note input boxes: remove all sample/placeholder text — start blank.

## 2. Dog Illustrations
- Hero collage: keep as-is.
- Testimonials: replace duplicate `dog2` with `dog5`.
- "Meet AJ / Meet Anneke" section: replace logo-repeat dog with `dog4` and `dog8` (the two non-hero dogs from the original drawing).

## 3. Pricing
Update `src/lib/booking.ts` + `services` / `service_variants` tables:
- Boarding: **$80 first night, $60 each additional night**.
- Solo Walk 30m: **$30** (60m stays at $45).
- Pet Sitting: **30 minutes** duration.
- Sibling discount: **50% off second dog** for Group Walks and Boarding.

## 4. Pet Profiles
- New dedicated **Pet Profiles** page accessible from account nav.
- Cards on the page are clickable (clicking the **picture** opens detail).
- Detail view shows full info; internal note boxes blank.
- Temperament section: add an **"Other"** field where the client can type custom details.
- Remove **Cat / Other** from the species dropdown — dogs only.
- DB: add `pets.temperament_notes` (text, nullable).

## 5. Scheduling Page — AI Assistant Relocation (NEW)
- Move the **AI Schedule Assistant** UI out of its own `assistant` tab.
- Mount it as a **collapsible panel pinned to the top of the `schedule` tab** in `SitterDashboard.tsx`, above the calendar/schedule grid.
- Calendar updates from approved assistant plans render live below, so Anneke can compare side-by-side.
- Remove the standalone "Assistant" tab from the tab bar to avoid duplication.

## 6. Calendar (Playbook tab)
- Add a classic **month-grid view** using `react-day-picker`.
- Blocking a day prompts: *"Notify affected customers?"* → opens an alert composer.

## 7. Customer Alerts
- Blocked-day prompt + manual alert button feed into existing `send-client-message` infra.
- Channels: **SMS + Email** (toggleable). Uses `service_alerts` table for tracking.

## 8. Payments Tab (Sitter Dashboard)
- New **Payments** tab: list bookings with Paid / Outstanding status.
- Enable Stripe **off-session** saved cards (`setup_future_usage: 'off_session'`).
- New edge function `charge-saved-card` for one-click re-charges.

## Overlap Resolutions
- Pet Profiles page replaces ad-hoc pet editing UI in account.
- AI Assistant lives only on Schedule page (no duplicate tab).
- Alerts use existing `send-client-message` — no parallel system.

## Technical Summary
- **Files**: `SitterDashboard.tsx`, `src/lib/booking.ts`, `src/components/TestimonialsSection.tsx`, `src/components/MeetSitter.tsx`, `src/pages/Hero*`, new `src/pages/PetProfiles.tsx`, new `supabase/functions/charge-saved-card/`.
- **DB migrations**: `pets.temperament_notes`, updated `services` / `service_variants` rows, Stripe customer fields on `profiles`.
- **Edge functions**: new `charge-saved-card`; reuse `send-client-message` and `assistant-schedule-plan`.

Reply **"go"** and I'll start building.