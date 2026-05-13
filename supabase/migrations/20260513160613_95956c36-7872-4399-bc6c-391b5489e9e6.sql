
CREATE TABLE public.inbound_sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twilio_message_sid text,
  from_phone text NOT NULL,
  to_phone text,
  body text NOT NULL,
  matched_profile_id uuid,
  is_stop boolean NOT NULL DEFAULT false,
  is_help boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbound_sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view inbound sms"
  ON public.inbound_sms_messages
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role inserts inbound sms"
  ON public.inbound_sms_messages
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_inbound_sms_from_phone ON public.inbound_sms_messages(from_phone);
CREATE INDEX idx_inbound_sms_created_at ON public.inbound_sms_messages(created_at DESC);

ALTER TABLE public.profiles
  ADD COLUMN sms_unsubscribed_at timestamptz;
