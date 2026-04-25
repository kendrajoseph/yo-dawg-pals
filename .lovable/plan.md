# Full Site Audit — Findings & Fix Plan

I ran the security scanner, the database linter, a production build, edge-function log inspection, a database state check, and a code review across auth, payments, messaging, and booking. Build is clean. Linter is clean. No edge function has thrown a 4xx/5xx in recent history. Below are the real issues, ranked by risk.

## Critical issues

### 1. Customer profiles are publicly readable (data leak)
The `profiles` table has a SELECT policy `USING (true)` for the `public` (unauthenticated) role. Anyone on the internet can read every customer's:
- full name, phone, mobile phone
- **Stripe customer ID and saved payment method ID**
- the `bio` field — which currently contains door codes like "code for front door is 2873" for two clients

This is a serious leak. Fix: replace the public SELECT policy with two narrower ones:
- Authenticated user can read their own row (all columns).
- Sitters/admins can read all rows (needed for the sitter dashboard).
- A separate `profiles_public` view exposing only `id`, `full_name`, `avatar_url` for the few places the marketing site / public invoice page needs a name. The base table denies anonymous reads.

### 2. Sitter "blocked dates" reasons leak privacy
`blocked_dates.reason` is publicly readable (e.g. "family day"). Lock this table to authenticated reads only — the booking flow already requires a logged-in user.

### 3. No `/reset-password` page
Auth.tsx has no "forgot password" link and no `/reset-password` route. If we ever email a reset link, the user lands signed in **without setting a new password**. Add:
- "Forgot password?" link on Sign In tab → calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })`.
- Public `/reset-password` route with a "set new password" form that calls `supabase.auth.updateUser({ password })`.

## Verified working (no fix needed)
- Build compiles, no TS errors, no console errors at runtime (only benign Radix tooltip ref warnings).
- Edge functions: zero recent 4xx/5xx across `payments-webhook`, `create-checkout`, `cancel-booking`, `pay-invoice-public`, `send-client-message`, `send-transactional-email`.
- Webhook idempotency table exists (`processed_stripe_events`) and refund tiering is in place.
- Google sign-in button wired through `lovable.auth.signInWithOAuth`.
- Saved-card flow (`charge-saved-card`, `remove-saved-card`) is consistent with the webhook now.
- Messages page fetches profiles in a second query — confirmed working with current data.

## State observations (informational, not fixes)
- 9 bookings exist; **0 have `paid_at`** and `processed_stripe_events` is empty — meaning a real Stripe checkout has never completed end-to-end in this project. The wiring is correct in code but unverified by data. Live testing in the preview is needed (steps below).
- Latest customer message (`56ff9a16…`) shows `delivered_email_at` set but `delivered_sms_at` null despite `send_sms=true`. Likely the customer has no `mobile_phone` or `sms_opt_in=false`. Worth confirming, not a bug per se.

## Out of scope (deliberately deferred)
- Bundle size >500 KB warning — performance, not correctness.
- Benign React "Function components cannot be given refs" warnings from Radix Tooltip wrapping `TestimonialsSection` / `SiteFooter` — no behavioural impact.
- The `useAuth.isSitter` flag is `true` only when the user is Anneke (intentional per RLS); non-Anneke admins use `canManageDashboard`. Consistent with how RLS gates writes.

---

## Implementation plan

### Step 1 — Lock down `profiles`
Migration:
```sql
DROP POLICY "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Sitters and admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'sitter') OR has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT id, full_name, avatar_url FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;
```
Audit existing client code (`Account.tsx`, `Profile.tsx`, `PaymentSettings.tsx`, sitter pages) — all queries are already scoped to `auth.uid()` or run under the sitter role, so they keep working.

### Step 2 — Lock down `blocked_dates`
```sql
DROP POLICY "Blocked dates are public" ON public.blocked_dates;
CREATE POLICY "Authenticated users read blocked dates" ON public.blocked_dates
  FOR SELECT TO authenticated USING (true);
```
The booking flow on `/book` already requires sign-in before checkout, so this won't break UX.

### Step 3 — Password reset flow
- Add "Forgot password?" link under the sign-in form on `Auth.tsx` that opens a small dialog asking for email and calls `resetPasswordForEmail`.
- Create `src/pages/ResetPassword.tsx` and add `<Route path="/reset-password" element={<ResetPassword />} />` to `App.tsx`. The page reads the recovery hash, lets the user set a new password via `supabase.auth.updateUser({ password })`, then redirects to `/account`.

### Step 4 — Re-run security scan to confirm green.

---

## How to test the updated flows in the preview

Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode. Test mode banner is already wired.

1. **Sign in / sign up**
   - Try Google sign-in (should redirect → return signed-in).
   - Try email signup with a weak password ("password") → should be rejected (HIBP).
   - Open `/auth`, click "Forgot password?", enter your test email, check inbox, follow link → land on `/reset-password`, set new password, confirm you can sign in with it.

2. **Book + pay (live E2E we haven't validated yet)**
   - Visit `/book`, pick a paid service (Solo Walk $35), follow the flow, accept terms.
   - On the embedded Stripe checkout, pay with `4242 4242 4242 4242`.
   - Verify `/account` shows the booking as "confirmed" and Payment history lists "Payment received $35.00".
   - Verify in DB: the booking has `paid_at` set and `processed_stripe_events` has one row.

3. **Refund tiers (cancel-booking)**
   - Have Anneke create a fake booking 30 hours out → cancel as customer → expect 100% refund.
   - Repeat 18 hours out → expect 50% refund.
   - Repeat 6 hours out → expect 0% refund. All three should appear in Payment history with the right kind (refund vs partial vs none).

4. **Saved card**
   - After step 2, open `/account` → Payment Settings → confirm "card on file".
   - As Anneke (sitter view), open the booking → "Charge saved card" for any extra-time fee → confirm a new payment_event of kind `charge_succeeded` shows up.
   - Click "Remove card" on `/account` → re-attempt off-session charge → it should fail cleanly with "no saved card".

5. **Public invoice**
   - From sitter Invoices, send an invoice link to your email.
   - Open `/pay/<token>` in an incognito window → embedded Stripe checkout loads → pay with the test card → invoice flips to "paid".

6. **Privacy regression checks (after Step 1+2)**
   - In incognito (logged out), open the network tab and try `supabase.from('profiles').select('*')` via the console → should return zero rows.
   - Same for `blocked_dates`.
   - Logged in as a non-sitter customer → `profiles` query should return only your own row.

Once you approve, I'll implement Steps 1–3 and re-run the security scan.
