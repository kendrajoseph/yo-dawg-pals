
Goal: show a clear toast in the sitter dashboard after approving a service that tells the sitter whether the client-facing email/payment alert was successfully sent, skipped, or failed.

1. Update the booking workflow function to return notification status details
- In `supabase/functions/booking-workflow/index.ts`, keep the existing approval behavior but expand the JSON response for approval actions.
- For `schedule_solo_walk`, return structured fields such as:
  - `ok`
  - `notificationStatus: "sent" | "skipped" | "failed"`
  - `notificationType: "confirmation_email"`
  - `notificationMessage`
- For `approve_group_walk`, return similar fields, using `notificationType: "payment_alert"`.
- Treat these cases distinctly:
  - sent successfully
  - skipped because client email is missing
  - failed because the app email send invocation returned an error
- Preserve the current booking update logic, but stop returning only `{ ok: true }` for success.

2. Make the workflow function detect send failures instead of silently succeeding
- Capture the result of `supabase.functions.invoke("send-transactional-email", ...)`.
- If the email send call returns an error, surface that in the response payload instead of pretending the whole workflow succeeded silently.
- Keep the approval saved even if the client alert fails, but report that explicitly in the response.

3. Update the dashboard approval toast to use the returned notification status
- In `src/pages/SitterDashboard.tsx`, keep the current approval/save flow, but replace the generic success toast:
  - current: “Request confirmed” / “Payment opened”
  - new: success toast with a description that says whether the client email/payment alert was sent
- Show user-friendly outcomes like:
  - “Request confirmed” + “Confirmation email sent to the client.”
  - “Payment opened” + “Payment alert sent to the client.”
  - “Request confirmed” + “Client email was skipped because no email address is on file.”
- Keep destructive toasts for genuine send failures after the approval was saved.

4. Differentiate approval-save success from notification-send success
- Continue showing a destructive toast if the approval was saved but the client alert failed.
- Improve the copy so it clearly communicates both parts:
  - booking approval/payment state was updated
  - client-facing notification failed
- This avoids the current ambiguity where the sitter cannot tell whether the alert went out.

5. Keep wording specific to the action taken
- For free/confirmed services:
  - mention confirmation email
- For paid/awaiting-payment services:
  - mention payment alert/payment request
- Use the same `nextStatus` logic already present in `approveRequest` so the toast copy matches the actual workflow branch.

6. Verify all approval outcomes
- Test these scenarios after implementation:
  - confirmed booking with successful client email
  - awaiting-payment booking with successful payment alert
  - missing client email
  - email send failure from the workflow function
- Confirm the sitter always gets one clear toast describing the client alert outcome.

Technical details
- Files to update:
  - `supabase/functions/booking-workflow/index.ts`
  - `src/pages/SitterDashboard.tsx`
- Recommended response shape from workflow:
```ts
{
  ok: true,
  notificationStatus: "sent" | "skipped" | "failed",
  notificationType: "confirmation_email" | "payment_alert",
  notificationMessage: string
}
```
- Dashboard toast behavior:
  - success/info toast when approval succeeded and notification was sent or skipped
  - destructive toast when approval succeeded but notification failed
