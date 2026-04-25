-- Client reviews of completed services
CREATE TABLE public.client_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  sitter_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, customer_id)
);

CREATE INDEX idx_client_reviews_sitter ON public.client_reviews(sitter_id, created_at DESC);
CREATE INDEX idx_client_reviews_customer ON public.client_reviews(customer_id);

ALTER TABLE public.client_reviews ENABLE ROW LEVEL SECURITY;

-- Customers can create reviews for their own bookings
CREATE POLICY "Customers create own reviews"
ON public.client_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = customer_id
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
      AND b.customer_id = auth.uid()
      AND b.sitter_id = client_reviews.sitter_id
  )
);

-- Customers can view their own reviews
CREATE POLICY "Customers view own reviews"
ON public.client_reviews
FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

-- Customers can edit their own reviews
CREATE POLICY "Customers update own reviews"
ON public.client_reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = customer_id)
WITH CHECK (auth.uid() = customer_id);

-- Customers can delete their own reviews
CREATE POLICY "Customers delete own reviews"
ON public.client_reviews
FOR DELETE
TO authenticated
USING (auth.uid() = customer_id);

-- Anneke (the sitter) can view all reviews left for her
CREATE POLICY "Sitters view their reviews"
ON public.client_reviews
FOR SELECT
TO authenticated
USING (
  auth.uid() = sitter_id
  AND public.has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

-- Admins can view all reviews
CREATE POLICY "Admins view all reviews"
ON public.client_reviews
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_client_reviews_updated_at
BEFORE UPDATE ON public.client_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();