
Goal: verify whether client SMS delivery is working end-to-end and identify any remaining breakpoints.

What is already in place
- The app does have active SMS wiring in the backend:
  - `send-booking-update` sends client SMS for pickup/dropoff/note updates.
  - `send-client-message` can send direct client SMS from the dashboard.
  - `notify-new-booking-request` sends SMS to the sitter for new requests.
- Required backend secrets already exist for SMS:
  - `LOVABLE_API_KEY`
  - `TWILIO_API_KEY`
  - `TWILIO_FROM_NUMBER`
- Client SMS is intentionally gated by profile settings:
  - the client must have `profiles.mobile_phone`
  - the client must have `profiles.sms_opt_in = true`

What cannot be confirmed in read-only mode
- I can confirm the code path is present, but I cannot confirm real delivery from code alone.
- To truly confirm SMS works, runtime testing is needed against the live backend and function logs.

Verification plan
1. Test the sitter-to-client SMS path from the dashboard
- Trigger `send-booking-update` using a booking tied to a client who has:
  - a valid mobile number
  - text updates enabled
- Confirm the function returns:
  - `ok: true`
  - `smsSent: true`
  - no `smsError`

2. Test the direct client message SMS path
- Trigger `send-client-message` from the admin dashboard with `sendSms: true`.
- Confirm the response includes:
  - `ok: true`
  - `smsSent: true`
  - `delivered_sms_at` written on the related `client_messages` row

3. Inspect backend logs for Twilio gateway responses
- Check logs for:
  - `send-booking-update`
  - `send-client-message`
  - `notify-new-booking-request`
- Look specifically for any `Twilio API error [...]` messages, invalid-number failures, or auth/gateway errors.

4. Verify data prerequisites for affected clients
- Confirm the target client records actually satisfy the SMS conditions:
  - `profiles.mobile_phone` is populated
  - `profiles.sms_opt_in` is true
- If SMS appears to “not send,” this is the first likely cause based on current code.

5. Verify dashboard feedback matches actual delivery
- Confirm the sitter dashboard toast messages reflect the function response correctly:
  - success when `smsSent: true`
  - warning/fallback when SMS is skipped or fails
- If needed, tighten the UI copy so skipped texts are unmistakable.

Likely outcomes
- If logs show successful Twilio responses and `smsSent: true`, SMS is working.
- If the function returns success but `smsSent: false`, the most likely reason is missing client opt-in or missing mobile number.
- If logs show Twilio errors, the issue is likely phone formatting, sending-number restrictions, or connector-side delivery failure.

Technical details
- Relevant files already supporting SMS:
  - `supabase/functions/send-booking-update/index.ts`
  - `supabase/functions/send-client-message/index.ts`
  - `supabase/functions/notify-new-booking-request/index.ts`
  - `src/pages/SitterDashboard.tsx`
  - `src/pages/Profile.tsx`
- Important behavioral detail:
  - `send-booking-update` only sends when `sendSms && profile.sms_opt_in && profile.mobile_phone`
  - `send-client-message` only sends when `sendSms && profile.sms_opt_in && profile.mobile_phone && LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_FROM_NUMBER`
- Current code already normalizes numbers to E.164 format before sending.

Implementation if you approve
- Run live function tests and inspect backend logs.
- Confirm one real SMS flow end-to-end.
- If anything fails, patch either the backend error handling or the dashboard messaging so the failure reason is explicit.
