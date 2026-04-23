CREATE TABLE public.booking_notification_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  error_message TEXT,
  attempted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT booking_notification_attempts_type_check CHECK (notification_type IN ('confirmation_email', 'payment_alert')),
  CONSTRAINT booking_notification_attempts_trigger_check CHECK (trigger_source IN ('approval', 'retry')),
  CONSTRAINT booking_notification_attempts_status_check CHECK (status IN ('sent', 'skipped', 'failed')),
  CONSTRAINT booking_notification_attempts_attempt_number_check CHECK (attempt_number >= 1)
);

ALTER TABLE public.booking_notification_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_booking_notification_attempts_booking_created
  ON public.booking_notification_attempts (booking_id, created_at DESC);

CREATE INDEX idx_booking_notification_attempts_booking_type_attempt
  ON public.booking_notification_attempts (booking_id, notification_type, attempt_number DESC);

CREATE POLICY "Sitters view notification attempts for own bookings"
ON public.booking_notification_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_notification_attempts.booking_id
      AND b.sitter_id = auth.uid()
      AND has_role(auth.uid(), 'sitter'::app_role)
  )
);

CREATE POLICY "Admins view all notification attempts"
ON public.booking_notification_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role inserts notification attempts"
ON public.booking_notification_attempts
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');