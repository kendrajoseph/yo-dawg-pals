CREATE TABLE public.booking_request_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  sitter_id UUID NOT NULL,
  label TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT booking_request_groups_status_check CHECK (status IN ('requested', 'partially_approved', 'approved', 'cancelled'))
);

ALTER TABLE public.booking_request_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own booking request groups"
ON public.booking_request_groups
FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

CREATE POLICY "Customers create own booking request groups"
ON public.booking_request_groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers update own booking request groups"
ON public.booking_request_groups
FOR UPDATE
TO authenticated
USING (auth.uid() = customer_id)
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers delete own cancelled booking request groups"
ON public.booking_request_groups
FOR DELETE
TO authenticated
USING (auth.uid() = customer_id AND status = 'cancelled');

CREATE POLICY "Sitters view own booking request groups"
ON public.booking_request_groups
FOR SELECT
TO authenticated
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower(auth.jwt() ->> 'email') = 'anneke@yodawg.ca'
);

CREATE POLICY "Sitters update own booking request groups"
ON public.booking_request_groups
FOR UPDATE
TO authenticated
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower(auth.jwt() ->> 'email') = 'anneke@yodawg.ca'
)
WITH CHECK (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower(auth.jwt() ->> 'email') = 'anneke@yodawg.ca'
);

CREATE POLICY "Admins view all booking request groups"
ON public.booking_request_groups
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update all booking request groups"
ON public.booking_request_groups
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_booking_request_groups_updated_at
BEFORE UPDATE ON public.booking_request_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bookings
ADD COLUMN request_group_id UUID,
ADD COLUMN request_group_label TEXT,
ADD COLUMN requested_end_date DATE,
ADD COLUMN recurrence_label TEXT,
ADD COLUMN recurrence_pattern JSONB,
ADD COLUMN bundle_position INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_request_group_id_fkey
FOREIGN KEY (request_group_id) REFERENCES public.booking_request_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_request_group_id ON public.bookings(request_group_id);
CREATE INDEX idx_booking_request_groups_customer_id ON public.booking_request_groups(customer_id);
CREATE INDEX idx_booking_request_groups_sitter_id ON public.booking_request_groups(sitter_id);