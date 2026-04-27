-- Allow the sitter to update profile rows for users who are her clients.
-- Scope is intentionally broad on which columns can change (Postgres RLS
-- policies operate at the row level, not the column level), but the only
-- UI surface that calls this is the AddressEditor on the sitter's client
-- profile page, so in practice it only writes address columns.

CREATE POLICY "Sitters update client profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email'::text)) = 'anneke@yodawg.ca'
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.customer_id = profiles.id
      AND b.sitter_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email'::text)) = 'anneke@yodawg.ca'
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.customer_id = profiles.id
      AND b.sitter_id = auth.uid()
  )
);
