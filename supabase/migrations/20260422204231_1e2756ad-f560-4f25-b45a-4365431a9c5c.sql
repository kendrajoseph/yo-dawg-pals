CREATE TYPE public.client_message_kind AS ENUM ('service_update', 'customer_service', 'offer');
CREATE TYPE public.service_alert_kind AS ENUM ('hours_update', 'closure', 'announcement', 'promo');

CREATE TABLE public.client_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  booking_id UUID NULL REFERENCES public.bookings(id) ON DELETE SET NULL,
  kind public.client_message_kind NOT NULL DEFAULT 'customer_service',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  send_email BOOLEAN NOT NULL DEFAULT false,
  send_sms BOOLEAN NOT NULL DEFAULT false,
  delivered_email_at TIMESTAMPTZ NULL,
  delivered_sms_at TIMESTAMPTZ NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_messages_customer_created_at
  ON public.client_messages (customer_id, created_at DESC);
CREATE INDEX idx_client_messages_sitter_created_at
  ON public.client_messages (sitter_id, created_at DESC);
CREATE INDEX idx_client_messages_booking_id
  ON public.client_messages (booking_id)
  WHERE booking_id IS NOT NULL;

ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients view their own direct messages"
ON public.client_messages
FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

CREATE POLICY "Sitters view their own direct messages"
ON public.client_messages
FOR SELECT
TO authenticated
USING (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'));

CREATE POLICY "Admins view all direct messages"
ON public.client_messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sitters create direct messages for their clients"
ON public.client_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sitter_id
  AND auth.uid() = created_by
  AND public.has_role(auth.uid(), 'sitter')
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.customer_id = client_messages.customer_id
      AND b.sitter_id = auth.uid()
  )
);

CREATE POLICY "Sitters update their own direct messages"
ON public.client_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'))
WITH CHECK (auth.uid() = sitter_id AND auth.uid() = created_by AND public.has_role(auth.uid(), 'sitter'));

CREATE TABLE public.client_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_message_id UUID NOT NULL REFERENCES public.client_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_message_id, user_id)
);

CREATE INDEX idx_client_message_reads_user_id
  ON public.client_message_reads (user_id, read_at DESC);

ALTER TABLE public.client_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients view their own message read receipts"
ON public.client_message_reads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Sitters view read receipts for their messages"
ON public.client_message_reads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_messages m
    WHERE m.id = client_message_reads.client_message_id
      AND m.sitter_id = auth.uid()
      AND public.has_role(auth.uid(), 'sitter')
  )
);

CREATE POLICY "Clients mark their own messages as read"
ON public.client_message_reads
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.client_messages m
    WHERE m.id = client_message_reads.client_message_id
      AND m.customer_id = auth.uid()
  )
);

CREATE TABLE public.service_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id UUID NOT NULL,
  kind public.service_alert_kind NOT NULL DEFAULT 'announcement',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  pin_to_profile BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_alerts_sitter_active_window
  ON public.service_alerts (sitter_id, is_active, starts_at DESC);

ALTER TABLE public.service_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients view active alerts from their sitter"
ON public.service_alerts
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND starts_at <= now()
  AND (ends_at IS NULL OR ends_at >= now())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = sitter_id
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.customer_id = auth.uid()
        AND b.sitter_id = service_alerts.sitter_id
    )
  )
);

CREATE POLICY "Sitters manage their own service alerts"
ON public.service_alerts
FOR ALL
TO authenticated
USING (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'))
WITH CHECK (auth.uid() = sitter_id AND auth.uid() = created_by AND public.has_role(auth.uid(), 'sitter'));

CREATE POLICY "Admins view all service alerts"
ON public.service_alerts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.service_alert_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_alert_id UUID NOT NULL REFERENCES public.service_alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_alert_id, user_id)
);

CREATE INDEX idx_service_alert_reads_user_id
  ON public.service_alert_reads (user_id, read_at DESC);

ALTER TABLE public.service_alert_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients view their own service alert receipts"
ON public.service_alert_reads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Sitters view receipts for their alerts"
ON public.service_alert_reads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.service_alerts a
    WHERE a.id = service_alert_reads.service_alert_id
      AND a.sitter_id = auth.uid()
      AND public.has_role(auth.uid(), 'sitter')
  )
);

CREATE POLICY "Clients mark their own service alerts as read"
ON public.service_alert_reads
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.service_alerts a
    WHERE a.id = service_alert_reads.service_alert_id
      AND a.is_active = true
      AND a.starts_at <= now()
      AND (a.ends_at IS NULL OR a.ends_at >= now())
      AND (
        a.sitter_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.customer_id = auth.uid()
            AND b.sitter_id = a.sitter_id
        )
      )
  )
);

CREATE TRIGGER update_client_messages_updated_at
BEFORE UPDATE ON public.client_messages
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER update_service_alerts_updated_at
BEFORE UPDATE ON public.service_alerts
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();