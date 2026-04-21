

## Set up Anneke's owner account (anneke@yodawg.ca)

Goal: when Anneke signs up with `anneke@yodawg.ca`, she automatically gets `sitter` + `admin` roles so she can access `/sitter` to manage the calendar, availability, and bookings.

### How it will work

1. **Auto-promotion trigger** — Update the existing `handle_new_user()` database function so that when a new user signs up:
   - Everyone still gets a `profiles` row + default `customer` role (current behavior).
   - **If the email is `anneke@yodawg.ca`**, also insert `sitter` and `admin` roles for that user.

2. **Anneke signs up normally** — She goes to `/auth`, picks the "Sign up" tab, enters her name, `anneke@yodawg.ca`, and a password. The trigger runs server-side and grants her elevated roles instantly. No manual role assignment needed, ever.

3. **She lands in the right place** — After signup she's redirected to `/account`. Because `isSitter` is now `true`, the existing nav will show the "Sitter" link to `/sitter`, where she can manage availability, blocked dates, and bookings (already built in `SitterDashboard.tsx`).

4. **Safety net** — If Anneke (or you) already created an account with that email before this trigger existed, I'll also run a one-time backfill that grants her the roles retroactively.

### Technical details

- **Migration**: replace `public.handle_new_user()` with a version that checks `NEW.email = 'anneke@yodawg.ca'` (case-insensitive) and inserts `('sitter')` and `('admin')` into `user_roles` in addition to `customer`. Keep `SECURITY DEFINER` and `search_path = public`.
- **Backfill (data op via insert tool)**: `INSERT INTO user_roles (user_id, role) SELECT id, 'sitter' FROM auth.users WHERE lower(email) = 'anneke@yodawg.ca' ON CONFLICT DO NOTHING;` — same for `'admin'`. No-op if the account doesn't exist yet.
- **Email confirmation**: Supabase auth currently requires email verification by default. Since Anneke's domain `yodawg.ca` is already connected and her mailbox isn't set up yet, she won't be able to click the confirmation link. **Recommended**: temporarily enable auto-confirm so she can sign in immediately, then turn it back off once her mailbox works. Alternative: leave verification on and wait until her email is live.
- No app code changes needed — `useAuth`, `ProtectedRoute`, `SiteNav`, and `SitterDashboard` already react correctly to the `sitter` role.

### What I need from you

One quick choice on the email-confirmation question above (auto-confirm now vs. wait for her mailbox) — I'll ask in the next step before running the migration.

