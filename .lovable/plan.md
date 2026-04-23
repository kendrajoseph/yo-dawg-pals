
Goal: make admin-entered values visually distinct from the existing/suggested request details so “internal notes” and approved values no longer blend in.

1. Update the request approval card styling in `src/pages/SitterDashboard.tsx`
- Keep the existing request summary (“Requested”, client note, projected total) as read-only muted text.
- Restyle editable approval fields so they look clearly interactive and separate from the request summary.
- Give the “Internal note” field a softer muted/placeholder presentation when empty and a stronger approved/admin style once populated.

2. Create a clear “requested vs actual” visual hierarchy
- Add lightweight labels or helper text around the editable approval controls so it’s obvious which values are:
  - requested/suggested by the client
  - actual/final values set by Anneke
- Apply this especially to:
  - Internal note
  - Approved price
  - timing fields in the request approval editor
- Use existing theme tokens (`primary`, `muted`, `accent`, `border`) rather than hardcoded black text.

3. Improve the internal notes field specifically
- Override the default input styling on the approval “Internal note” input so it doesn’t render as plain dark text with no distinction.
- Use a dedicated input treatment such as:
  - tinted background
  - stronger border/ring
  - admin-only label styling
  - muted helper copy
- Preserve current behavior and save logic; this is a visual clarity change, not a data-model change.

4. Keep admin-only client notes consistent
- Review the separate “Admin-only client notes” textarea in the same dashboard and align its text color / field treatment with the updated approval-note styling.
- Ensure both internal note surfaces feel intentionally private/admin-facing.

5. Validation pass
- Confirm the request cards still read clearly in the existing theme.
- Ensure requested information remains readable but secondary, while final/admin-entered values stand out as the actionable state.
- Do not change booking logic, approvals, notifications, or database structure.

Technical details
- Primary file: `src/pages/SitterDashboard.tsx`
- Reference UI primitives:
  - `src/components/ui/input.tsx`
  - `src/components/ui/textarea.tsx`
  - `src/components/ui/label.tsx`
- Likely implementation approach:
  - add contextual wrappers, helper text, and Tailwind utility classes on the approval fields
  - avoid changing shared input primitives globally unless the issue affects the whole app
  - use semantic theme classes instead of hardcoded text colors
