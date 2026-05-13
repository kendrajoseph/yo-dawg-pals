
# Site audit — UX & code health

Scope: customer site + sitter dashboard. ~150 source files, 13.7k lines in pages alone.

---

## Findings

### A. Code health & architecture

1. **`SitterDashboard.tsx` is 4,303 lines** and lives at `/sitter-classic`, parallel to the new `/sitter/*` page tree. It's the single biggest tech-debt item in the repo — likely 70%+ dead/duplicated code now that the new shell exists. Risk: any backend change has to be made in two places.
2. **Two big payment drawers** — `PaymentDrawer.tsx` (479) and `InvoiceDrawer.tsx` (437) overlap heavily in concerns (status, line items, refund/reminder dialogs). Good candidates for a shared `<PaymentPanel>` skeleton + slot content.
3. **116 `as any` casts**, mostly `supabase as any`. Types exist (`src/integrations/supabase/types.ts`) — these casts silently disable the only safety net we have on DB calls.
4. **Repeated page-header pattern** — every sitter page hand-rolls the same block:
   ```
   <Link to="/sitter"><ArrowLeft /> Back to dashboard</Link>
   <h1>Title</h1>
   ```
   Wording drifts ("Back to dashboard", "Back to today", "Back to inbox", "Back to clients"). And `SitterShell` already renders a breadcrumb in its header — so the per-page back link is largely redundant.
5. **`useEffect` data-loading everywhere** with manual loading state — no React Query usage in sitter pages despite it being in `App.tsx`. Refetch-on-mutation is hand-managed via `load()` calls.
6. **6 stray `console.log`/`console.error`** in production code paths.

### B. UX & design consistency

7. **Mobile menu icon is broken** — `SiteNav.tsx` line 99 renders `<Menu />` for both open and closed states (should toggle to `X`).
8. **Two navigation models** for the same user: customer SiteNav (top, sticky) vs sitter SitterShell (sidebar). When a sitter views customer-facing pages they get the public nav with no easy hop back to operator mode. Consider a persistent "Switch to operator" affordance for `canManageDashboard` users.
9. **Hard-coded colors** in `pages/sitter/Map.tsx` (`text-white`, `bg-white/60`) — bypasses the design system's semantic tokens. Other instances are inside shadcn primitives (acceptable) but Map is app code.
10. **OG/Twitter meta** in `index.html` still points to the Lovable preview image, and `twitter:site` is `@Lovable`. Replace with branded image + own handle (or remove).
11. **No favicon-sized OG image** and no JSON-LD `LocalBusiness`/`Service` schema — easy SEO wins for a local services brand.
12. **Settings sidebar duplicates the new top-level Services link** (we just added Services to the main sitter nav, but `/sitter/settings` Overview still shows the same "Services & pricing" tile). Decide: settings-only, or top-level shortcut + remove from settings overview.
13. **Empty states** — only some pages use `EmptyState` (Today does); Invoices/Reviews/Reports use ad-hoc "No results" text. Inconsistent voice.

---

## Recommendations (prioritized)

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | Delete `SitterDashboard.tsx` + `/sitter-classic` route after confirming no unique features | M | Huge — removes ~4k LOC and split-brain risk |
| 2 | Extract `<SitterPageHeader title back={...} actions={...} />` and replace 14 hand-rolled headers | S | Consistency + ~200 LOC saved |
| 3 | Fix mobile menu X-icon bug in `SiteNav.tsx` | XS | Visible polish |
| 4 | Update `index.html` OG image, twitter handle; add `LocalBusiness` JSON-LD on Index | S | SEO + share previews |
| 5 | Replace `text-white`/`bg-white` in `Map.tsx` with semantic tokens | XS | Theme correctness |
| 6 | Remove `supabase as any` casts in 5–10 highest-traffic files (Today, Invoices, Inbox, Clients, BookingDetail) | M | Type safety |
| 7 | Add a "Switch to operator / customer view" link in the relevant nav for dual-role users | S | UX clarity |
| 8 | Consolidate settings overview tiles vs sidebar nav (one source of truth) | XS | Information architecture |
| 9 | Standardize empty states using existing `EmptyState` across Invoices/Reviews/Reports/Messages | S | Consistency |
| 10 | Remove stray `console.*` calls | XS | Hygiene |

Bigger refactors held for later (call out, not in first pass): migrate sitter data loading to React Query; split PaymentDrawer/InvoiceDrawer into shared skeleton.

---

## Proposed first implementation pass

If approved, I'll ship the quick wins in one go:

1. **Quick polish (XS items):** mobile menu X-icon, Map.tsx color tokens, remove console logs, fix OG meta + twitter handle, dedupe settings tiles.
2. **`<SitterPageHeader>` component** + roll out across all 14 sitter pages with consistent "Back to …" wording derived from `document.referrer` fallback to `/sitter`.
3. **Add `LocalBusiness` JSON-LD** to `Index.tsx` head via a small `<SeoJsonLd>` component.

Held for follow-up plans (one each, on approval): delete `SitterDashboard.tsx`, type-safety pass on supabase calls, switch-role nav affordance.
