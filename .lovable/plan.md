
Goal: Remove the footer tagline text “Made with treats in Hamilton, Ontario” while keeping the copyright line intact.

Implementation:
1. Update `src/components/SiteFooter.tsx`.
2. In the bottom footer bar, change the line:
   `© {new Date().getFullYear()} Yo Dawg · Made with treats in Hamilton, Ontario`
   to:
   `© {new Date().getFullYear()} Yo Dawg`
3. Keep the existing styling, spacing, and footer structure unchanged.

Technical detail:
- This is a copy-only change in one component.
- No routing, data, backend, or layout logic needs to change.
