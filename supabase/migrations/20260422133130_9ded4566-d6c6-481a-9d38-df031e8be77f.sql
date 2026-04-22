ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mobile_phone text,
ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false;

CREATE TYPE public.booking_update_kind AS ENUM ('pickup', 'dropoff', 'note');

CREATE TABLE public.booking_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  kind public.booking_update_kind NOT NULL,
  message text,
  sent_via_sms boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_updates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_booking_updates_booking_id_created_at
  ON public.booking_updates (booking_id, created_at DESC);

CREATE POLICY "Customers view updates for own bookings"
ON public.booking_updates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.customer_id = auth.uid()
  )
);

CREATE POLICY "Sitters view updates for own bookings"
ON public.booking_updates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.sitter_id = auth.uid()
      AND public.has_role(auth.uid(), 'sitter')
  )
);

CREATE POLICY "Sitters add updates for own bookings"
ON public.booking_updates
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.sitter_id = auth.uid()
      AND public.has_role(auth.uid(), 'sitter')
  )
);

CREATE POLICY "Sitters edit updates for own bookings"
ON public.booking_updates
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.sitter_id = auth.uid()
      AND public.has_role(auth.uid(), 'sitter')
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.sitter_id = auth.uid()
      AND public.has_role(auth.uid(), 'sitter')
  )
);

CREATE POLICY "Sitters remove updates for own bookings"
ON public.booking_updates
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.sitter_id = auth.uid()
      AND public.has_role(auth.uid(), 'sitter')
  )
);

CREATE TRIGGER set_booking_updates_updated_at
BEFORE UPDATE ON public.booking_updates
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();