ALTER POLICY "Sitters manage own availability"
ON public.availability
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
)
WITH CHECK (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters manage own blocked dates"
ON public.blocked_dates
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
)
WITH CHECK (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters manage own walk windows"
ON public.walk_windows
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
)
WITH CHECK (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters manage tags on own slots"
ON public.availability_services
USING (
  EXISTS (
    SELECT 1
    FROM public.availability a
    WHERE a.id = availability_services.availability_id
      AND a.sitter_id = auth.uid()
      AND has_role(auth.uid(), 'sitter'::app_role)
      AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.availability a
    WHERE a.id = availability_services.availability_id
      AND a.sitter_id = auth.uid()
      AND has_role(auth.uid(), 'sitter'::app_role)
      AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  )
);

ALTER POLICY "Sitters update own bookings"
ON public.bookings
USING (
  auth.uid() = sitter_id
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
)
WITH CHECK (
  auth.uid() = sitter_id
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters view own bookings"
ON public.bookings
USING (
  auth.uid() = sitter_id
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters delete own cancelled bookings"
ON public.bookings
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND status = 'cancelled'::booking_status
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters add updates for own bookings"
ON public.booking_updates
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.sitter_id = auth.uid()
      AND has_role(auth.uid(), 'sitter'::app_role)
      AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  )
);

ALTER POLICY "Sitters edit updates for own bookings"
ON public.booking_updates
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.sitter_id = auth.uid()
      AND has_role(auth.uid(), 'sitter'::app_role)
      AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.sitter_id = auth.uid()
      AND has_role(auth.uid(), 'sitter'::app_role)
      AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  )
);

ALTER POLICY "Sitters remove updates for own bookings"
ON public.booking_updates
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.sitter_id = auth.uid()
      AND has_role(auth.uid(), 'sitter'::app_role)
      AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  )
);

ALTER POLICY "Sitters view updates for own bookings"
ON public.booking_updates
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_updates.booking_id
      AND b.sitter_id = auth.uid()
      AND has_role(auth.uid(), 'sitter'::app_role)
      AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  )
);

ALTER POLICY "Sitters create direct messages for their clients"
ON public.client_messages
WITH CHECK (
  auth.uid() = sitter_id
  AND auth.uid() = created_by
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.customer_id = client_messages.customer_id
      AND b.sitter_id = auth.uid()
  )
);

ALTER POLICY "Sitters update their own direct messages"
ON public.client_messages
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
)
WITH CHECK (
  auth.uid() = sitter_id
  AND auth.uid() = created_by
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters view their own direct messages"
ON public.client_messages
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters delete their own direct messages"
ON public.client_messages
USING (
  auth.uid() = sitter_id
  AND auth.uid() = created_by
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters view read receipts for their messages"
ON public.client_message_reads
USING (
  EXISTS (
    SELECT 1
    FROM public.client_messages m
    WHERE m.id = client_message_reads.client_message_id
      AND m.sitter_id = auth.uid()
      AND has_role(auth.uid(), 'sitter'::app_role)
      AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  )
);

ALTER POLICY "Sitters manage their own service alerts"
ON public.service_alerts
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
)
WITH CHECK (
  auth.uid() = sitter_id
  AND auth.uid() = created_by
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters delete their own service alerts"
ON public.service_alerts
USING (
  auth.uid() = sitter_id
  AND auth.uid() = created_by
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);

ALTER POLICY "Sitters view receipts for their alerts"
ON public.service_alert_reads
USING (
  EXISTS (
    SELECT 1
    FROM public.service_alerts a
    WHERE a.id = service_alert_reads.service_alert_id
      AND a.sitter_id = auth.uid()
      AND has_role(auth.uid(), 'sitter'::app_role)
      AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  )
);

ALTER POLICY "Sitters view and manage their approvals"
ON public.sitter_pet_approvals
USING (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
)
WITH CHECK (
  auth.uid() = sitter_id
  AND has_role(auth.uid(), 'sitter'::app_role)
  AND lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
);