-- 1. Pet temperament free-text
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS temperament_notes text;

-- 2. Stripe customer + saved card on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS default_payment_method_id text;

-- 3. Payment status on bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='payment_status'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN payment_status text NOT NULL DEFAULT 'outstanding';
  END IF;
END$$;

UPDATE public.bookings
SET payment_status = 'paid'
WHERE paid_at IS NOT NULL AND payment_status <> 'paid';

-- 4. Sibling discount on service_variants
ALTER TABLE public.service_variants
  ADD COLUMN IF NOT EXISTS sibling_discount_percent integer NOT NULL DEFAULT 0;

-- 5. Pricing updates
-- Boarding base: $80 first night
UPDATE public.services
SET price_cents = 8000
WHERE slug = 'boarding';

-- Pet sitting: 30 minutes
UPDATE public.services
SET duration_minutes = 30
WHERE slug = 'pet-sitting';

-- Solo Walk 30m -> $30
UPDATE public.service_variants
SET price_cents = 3000
WHERE slug = 'solo-walk-30';

-- Add additional-night boarding variant ($60) if missing
INSERT INTO public.service_variants (service_id, slug, name, duration_minutes, price_cents, unit_label, payment_mode, sort_order, is_active)
SELECT s.id, 'boarding-extra-night', 'Additional Night', 1440, 6000, 'night', 'deposit', 10, true
FROM public.services s
WHERE s.slug = 'boarding'
  AND NOT EXISTS (
    SELECT 1 FROM public.service_variants v WHERE v.slug = 'boarding-extra-night'
  );

-- 50% sibling discount on Group Walk + Boarding variants
UPDATE public.service_variants v
SET sibling_discount_percent = 50
FROM public.services s
WHERE v.service_id = s.id
  AND s.slug IN ('boarding', 'group-walk');