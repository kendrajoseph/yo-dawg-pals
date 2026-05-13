## Add PostHog Analytics

Integrate PostHog for product analytics across the app.

### What you'll need
- A PostHog **Project API Key** (starts with `phc_`) — get it from PostHog → Project Settings → Project API Key
- Your PostHog **host** (usually `https://us.i.posthog.com` for US cloud or `https://eu.i.posthog.com` for EU)

These are publishable/client-side keys — safe to put in the codebase, no secrets vault needed.

### Steps
1. Install `posthog-js`.
2. Create `src/lib/posthog.ts` that initializes PostHog once on app start with the project key + host. Configure `capture_pageview: false` so we control pageviews via the router.
3. Initialize PostHog in `src/main.tsx` (before the app renders).
4. Add a small `PostHogPageview` component inside the router (in `App.tsx`) that listens to route changes via `useLocation` and calls `posthog.capture('$pageview')` — this works correctly with `createBrowserRouter`.
5. Identify users when they're logged in: in the auth/session hook, call `posthog.identify(user.id, { email })` on login and `posthog.reset()` on logout.

### What I need from you
Reply with:
- Your PostHog **Project API Key** (`phc_...`)
- Your **region** (US or EU) — or paste the host URL

Once you send those, I'll switch to build mode and wire it up.
