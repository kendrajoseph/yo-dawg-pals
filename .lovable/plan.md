
## Goal
Add an in-app AI schedule assistant for the sitter/admin dashboard that can understand natural-language commands and safely perform schedule and approval actions such as:
- updating availability blocks
- creating/editing group-walk windows
- blocking dates
- approving request groups or selected recent requests
- preparing client notifications before sending

## What to build

### 1. Add an admin+sitter-only AI assistant panel in the dashboard
Build a chat-style assistant inside the existing sitter dashboard, ideally as a new tab or side panel in `/sitter`, because that page already owns:
- availability management
- walk window management
- request approvals
- client communications

The assistant should:
- accept plain-English commands
- show a structured interpretation of the command
- show the exact changes it plans to make
- support “apply” and “cancel”
- keep a short command history for the session

### 2. Add a backend function that turns chat commands into safe actions
Create a backend function that:
- validates the signed-in user
- confirms they are sitter/admin authorized
- sends the command plus current scheduling/request context to Lovable AI
- requires structured tool-style output, not freeform text
- returns a normalized action plan like:
  - `create_availability_blocks`
  - `update_walk_windows`
  - `add_blocked_dates`
  - `approve_requests`
  - `send_preview_notifications`

This function should not directly mutate data on first response. It should first return:
- parsed intent
- entities extracted
- confidence
- proposed operations
- warnings/conflicts

### 3. Add a second backend “execute assistant actions” function
Create a separate execution function that receives approved structured actions and performs the writes:
- `availability`
- `availability_services`
- `walk_windows`
- `blocked_dates`
- `bookings`
- possibly `booking_request_groups`

This function should:
- re-validate auth and role
- validate payload shape with strict schema checks
- run business-rule validation before writes
- return per-operation success/failure details

Splitting “plan” from “execute” is important because you chose:
- admin + sitter access
- full auto-apply in general
- but preview first for client alerts

### 4. Support schedule-building commands
Implement first-class command handling for phrases like:
- “I am available every morning this week from 8am to 10am for solo walks”
- “from 3pm to 5pm for group walks on Monday Wednesday and Friday every week indefinitely”
- “block off next Thursday”
- “change Friday group walk window to 2pm–4pm”

The parser should map these into existing models:
- exact availability blocks go to `availability` + `availability_services`
- pack/group-walk windows go to `walk_windows`
- closures go to `blocked_dates`

Rules should follow current dashboard logic:
- end must be after start
- 30-minute gap between booking blocks
- 30-minute gap between walk windows
- service tags required for availability blocks
- recurrence expansion should be bounded for storage safety

### 5. Support approval commands
Implement assistant commands for request handling, such as:
- “approve all recent requests”
- “approve all group walks from today”
- “approve all unpaid approved requests”
- “decline the last boarding request”

Because approvals need schedule data, the assistant must:
- identify target bookings/groups
- determine whether enough info exists to approve safely
- if missing fields exist, ask a follow-up in chat instead of guessing

Approval logic should reuse existing dashboard rules:
- pet approval required where applicable
- no buffered time conflicts
- approved price required/derived correctly
- free services confirm immediately
- paid services move to payment-open state only after approval

### 6. Add notification preview flow
For approval actions that notify clients:
- generate a preview list of affected clients/messages before send
- show what action will happen per booking
- allow one-click “send now”

For the first version:
- preview should summarize recipient, service, status change, and notification type
- execution should then call the existing notification pathways after confirmation

## Recommended rollout
Ship in phases:

### Phase 1: Safe MVP
- AI chat UI in dashboard
- parse commands into structured plans
- apply schedule edits only:
  - availability
  - walk windows
  - blocked dates
- preview-only for approval commands

### Phase 2: Approvals
- execute booking approvals from assistant
- preview affected clients before notifications
- support bulk approval filters like “recent requests”

### Phase 3: Better assistant UX
- follow-up clarification questions
- undo for last assistant action
- saved quick commands
- richer audit history

## Key design decisions

### Why this is feasible
Yes, this is very possible with the current app because the dashboard already contains the required primitives:
- scheduling tables already exist
- approval logic already exists
- notification flows already exist
- sitter/admin role checks already exist
- Lovable AI secret is already available

So this is mostly an orchestration layer plus a safe AI command interpreter, not a full rebuild.

### Safer than direct freeform automation
Even though you want auto-apply behavior, truly high-risk actions should still be split internally into:
1. interpret
2. validate
3. apply
4. preview notifications
5. send

That preserves speed while preventing accidental broad changes.

## Technical details

### Existing app pieces to reuse
- `src/pages/SitterDashboard.tsx`
  - already manages availability, walk windows, blocked dates, request approvals
- `supabase/functions/booking-workflow/index.ts`
  - already handles some booking approval + notification behavior
- `src/hooks/useAuth.tsx`
  - already exposes sitter/admin capabilities
- current tables:
  - `availability`
  - `availability_services`
  - `walk_windows`
  - `blocked_dates`
  - `bookings`
  - `booking_request_groups`

### New backend pieces
Create:
1. `assistant-schedule-plan`
   - interpret command into structured actions
2. `assistant-schedule-execute`
   - validate and apply structured actions

Potentially also:
3. `assistant-notification-preview`
   - prepare approval-related client alert previews

### AI approach
Use Lovable AI in a backend function, not from the client.
Have the model return strict structured output such as:
- action type
- date range / recurrence
- weekdays
- time ranges
- target services
- affected booking filters
- required follow-up questions
- warnings

### Validation rules
Add server-side validation for:
- supported services only
- date parsing and recurrence bounds
- no overlapping buffered slots/windows
- no blind approval without enough schedule data
- only sitter/admin users can execute
- preview required before client notification send

### Data model considerations
A first version can likely work without major schema changes by writing into existing scheduling tables and booking rows.
Optional later additions:
- assistant action log table
- saved command templates
- undo snapshots / audit records

### UX recommendation
Best fit:
- add a new “Assistant” tab in the sitter dashboard
- desktop: two-column layout with chat on one side and action preview on the other
- mobile: stacked cards with sticky apply/send controls

### Important constraint
The current notification and approval code is partly duplicated between dashboard UI logic and backend workflow. During implementation, unify or centralize that logic so assistant approvals and manual approvals behave the same way.

## Deliverables
1. Assistant tab/panel in sitter dashboard
2. AI planning backend function
3. Execution backend function
4. Preview-before-send notification flow
5. Schedule command support
6. Approval command support
7. Shared validation/utilities so manual and AI actions stay consistent
