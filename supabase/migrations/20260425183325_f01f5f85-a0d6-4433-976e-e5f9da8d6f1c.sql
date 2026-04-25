DROP POLICY IF EXISTS "Sitters and admins read all profiles" ON public.profiles;

CREATE POLICY "Admins read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sitters read profiles of their clients"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sitter')
    AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.customer_id = profiles.id AND b.sitter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sitters view notification attempts for own bookings" ON public.booking_notification_attempts;

CREATE POLICY "Sitters view notification attempts for own bookings"
  ON public.booking_notification_attempts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sitter')
    AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_notification_attempts.booking_id AND b.sitter_id = auth.uid()
    )
  );