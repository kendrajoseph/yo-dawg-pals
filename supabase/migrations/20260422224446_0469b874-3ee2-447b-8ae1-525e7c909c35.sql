CREATE POLICY "Customers delete own cancelled bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (
  auth.uid() = customer_id
  AND status = 'cancelled'::public.booking_status
);