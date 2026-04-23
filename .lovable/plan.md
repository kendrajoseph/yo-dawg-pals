
Goal: add an approval audit log entry to each booking that shows who approved it and whether the client notification was successfully queued.

1. Extend booking update types to support approval audit entries
- Add a new booking update kind for approval-related history so approval events can live in the existing `booking_updates` timeline instead of introducing a second audit surface.
- Use a migration to extend `public.booking_update_kind` with a value such as `approval`.
- Keep the existing `booking_updates` table and RLS policies unchanged so customers and sitters can already view the new audit entries on the booking.

2. Return richer approval metadata from the booking workflow
- Update `supabase/functions/booking-workflow/index.ts` so approval actions return enough information to create a human-readable audit entry:
  - notification type (`confirmation_email` or `payment_alert`)
  - notification status (`sent`, `skipped`, `failed`)
  - notification message
  - attempt number if available
- Preserve the current behavior where approval can succeed even if the client notification fails.

3. Write an approval audit entry after approval succeeds
- In `src/pages/SitterDashboard.tsx`, after the approval save + workflow call completes, insert a `booking_updates` row for that booking.
- Record:
  - `booking_id`
  - `created_by` as the signed-in sitter/admin
  - `kind: "approval"`
  - a message such as:
    - “Approved by Anneke. Confirmation email queued for the client.”
    - “Approved by Anneke. Payment alert was skipped because no email address is on file.”
    - “Approved by Anneke. Payment alert failed to queue: …”
- Only create this audit entry once per approval action, not on retries.

4. Make the message identify who approved the booking
- Use the signed-in user’s name when available from existing profile data, with a safe fallback if the name is missing.
- Keep the message readable in both sitter and customer views without needing extra joins when rendering.
- Word the entry around “queued” or “not queued” rather than “sent” so it accurately reflects the app email pipeline.

5. Show approval audit entries in booking history UI
- Update the booking update label maps in:
  - `src/pages/SitterDashboard.tsx`
  - `src/pages/Account.tsx`
- Add a friendly label for the new kind, e.g. “Approval”.
- Reuse the existing booking updates list on each booking card so the audit appears automatically under the booking’s history.

6. Keep approval and retry history distinct
- Approval audit entries should capture the initial approval event only.
- Notification retries should continue to live in `booking_notification_attempts` and not create duplicate approval log entries.
- If desired, the approval message can mention the initial queue result while retry attempts remain visible in the sitter notification-attempt UI already built.

7. Verify the key scenarios
- Confirmed booking approval:
  - audit entry says who approved it
  - states confirmation email was queued / skipped / failed
- Awaiting-payment approval:
  - audit entry says who approved it
  - states payment alert was queued / skipped / failed
- Customer account view:
  - approval entry appears in the existing “Care updates” history for that booking
- Sitter dashboard:
  - approval entry appears in the booking’s recent updates/history list

Technical details
- Files to update:
  - `supabase/migrations/...` to add the new `booking_update_kind` enum value
  - `src/pages/SitterDashboard.tsx`
  - `src/pages/Account.tsx`
  - optionally `supabase/functions/booking-workflow/index.ts` if response wording needs to distinguish queued/skipped/failed more explicitly
- Important constraint:
  - do not edit `src/integrations/supabase/types.ts` manually; the generated types should refresh from the backend schema change
- Recommended approval audit message pattern:
```ts
Approved by {approverName}. {Confirmation email|Payment alert} {was successfully queued for delivery|was skipped because ...|failed to queue: ...}
```
