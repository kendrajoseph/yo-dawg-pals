CREATE TABLE public.sitter_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  booking_id UUID NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sitter_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sitter_notifications_user_created_at
  ON public.sitter_notifications (user_id, created_at DESC);

CREATE INDEX idx_sitter_notifications_user_unread
  ON public.sitter_notifications (user_id, read_at, created_at DESC);

CREATE POLICY "Sitters view own notifications"
ON public.sitter_notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Sitters mark own notifications as read"
ON public.sitter_notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role inserts sitter notifications"
ON public.sitter_notifications
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');