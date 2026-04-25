-- Webhook event idempotency tracking
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages processed events"
ON public.processed_stripe_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add refund_amount_cents to bookings to support partial refunds
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS refund_amount_cents integer NOT NULL DEFAULT 0;