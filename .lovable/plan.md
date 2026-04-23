
Goal: let sitters/admins retry a failed client notification after approval, and keep a reliable history of each notification attempt.

1. Add a dedicated notification-attempt log table
- Create a new backend table such as `booking_notification_attempts` to store one row per approval notification attempt.
- Record:
  - `booking_id`
  - `notification_type` (`confirmation_email` | `payment_alert`)
  - `trigger_source` (`approval` | `retry`)
  - `attempt_number`
  - `status` (`sent` | `skipped` | `failed`)
  - `message`
  - `error_message`
  - `attempted_by`
  - `created_at`
- Enable RLS and allow authenticated admin/sitter users to read attempts for bookings they own as sitter, and insert through the workflow path only.
- Keep roles enforced via the existing separate `user_roles` table pattern.

2. Centralize notification sending inside the booking workflow function
- Refactor `supabase/functions/booking-workflow/index.ts` so approval sends and retry sends use one shared helper.
- Add new actions for retrying:
  - `retry_confirmation_email`
  - `retry_payment_alert`
- Keep the existing approval actions unchanged for booking state updates, but make the notification helper:
  - resolve recipient + template
  - call `send-transactional-email`
  - correctly interpret both hard errors and “success: false” responses like suppression/unsubscribe
  - insert an attempt row into `booking_notification_attempts`
  - return structured response data including latest attempt status and attempt count
- For retry actions, do not re-approve or re-open payment; only re-send the client notification for the already-approved booking.

3. Record initial sends and retries consistently
- When a booking is first approved, log that notification attempt in the new table as attempt 1.
- When a retry is triggered, increment the attempt number for that booking + notification type.
- Store user-friendly failure reasons such as:
  - email provider invocation failed
  - recipient email missing
  - email suppressed/unsubscribed
- This gives a full audit trail instead of only the latest toast.

4. Load notification attempt state into the sitter dashboard
- In `src/pages/SitterDashboard.tsx`, fetch recent notification-attempt rows alongside bookings.
- Build a per-booking map of the latest attempt so the UI knows:
  - whether the latest alert succeeded, was skipped, or failed
  - which kind of alert it was
  - how many attempts have been made
- Keep this read-only summary client-side; the workflow function remains the write path.

5. Add retry UI where failed notifications are visible
- Show a retry control on bookings whose latest notification status is `failed`.
- Place it where the sitter already manages approvals so it remains visible after the initial toast disappears.
- Label the action based on booking state:
  - confirmed booking: “Retry confirmation email”
  - awaiting-payment booking: “Retry payment alert”
- Disable the button while retrying and refresh the booking/attempt state after completion.

6. Upgrade the approval-failure toast to include an immediate retry action
- When approval succeeds but notification fails, keep the destructive toast.
- Add a toast action button that triggers the retry immediately from the toast.
- The same retry handler should also back the persistent inline retry button so both paths behave identically.
- Successful retry should replace ambiguity with a clear toast like:
  - “Confirmation email sent to the client.”
  - “Payment alert sent to the client.”
- Skipped retry outcomes should explain why no email was sent.

7. Keep retry behavior safe and explicit
- Only allow retrying notifications for bookings already in a post-approval state (`confirmed` or `awaiting_payment` / equivalent current payment-open status).
- Do not retry if the booking does not belong to the signed-in sitter/admin.
- Do not mutate booking timing/pricing on retry.
- If the recipient has no email or is suppressed, record the retry attempt but return a skipped result instead of pretending it sent.

8. Verify the end-to-end outcomes
- Test these scenarios:
  - approval sends successfully on first try
  - approval saves but notification fails, then retry succeeds
  - retry fails again and increments attempt count
  - retry is skipped because no email exists
  - retry is skipped because the address is suppressed/unsubscribed
- Confirm the sitter sees both:
  - a clear toast outcome
  - persistent retry/history state in the dashboard

Technical details
- Files to update:
  - `supabase/migrations/...` for the new notification attempts table + RLS
  - `supabase/functions/booking-workflow/index.ts`
  - `src/pages/SitterDashboard.tsx`
- Recommended workflow response shape:
```ts
{
  ok: boolean;
  notificationStatus: "sent" | "skipped" | "failed";
  notificationType: "confirmation_email" | "payment_alert";
  notificationMessage: string;
  attemptNumber?: number;
  retryAvailable?: boolean;
}
```
- Recommended table shape:
```ts
booking_notification_attempts
- id
- booking_id
- notification_type
- trigger_source
- attempt_number
- status
- message
- error_message
- attempted_by
- created_at
```
- Important implementation detail:
  - Treat `send-transactional-email` responses with `success: false` as non-sent outcomes and log them explicitly; do not rely only on transport-level errors.
