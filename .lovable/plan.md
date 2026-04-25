# Audit: pet approval flow, request inbox, AI assistant

## What's actually broken

There are **3 booking requests sitting in the database right now** (Apr 27, May 1) that you can't see or approve from the new `/sitter` UI. The whole approve-a-request workflow only exists in the legacy `/sitter-classic` page. Here's the chain of breakage:

1. **Inbox shows requests, but the link goes nowhere useful.** `/sitter/inbox` lists each request and links to `/sitter/calendar`. But `/sitter/calendar` *explicitly excludes* `requested` bookings (line 47 filters them out), so the calendar always looks empty for new requests. That's the "blank calendar" you saw.

2. **There is no approval UI at `/sitter/...` at all.** The price-override + "Approve" button, the pet-fit decision (approve / decline), the per-pet conflict alerts, and the recurrence/group-walk scheduling all live exclusively in `src/pages/SitterDashboard.tsx` (the legacy `/sitter-classic` page). The new shell's "New booking" button on the calendar even links back to `/sitter-classic#schedule` — that's an admission the new UI never finished the approval surface.

3. **Email/SMS links point at the wrong place.** The notify-new-booking-request SMS has no link at all (just text). Any "request" link in older emails/notifications points to `/sitter-classic#schedule`, which is the legacy dashboard that requires you to scroll to find the right pending request. There's no deep link to the specific booking.

4. **AI scheduling assistant is also only reachable from `/sitter-classic`.** The new Availability settings page even tells you to "Open AI assistant" by jumping to the classic dashboard. The functions (`assistant-schedule-plan`, `assistant-schedule-execute`) themselves haven't been called recently (no logs). They probably work, but you can't reach them from the new shell.

5. **Pet profile has no "approve for service" action.** `/sitter/pets/:id` shows fit alerts but offers no button to mark a pet as approved/declined for a service. That decision is gated behind the legacy approvals tab.

## Plan: fix it in the new UI

### 1. Build a real Request Detail page (new)
Create `src/pages/sitter/RequestDetail.tsx` at route `/sitter/requests/:bookingId`. This becomes the single canonical place to approve a request. It will:
- Show requested date, window label, recurrence, group label, customer, pet, service.
- Show pet-fit status for the service with **Approve fit / Decline fit** buttons (writes to `pet_fit_alerts` and the pet-approval workflow used by the legacy dashboard).
- Editable fields: scheduled start/end (defaulted from the requested window), approved base price, extra time minutes, late pickup fee, internal notes.
- **Approve** button: sets `status = confirmed` (instant/solo) or `awaiting_payment` (group/deposit-required), stamps `approved_at`/`approved_by`, fills `scheduled_start_at`/`scheduled_end_at`, recomputes `total_cents`, then invokes `booking-workflow` with the right action (mirrors the existing `approveRequest` function in `SitterDashboard.tsx`).
- **Decline** button: sets `status = cancelled` and triggers a customer notification.
- Reuses the same logic from `SitterDashboard.tsx` lines 1622–1730 (extracted into a shared helper `src/lib/approveBooking.ts` so both pages stay in sync).

### 2. Update the Inbox to deep-link to the new page
In `src/pages/sitter/Inbox.tsx`, change the request row's `href` from `/sitter/calendar` to `/sitter/requests/${r.id}`. Approval rows link to `/sitter/pets/${a.pet_id}?alert=${a.id}`.

### 3. Add request visibility on the calendar
In `src/pages/sitter/Calendar.tsx`, stop filtering out `requested`. Instead include them and render request blocks in a different style (dashed border, "Pending" badge). Clicking a request block opens `/sitter/requests/:id`. This way the calendar actually reflects what's pending.

### 4. Add approval actions on the Pet profile
In `src/pages/sitter/PetProfile.tsx`, surface a "Pet fit decisions" card showing per-service status (approved / declined / pending) for that pet. Each row gets Approve / Decline buttons (for the services the pet has actually been booked for). This writes the same `pet_approvals` records the legacy dashboard uses, so a fit decision made here unblocks the request page automatically.

### 5. Add a real Schedule Assistant page
Create `src/pages/sitter/ScheduleAssistant.tsx` at `/sitter/assistant`. Move the natural-language command UI out of the legacy dashboard so it lives in the new shell. Add it to `SitterShell.tsx` nav. Inside:
- Fetch the same context the legacy dashboard builds (services, availability, walk windows, blocked dates, request groups).
- Call `assistant-schedule-plan`, show the plan card, allow user to confirm/edit, then call `assistant-schedule-execute`.
- **Wrap in error containment**: catch 5xx/network errors and show "Assistant is temporarily unavailable — you can still approve requests manually from the Inbox." instead of a blank screen.
- Update `src/pages/sitter/settings/Availability.tsx` to point its "Open AI assistant" link to `/sitter/assistant` instead of `/sitter-classic#schedule`.

### 6. Fix email/SMS links
- `notify-new-booking-request/index.ts`: append a deep link to the SMS body — `https://yodawg.ca/sitter/requests/{bookingId}`.
- Add a new transactional email template `booking-request-received-sitter` that's sent to Anneke alongside the SMS, with a clear "Open request" button linking to `/sitter/requests/{bookingId}`. Existing customer-facing `walk-request-received` email is unchanged.
- Audit `send-booking-update`, `send-payment-reminder`, etc. for any leftover `/sitter-classic` links and rewrite to the corresponding `/sitter/*` route.

### 7. Defensive error handling on the assistant edge functions
Per the recommended pattern, wrap the Lovable AI gateway call in `assistant-schedule-plan/index.ts` so 429/402/500 responses return `{ ok: false, fallback: true, error }` with HTTP 200 instead of a 500. The new ScheduleAssistant UI checks `fallback` and shows a graceful message rather than a thrown error.

## Files touched

```text
new   src/pages/sitter/RequestDetail.tsx
new   src/pages/sitter/ScheduleAssistant.tsx
new   src/lib/approveBooking.ts                 (extracted shared logic)
new   supabase/functions/_shared/transactional-email-templates/booking-request-received-sitter.tsx
edit  src/App.tsx                               (2 new routes)
edit  src/components/sitter/SitterShell.tsx     (add Assistant nav item)
edit  src/pages/sitter/Inbox.tsx                (deep links)
edit  src/pages/sitter/Calendar.tsx             (include requested, click → request page)
edit  src/pages/sitter/PetProfile.tsx           (fit-decision card)
edit  src/pages/sitter/settings/Availability.tsx (assistant link)
edit  supabase/functions/notify-new-booking-request/index.ts (SMS deep link + email)
edit  supabase/functions/_shared/transactional-email-templates/registry.ts
edit  supabase/functions/assistant-schedule-plan/index.ts (error containment)
edit  supabase/functions/assistant-schedule-execute/index.ts (error containment)
```

## Out of scope (leaving alone)
- The legacy `/sitter-classic` dashboard stays as a fallback while the new flow stabilizes. We can delete it once the new pages are battle-tested.
- No DB schema changes — we reuse `bookings`, `pet_fit_alerts`, `booking_request_groups` as-is.
- No Stripe changes — the in-progress Stripe account migration is unaffected by this work.
