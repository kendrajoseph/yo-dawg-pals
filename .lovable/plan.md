## Why the current backend feels messy

Right now `SitterDashboard.tsx` is a **4,269-line single file** with **8 sibling tabs** all on one level: Overview, Day view, Playbook, Clients, Schedule, Care, Payments, Alerts. Every tab is a kitchen-sink page and there is no clear primary surface — the operator has to hunt across tabs to do one job (e.g., approve a request → confirm schedule → notify client → invoice).

Independently-owned service businesses on tools like **Jobber, Housecall Pro, Square Appointments, Honeybook, and Squire** consistently use a different shape:

1. A **Today / Run-the-day** screen as the home surface (what's happening now)
2. A **dedicated work object** for each thing that moves through a pipeline (Request → Booking → Visit → Invoice)
3. **Side navigation, not tabs**, with badges for things that need attention
4. **Detail drawers/pages** for each record, instead of inline editing inside a tab
5. **Settings tucked away**, not mixed with daily work

We'll adopt that shape.

---

## Proposed new structure

### 1. Persistent left rail (replaces the 8-tab strip)

```text
┌─────────────────┐
│  Yodawg         │
│                 │
│ ▶ Today         │ ← default landing
│   Inbox    (3)  │ ← requests + approvals + alerts in one queue
│   Calendar      │
│   Clients       │
│   Pets          │
│   Invoices (2)  │
│   Messages      │
│ ─────────────── │
│   Reports       │
│   Settings   ▾  │
│      Services   │
│      Availability│
│      Reminders  │
│      Branding   │
└─────────────────┘
```

Badges show counts of items needing action. Settings collapses everything that today lives in "Schedule" + "Playbook" + parts of "Alerts" but is really configuration, not daily work.

### 2. Today (new home)

A single scannable screen that answers "what do I need to do right now?":

- **At-a-glance row**: 4 KPI tiles — Today's visits · Outstanding $ · Overdue $ · Unread messages
- **Run-of-show timeline**: chronological list of today's visits with status pills (Upcoming / In progress / Done), one-tap "Mark complete + send update"
- **Needs your attention** card: collapsed list of the top ~5 items from Inbox (a new request, a pet awaiting approval, an overdue invoice) with inline accept/decline
- **Quick actions** (sticky): New booking · New invoice · Block a date · Message a client

This replaces today's "Overview" + "Day view" + parts of "Playbook".

### 3. Inbox (unified queue)

Today, the operator must check Overview for requests, Care/Alerts for messages, and Clients for pet approvals. Consolidate these into one **Inbox** with filter chips:

- All · Booking requests · Pet approvals · Client messages · Payment issues

Each row opens a side drawer with full context and the relevant actions (approve, reply, charge, etc.). Mirrors how Front, Honeybook, and Jobber inboxes work.

### 4. Calendar (replaces "Schedule" tab)

The current Schedule tab mixes three things: viewing bookings, editing weekly availability, and managing walk windows. Split them:

- **Calendar page** = day/week/month view of confirmed bookings only. Click a booking → drawer with reschedule, cancel, message, invoice actions.
- **Availability + walk windows + blocked dates** move to `Settings → Availability`. They are configuration, not daily work.

### 5. Clients (richer record, not a list dump)

- List view stays, with search + star rating filter.
- Clicking a client opens a **client profile page** (not an inline panel) with tabs *inside* the client record: Overview · Pets · Bookings · Invoices · Messages · Notes. This is the Honeybook/Jobber pattern and dramatically reduces noise on the top-level Clients screen.

### 6. Pets (promoted to top-level)

Pets are first-class for a pet-care business. Today they're buried under Clients. Surface as their own nav item with: pending approvals callout at the top, full pet directory with temperament tags, fit-alert log.

### 7. Invoices (renamed from "Payments")

Operators think in *invoices*, not *payments*. Keeps the recently-built drawer + KPI tiles, but:

- Add a **default sub-tab nav inside the page**: Outstanding · Overdue · Drafts · Paid · Refunded · All (replaces filter chips with persistent tabs — easier to scan)
- Promote a **"+ New invoice"** primary button top-right
- Add a **Reminders** quick view for what auto-cron will send next
- Move `reminder_settings` editor to `Settings → Reminders`

### 8. Messages (was "Care")

Conversation list ↔ thread view (like SMS apps). Each thread is per client; bookings show as inline cards inside the thread. The current "send broadcast / templates" tools move into a "Compose" button.

### 9. Reports (new)

A small but high-value page: Revenue this month, Top services, Bookings by service, Cancellation rate, Outstanding A/R aging. Independently-owned businesses use this for monthly reflection — currently impossible.

### 10. Settings (consolidated)

Everything operational-config goes here, with sub-pages:
- Services & pricing (variants editor)
- Availability (weekly slots, walk windows, blocked dates)
- Reminders (cadence + tone)
- Templates (email + SMS)
- Branding (logo, colors on invoices)
- Team & roles
- Billing & Stripe connection

---

## Visual & interaction principles

- **One primary action per screen**, top-right (e.g., "+ New booking" on Calendar, "+ New invoice" on Invoices)
- **Drawers for editing, pages for reading.** Stop putting forms inline in lists.
- **Status pills are colored, sparingly**: green=done/paid, amber=action needed, red=overdue, neutral=informational. No more than 3 colors at once on screen.
- **Consistent record header**: every detail page shares a header with avatar/name + status + quick actions, so the operator builds muscle memory.
- **Empty states with a next action**, not just "no data".
- **Mobile**: left rail collapses to a bottom tab bar showing Today · Inbox · Calendar · Clients · More.

---

## Technical refactor plan

The 4,269-line `SitterDashboard.tsx` becomes a router with route-level pages. No new tables required — this is purely a UX/structure overhaul over the existing data model.

### New route structure (under `/sitter`)
```text
/sitter                  → Today
/sitter/inbox            → Inbox (default: all)
/sitter/calendar         → Calendar (day/week/month)
/sitter/clients          → Clients list
/sitter/clients/:id      → Client profile (with internal tabs)
/sitter/pets             → Pets directory
/sitter/pets/:id         → Pet profile
/sitter/invoices         → Invoices list (default: outstanding)
/sitter/invoices/:id     → opens PaymentDrawer over list
/sitter/messages         → Messages
/sitter/messages/:id     → Thread
/sitter/reports          → Reports
/sitter/settings/*       → Settings sub-pages
```

### File layout
```text
src/pages/sitter/
  layout.tsx              ← left rail + topbar + outlet
  Today.tsx
  Inbox.tsx
  Calendar.tsx
  Clients.tsx
  ClientProfile.tsx
  Pets.tsx
  PetProfile.tsx
  Invoices.tsx            ← reuses existing PaymentDrawer
  Messages.tsx
  Reports.tsx
  settings/
    Services.tsx
    Availability.tsx      ← all schedule-config moved here
    Reminders.tsx
    Templates.tsx
    Branding.tsx
src/components/sitter/
  SitterShell.tsx         ← left rail nav + badges
  RecordHeader.tsx        ← shared detail-page header
  StatusPill.tsx
  EmptyState.tsx
  KpiTile.tsx
```

### Migration approach (no big-bang)
1. Build `SitterShell` + new routes in parallel; keep the old `/sitter-dashboard` URL as a redirect to `/sitter`
2. Move logic out of `SitterDashboard.tsx` one tab at a time into its corresponding new page, deleting code from the monolith as we go
3. Reuse existing components verbatim where possible: `PaymentDrawer`, `MarkPaidDialog`, `RefundDialog`, `SendReminderDialog`, `InvoiceLineItemsEditor`, `PetProfilesManager`
4. Replace flat-tab badge counts with a single `useSitterCounts()` hook that powers nav badges everywhere
5. Delete `SitterDashboard.tsx` once all 8 tabs have a new home

### Estimated scope
- ~12 new page files, ~5 new shared components, 1 hook
- Net code reduction: the monolith shrinks from ~4,300 lines to ~0; new pages average ~200–400 lines each (much easier to read and modify)
- No DB migrations, no edge-function changes, no breaking changes to existing public routes (`/pay/:token` etc.)

---

## What you get

- A landing screen that **tells you what to do**, not one that asks you to choose a tab
- **One queue** for everything that needs attention, instead of three places to check
- **Records that feel like records** (client page, pet page, invoice page) with consistent headers and actions
- **Settings out of the way** so daily work isn't visually competing with config screens
- A foundation that scales: adding "Quotes", "Subscriptions", "Recurring jobs", or a second sitter later is now a new nav item, not another tab squeezed onto the strip

If you approve, I'll execute the migration in the order above — `SitterShell` + Today + Inbox first (biggest UX win), then Calendar, then progressively move the rest.