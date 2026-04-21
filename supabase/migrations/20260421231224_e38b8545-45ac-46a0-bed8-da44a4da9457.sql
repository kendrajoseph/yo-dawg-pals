-- Add stripe price linkage and payment mode to services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'deposit'
    CHECK (payment_mode IN ('full', 'deposit', 'free'));

-- Add payment tracking columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_amount_cents integer,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_id text;

-- Backfill: link services to Stripe price IDs and payment modes
UPDATE public.services SET stripe_price_id = 'yodawg_walking_deposit',     payment_mode = 'deposit' WHERE slug = 'walking';
UPDATE public.services SET stripe_price_id = 'yodawg_sitting_deposit',     payment_mode = 'deposit' WHERE slug = 'sitting';
UPDATE public.services SET stripe_price_id = 'yodawg_boarding_full',       payment_mode = 'full'    WHERE slug = 'boarding';
UPDATE public.services SET stripe_price_id = 'yodawg_meet_and_greet_free', payment_mode = 'free'    WHERE slug = 'meet-and-greet';