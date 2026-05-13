## Plan: Twilio inbound SMS handler

### 1. Database migration
Create `inbound_sms_messages` table:
- `id` uuid PK
- `twilio_message_sid` text
- `from_phone` text not null
- `to_phone` text
- `body` text not null
- `matched_profile_id` uuid (nullable)
- `is_stop` boolean default false
- `is_help` boolean default false
- `created_at` timestamptz default now()

RLS: enable, allow admins to SELECT, service_role for INSERT.

Add column to `profiles`:
- `sms_unsubscribed_at` timestamptz nullable

### 2. Edge function `handle-twilio-inbound`
- Public webhook (no JWT)
- Parses `application/x-www-form-urlencoded` Twilio payload (`From`, `To`, `Body`, `MessageSid`)
- Returns TwiML XML responses (`<Response>...</Response>`)
- Phone normalization helper (digits-only comparison)
- Implements user-supplied STOP/HELP/START logic verbatim
- Helpers `emptyResponse()` returns `<Response/>`, `replyResponse(msg)` returns `<Response><Message>msg</Message></Response>`

### 3. config.toml
Add:
```
[functions.handle-twilio-inbound]
verify_jwt = false
```

### 4. Post-deploy
Tell user to set the Twilio phone number's "A message comes in" webhook to:
`https://bffvaeolyqyiawpeyeex.supabase.co/functions/v1/handle-twilio-inbound` (POST)
