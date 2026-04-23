
Goal: remove the helper sentence from the service request section in the booking flow.

1. Update the Bundle builder intro copy
- Edit `src/pages/Book.tsx`.
- Remove the paragraph under the “Bundle builder” heading that currently says:
  “Use one card per service pattern — for example Monday walks, Wednesday walks, Friday visits, and next month’s boarding stay.”

2. Preserve the rest of the section layout
- Keep the “Bundle builder” heading and the “Add another service” button unchanged.
- Do not replace the removed sentence unless a new helper line is explicitly wanted.

3. Verify the booking UI still reads cleanly
- Confirm the section spacing still looks balanced after removing the paragraph.
- Ensure no other repeated copy with the same wording appears elsewhere in the booking flow.

Technical details
- File to update: `src/pages/Book.tsx`
- Expected change: remove the `<p>` block directly below the Bundle builder heading inside the card header section.
