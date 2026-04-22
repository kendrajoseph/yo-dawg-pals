
## What to build

### 1. Split dog walking into two clear offerings
Replace the single “Dog Walking” service with two separate services:

- Solo Walk
  - Premium pricing
  - Customer requests a preferred time window
  - Anneke confirms the exact time
  - Paid upfront at request time

- Group Walk
  - Lower pricing
  - Customer chooses a preferred window such as Morning / Afternoon / Evening or a tighter soft window
  - Anneke decides the final exact time and which dogs are grouped together
  - Not paid until Anneke approves the request

This makes the offer easier to understand and matches how Anneke actually operates.

### 2. Change walk booking from “instant slot booking” to “request + confirmation”
Keep the current instant-booking model for:
- Meet & Greet
- Pet Sitting
- Boarding

But change the walk flow:

- Solo Walk:
  - customer selects date
  - customer selects preferred solo request window
  - customer submits and pays upfront
  - booking enters a new “requested / awaiting scheduling” state
  - Anneke later assigns exact time
  - once scheduled, customer sees the confirmed time in account

- Group Walk:
  - customer selects date
  - customer selects preferred group window
  - customer submits request without payment
  - Anneke reviews fit, assigns group, sets exact time
  - customer is then prompted to pay
  - booking becomes confirmed after payment

This removes the fake precision of showing exact group slots before Anneke has matched dogs.

### 3. Add a sitter-side scheduling workflow
Expand the sitter dashboard so Anneke can manage requests, not just static availability.

New dashboard capabilities:
- define group-walk operating windows by day
- define solo-walk operating windows by day
- review incoming walk requests
- assign an exact scheduled time
- mark a dog as matched to a group
- trigger payment request for approved group walks
- optionally add internal notes like “good with calm medium dogs” or “best as solo only”

The dashboard should become the operational control center, not just a calendar tagger.

### 4. Improve customer-facing communication
Update site copy so the process feels intentional, not confusing.

Suggested messaging pattern:
- Solo Walks: “Premium one-on-one walks. Choose your preferred window and Anneke will confirm the exact walk time.”
- Group Walks: “Choose your preferred walk window. Anneke builds compatible small groups and confirms the exact timing.”
- Add a short “How walk scheduling works” section near services and on the booking page.

This turns the constraint into a trust signal: dogs are grouped thoughtfully, not randomly.

### 5. Tighten pricing and product structure
Create a cleaner service architecture such as:

- Meet & Greet
- Solo Walk
- Group Walk
- Pet Sitting
- Boarding

Also clean up current pricing inconsistencies across marketing and backend data, especially boarding.

## Recommended UX structure

### Homepage / services cards
For walks, show separate cards or sub-cards:

```text
Walks
├─ Solo Walk — premium, one-on-one
└─ Group Walk — social, compatibility-based
```

Each should include:
- price
- duration
- who it’s for
- how scheduling works
- CTA

### Booking flow for walks
Instead of “Pick a date & exact time” for all services, use conditional steps:

```text
Walk booking
1. Choose service type
2. Choose date
3. Choose preferred window
4. Choose pet
5. Review request
6. Submit
```

Labels should change by walk type:
- Solo: “Preferred walk window”
- Group: “Preferred group-walk window”

### Customer account experience
Show clearer status labels such as:
- Request received
- Awaiting Anneke’s scheduling
- Awaiting payment
- Confirmed
- Completed
- Cancelled
- Refunded

This is much easier to understand than reusing only `pending_payment` for every stage.

## Backend/data changes

### Add a proper request-and-scheduling model
The current booking table is designed for fixed start/end times at checkout. For the new workflow, add scheduling fields or a dedicated request table.

Recommended direction:
- keep `bookings` as the main record
- add fields for:
  - `booking_kind` or `fulfillment_type` (`instant`, `requested`)
  - `requested_date`
  - `requested_window_label`
  - `requested_window_start_minute`
  - `requested_window_end_minute`
  - `scheduled_start_at`
  - `scheduled_end_at`
  - `approval_status`
  - `approved_at`
  - `approved_by`
  - optional `group_assignment_label`
  - optional `internal_notes`

Also extend booking status values to support the real lifecycle:
- `requested`
- `awaiting_payment`
- `confirmed`
- `cancelled`
- `completed`
- `refunded`

### Availability model update
Current availability is exact-slot based and service-tagged. That works for sitting/boarding, but not for group matching.

Add a second layer for walk windows:
- solo windows by weekday
- group windows by weekday
- optional capacity or internal grouping notes later

This avoids forcing walk requests into the same structure as hard bookable slots.

### Payments logic
Adjust payment behavior by service:
- Solo Walk: create payment immediately on request
- Group Walk: create payment only after Anneke approves and sets the exact time
- Other services: keep current behavior

That means checkout must support both:
- immediate post-request payment
- deferred payment after sitter approval

## Technical implementation steps

1. Update service catalog
   - add Solo Walk and Group Walk records
   - retire or hide old generic Dog Walking service
   - sync payment products/prices for both offerings

2. Update database schema
   - add new booking lifecycle/status fields
   - add requested-window and approved-schedule fields
   - add walk-window availability structure
   - preserve existing bookings

3. Refactor booking page
   - make flow conditional by service type
   - use request windows for walk services
   - keep exact slot calendar for sitting/boarding/meet & greet
   - change review copy and payment CTA per workflow

4. Refactor checkout/payment trigger
   - immediate checkout for solo walk
   - no checkout for group walk until approved
   - account page should show “Pay now” only when a group request is approved

5. Expand sitter dashboard
   - separate sections for:
     - exact-slot services
     - walk request queue
     - walk scheduling
   - add approve / assign time / request payment controls

6. Update notifications
   - confirmation email for request received
   - approval email with exact walk time
   - payment request email for approved group walk
   - paid booking notification to Anneke stays in place

7. Update marketing copy
   - separate Solo vs Group offerings
   - explain matching logic simply
   - add “How scheduling works”
   - fix price mismatches

## Recommended wording to communicate this clearly

### On the services page
- Solo Walk: “A premium one-on-one walk tailored to your dog’s pace, energy, and training needs.”
- Group Walk: “A small, thoughtfully matched walk with compatible dogs. You choose your preferred window; Anneke confirms the final timing and group.”

### On the booking page
- “Choose your preferred window — exact walk times are confirmed by Anneke.”
- “Group walks are matched based on temperament, pace, and compatibility.”
- “Solo walks are scheduled around group-walk blocks and confirmed individually.”

### On the dashboard/account side
- “Requested”
- “Scheduled by Anneke”
- “Ready for payment”
- “Confirmed”

## Important technical notes

- The current `services` table already supports separate products cleanly, so Solo Walk and Group Walk should become separate service records.
- The current `bookings` structure assumes a fixed `start_at`/`end_at` too early in the flow, so it needs a request/approval layer.
- The current availability system is slot-based and should remain for fixed-time services, but walk scheduling needs its own “preferred window” model.
- The current checkout edge function can stay, but it must support bookings that only become payable after sitter approval.
- Existing payment/email logic should be extended, not replaced.
- There is already a pricing mismatch in the project data/content for boarding that should be corrected during this pass.

## Result
After this redesign, the system will feel much tighter:

- customers understand the difference between solo and group walks
- Anneke keeps control over group compatibility and final timing
- premium solo pricing is justified by the experience
- the booking flow matches real operations instead of pretending every walk is an instant exact-slot booking
- the site communicates care, judgment, and structure rather than generic scheduling
