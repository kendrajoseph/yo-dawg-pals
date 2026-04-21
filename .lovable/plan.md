

## Add a customer profile page

### What customers will see

A new **"My profile"** page at `/account/profile` where logged-in customers can view and edit their own info, plus a "Profile" button on the `/account` dashboard alongside "My pets" and "Book a service."

The profile card shows:
- **Avatar** — circular, with an upload button (drag-or-click). Stored in the existing public `avatars` bucket at `avatars/{user.id}.{ext}`.
- **Full name** — text input
- **Email** — read-only (shown from `auth.users`, not editable here since it requires auth flow)
- **Phone number** — text input, formatted as `(555) 123-4567`
- **Short bio / notes for your sitter** — textarea (uses existing `bio` column; relabeled for customer context — "anything your sitter should know about you, gate codes, parking, etc.")
- **Save changes** button — toast on success, validation errors inline.

A small **"Account"** sub-section underneath shows:
- Account created date
- Sign out button (already in nav, but handy here too)

### Files to create / edit

- **Create `src/pages/Profile.tsx`** — fetches `profiles` row by `user.id`, edit form with Zod validation (`full_name` 1–100 chars, `phone` optional E.164-ish, `bio` ≤ 1000 chars), avatar upload to `avatars` bucket, then `update` on `profiles`.
- **Edit `src/App.tsx`** — add `<Route path="/account/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />`.
- **Edit `src/pages/Account.tsx`** — add a "Profile" button (User icon) to the action row.
- **Edit `src/components/SiteNav.tsx`** — add "Profile" to the user dropdown / mobile menu.

### Technical notes

- No DB migration needed — `profiles` table and policies (`Users update own profile`, `Users insert own profile`) already cover it.
- Avatar upload: `supabase.storage.from("avatars").upload(\`${user.id}/${Date.now()}.${ext}\`, file, { upsert: true })`, then save the public URL to `profiles.avatar_url`.
- Uses existing brand styling — `border-4 border-primary`, `shadow-pop`, `font-display uppercase` buttons, `font-tag text-clay` headings — to match `/account` and `/account/pets`.
- Profile data already auto-seeds on signup via the existing `handle_new_user` trigger, so every customer has a row to edit.

