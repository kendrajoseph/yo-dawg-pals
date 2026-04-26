ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Canada',
  ADD COLUMN IF NOT EXISTS address_lat double precision,
  ADD COLUMN IF NOT EXISTS address_lng double precision,
  ADD COLUMN IF NOT EXISTS address_geocoded_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_address_coords_idx
  ON public.profiles (address_lat, address_lng)
  WHERE address_lat IS NOT NULL AND address_lng IS NOT NULL;