

## Add a free "Meet & greet" service

### What's wrong
The homepage has a **"Book a meet & greet"** button (in `MeetSitter.tsx`) that links to `/book`, but there's no matching service in the booking flow — only Walking, Sitting, and Boarding show up in the "Pick a service" step.

### What I'll do

**1. Add a new service to the database**
Insert a `meet-and-greet` service into the `services` table:
- **Name**: Meet & Greet
- **Slug**: `meet-and-greet`
- **Description**: "Free 20-minute intro visit so we can get acquainted with you and your dog before any booking."
- **Price**: $0 (free)
- **Duration**: 20 minutes
- **Unit label**: `/ visit`
- **Sort order**: 0 (shown first)
- **is_active**: true

**2. Tag existing availability slots with the new service**
Since availability is now multi-select per slot, insert `availability_services` rows linking every existing availability slot to the new `meet-and-greet` service — otherwise no time slots will appear when customers pick it.

**3. Update the homepage CTA**
In `src/components/MeetSitter.tsx`, change the link to `/book?service=meet-and-greet` so the service is preselected when the user lands on the booking page.

**4. Handle $0 price display**
In `src/pages/Book.tsx`, the price is rendered with `formatPriceWithDecimals(...)`. Confirm $0.00 renders cleanly (it will — no code change needed). The 25% deposit step also handles $0 fine ($0.00 deposit shown).

**5. Make sure the deposit flow doesn't block free bookings**
Since deposit is `Math.round(price_cents * 0.25)` = 0 for free services, the booking will insert with `deposit_cents = 0` and status `pending_payment` — but with no payment integration wired up yet, this is fine. The booking success page will still confirm.

### Files touched
- **DB migration** — insert `meet-and-greet` service + tag all existing availability slots with it
- **`src/components/MeetSitter.tsx`** — update the "Book a meet & greet" link to preselect the service

