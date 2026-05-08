CREATE POLICY "Sitters create bookings for own clients"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);