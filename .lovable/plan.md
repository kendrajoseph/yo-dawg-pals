## Booking Flow Overhaul

A focused pass over `src/pages/Book.tsx`, the request-confirmation email, and the request-notification edge function to fix bugs, clean up copy, and add the missing multi-night / multi-pet capabilities.

---

### 1. Boarding multi-night support

**Problem:** Boarding logic in `buildBookingPayload` already calculates `$70 first night + $60 each additional night`, but the UI never lets the user pick a checkout date — boarding is forced to one-off and the calendar only captures a single drop-off day.

**Fix:**
- Show a second calendar (or date input) on the Schedule step when the active service is boarding: "Drop-off date" and "Pick-up date".
- `requested_end_date` is set from the pick-up date.
- Live preview: "3 nights · Apr 25 → Apr 28 · $190 total (incl. tax)".
- Disable past/blocked pick-up dates and require pick-up ≥ drop-off + 1 day.
- Existing pricing function (`calculateBoardingTotalCents`) already handles this correctly.

---

### 2. Multi-pet selection per request (with sibling discount)

**Problem:** Each bundle item only takes one pet. To request a Group Walk or Boarding for two siblings the user has to manually add another bundle item.

**Fix:**
- On the Pet step, change pet selection from radio (one) to checkbox (many).
- On submit, fan out: one `bookings` row per (bundle item × pet), all sharing one `request_group_id`.
- Apply 50% sibling discount automatically to the 2nd+ pet within the same service slug per request (using existing `applySiblingDiscount` and `service_variants.sibling_discount_percent`).
- Show per-pet pricing breakdown on the Review step.

---

### 3. Show total customer will pay if approved

On the Review step, render a clear order summary:

```text
Group Walk · Biscuit          $30.00
Group Walk · Mochi (50% off)  $15.00
Boarding · Mochi (3 nights)  $190.00
─────────────────────────────────────
Estimated total              $235.00  (all prices include tax)
Due if approved              $235.00
```

Plus a small note: "You'll only be charged if Anneke approves your request."

---

### 4. Email confirmation with request details

**Problem:** `walk-request-received.tsx` is generic ("thanks for reaching out"). No request details.

**Fix:** Update the template to accept and render:
- Customer name, pet names, service(s) requested
- Requested date(s), time window, recurrence
- Estimated total
- A friendly note: "Anneke will review and reach out within 24 hours."

Update `booking-workflow` `request_received` action to send **one** consolidated email per `request_group_id` (not one per booking) with all bundle details, and pass that `templateData`.

---

### 5. Fix duplicate booking requests

**Root cause:** `submit()` loops over every inserted booking and invokes both `notify-new-booking-request` and `booking-workflow:request_received` per row. With a multi-pet/multi-service bundle this creates N sitter notifications and N customer emails for a single submission.

**Fix:**
- Send sitter notification **once per `request_group_id`** (group payload, not per booking) — update `notify-new-booking-request` to accept `requestGroupId` and look up all bookings in the group.
- Send customer "request received" email **once per group**.
- Add an idempotency guard at the start of `submit()` (`if (submitting) return;`) and disable the button immediately on first click (already done via state but add a ref-based latch to defeat any StrictMode double-fire in dev).

---

### 6. Bundle Builder cosmetic cleanup

In step 0 (service picker):
- Remove "Pet approval" badge.
- Remove "Protected scheduling window" badge.
- Remove the "Manual review" / "Instant booking" pill in the service header (this is the source of "approved by anneke before payment opens" framing).
- Replace with a single subtle line under each service description: "All prices include tax."

Remove the small "Manual review · approved before payment" copy anywhere it appears in the schedule and review steps.

---

### 7. Single disclaimer + "Submit request" button

Step 3 (Review) currently has the T&C checkbox. Replace the trailing controls:

- One disclaimer block above the button:
  > "By submitting you agree to the [Terms & Conditions](/terms). All prices include tax. Submitting a request doesn't charge your card — Anneke will review and confirm."
- Change the button label from **"Send request"** to **"Submit request"**.
- Remove the "Continue" → "Send request" wording mismatch on prior steps (keep "Continue" for steps 0–2, "Submit request" only on step 3).

---

### 8. Warm confirmation pop-up after submission

Replace the immediate `navigate(...)` with a modal dialog that shows:
- Friendly heading: "Thanks — your request is in! 🐾"
- Bullet list of what was requested (services, pets, dates, estimated total)
- "Anneke will personally review your request and be in touch soon. Keep an eye on your inbox!"
- Two buttons: **View my requests** (→ `/account` or `/booking/:id/success`) and **Close**.

The confirmation email continues to send in parallel.

---

### 9. Fix the broken weekly / biweekly / daily "Repeat every" field

**Problem:** When repeat is `weekly` or `biweekly`, the UI shows `repeatInterval` ("Repeat every N days") but the field is meaningless because the cadence is already encoded by the frequency name. For `daily`, the field works but is rarely needed.

**Fix:**
- Remove the `repeatInterval` numeric input entirely.
- Keep the frequency Select (One-off, Daily, Weekly, Biweekly, Monthly).
- Keep the day-of-week chips for Weekly/Biweekly.
- Keep the "Until (optional)" end date.
- Update `recurrence_pattern` payload to omit `interval`.
- Update `getRepeatSummary` to drop the "Every N days" branch.

---

### 10. Booking flow audit findings (also addressed)

- `validateScheduleStep` blocks boarding repeats — leave that, but fix the message to: "Boarding stays use a drop-off and pick-up date instead of a recurring schedule."
- The bottom hint "Weekly, biweekly, daily, and monthly repeats are supported…" remains accurate.
- `existing` bookings query filters out `requested` from calendar conflict counting only via the boundary loop — verified this is correct, no change needed.
- `notify-new-booking-request` already deduplicates via `sitter_notifications` — keep that, just switch the keying to `request_group_id` once available.

---

### Technical Details

**Files to edit**
- `src/pages/Book.tsx` — multi-night UI, multi-pet checkbox, totals, repeat-field cleanup, copy changes, confirmation modal, idempotency latch.
- `src/lib/booking.ts` — small helper to compute group total cents (sum across bundle items × pets with sibling discount).
- `supabase/functions/_shared/transactional-email-templates/walk-request-received.tsx` — accept request details, render summary table, friendlier copy.
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — no change (template name same).
- `supabase/functions/booking-workflow/index.ts` — `request_received` action: accept `requestGroupId`, fetch all group bookings, send one email with consolidated details. Deploy.
- `supabase/functions/notify-new-booking-request/index.ts` — accept `requestGroupId`, dedupe by group, send one SMS + one sitter notification per group. Deploy.

**No database migration required** — `request_group_id`, `requested_end_date`, `sibling_discount_percent`, and boarding extra-night variant already exist.

**Behavioural contract**
- One submission → one `request_group` row → N booking rows (one per bundle-item × pet) → exactly one sitter SMS + one sitter notification + one customer email.
- Modal stays open until the user dismisses; email and notifications fire in the background.
