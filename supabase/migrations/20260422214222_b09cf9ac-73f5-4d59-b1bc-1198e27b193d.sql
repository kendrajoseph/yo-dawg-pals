CREATE POLICY "Sitters delete own cancelled bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND status = 'cancelled'::booking_status
);

CREATE POLICY "Sitters delete their own direct messages"
ON public.client_messages
FOR DELETE
TO authenticated
USING (
  auth.uid() = sitter_id
  AND auth.uid() = created_by
  AND has_role(auth.uid(), 'sitter'::app_role)
);

CREATE POLICY "Sitters delete their own service alerts"
ON public.service_alerts
FOR DELETE
TO authenticated
USING (
  auth.uid() = sitter_id
  AND auth.uid() = created_by
  AND has_role(auth.uid(), 'sitter'::app_role)
);