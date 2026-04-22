CREATE TYPE public.service_scheduling_mode AS ENUM ('instant', 'request', 'boarding');
CREATE TYPE public.service_capacity_mode AS ENUM ('single', 'shared');
CREATE TYPE public.pet_approval_status AS ENUM ('pending', 'approved', 'declined');

CREATE TABLE public.service_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  unit_label TEXT,
  payment_mode TEXT NOT NULL DEFAULT 'deposit',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service variants are public"
ON public.service_variants
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins manage service variants"
ON public.service_variants
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS scheduling_mode public.service_scheduling_mode NOT NULL DEFAULT 'instant',
  ADD COLUMN IF NOT EXISTS capacity_mode public.service_capacity_mode NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS approval_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_pet_approval BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS turnaround_buffer_minutes INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS extra_time_fee_cents INTEGER,
  ADD COLUMN IF NOT EXISTS extra_time_increment_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS late_pickup_fee_cents INTEGER,
  ADD COLUMN IF NOT EXISTS boarding_checkin_minute INTEGER,
  ADD COLUMN IF NOT EXISTS boarding_checkout_minute INTEGER,
  ADD COLUMN IF NOT EXISTS max_capacity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.availability
  ADD COLUMN IF NOT EXISTS max_bookings INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.walk_windows
  ADD COLUMN IF NOT EXISTS max_bookings INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_variant_id UUID REFERENCES public.service_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS base_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS extra_time_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_time_fee_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_pickup_fee_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE public.sitter_pet_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id UUID NOT NULL,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  status public.pet_approval_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sitter_id, pet_id, service_id)
);

CREATE INDEX idx_service_variants_service_id ON public.service_variants(service_id, sort_order);
CREATE INDEX idx_bookings_service_variant_id ON public.bookings(service_variant_id);
CREATE INDEX idx_sitter_pet_approvals_sitter_service_status ON public.sitter_pet_approvals(sitter_id, service_id, status);
CREATE INDEX idx_sitter_pet_approvals_pet_id ON public.sitter_pet_approvals(pet_id);

ALTER TABLE public.sitter_pet_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view approvals for their pets"
ON public.sitter_pet_approvals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pets p
    WHERE p.id = sitter_pet_approvals.pet_id
      AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Sitters view and manage their approvals"
ON public.sitter_pet_approvals
FOR ALL
TO authenticated
USING (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'))
WITH CHECK (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'));

CREATE POLICY "Admins view all approvals"
ON public.sitter_pet_approvals
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_service_variants_updated_at
BEFORE UPDATE ON public.service_variants
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER update_sitter_pet_approvals_updated_at
BEFORE UPDATE ON public.sitter_pet_approvals
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();