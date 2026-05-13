-- 1. Sitter Telegram link
CREATE TABLE public.sitter_telegram_links (
  sitter_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id bigint NOT NULL UNIQUE,
  telegram_username text,
  telegram_first_name text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  digest_enabled boolean NOT NULL DEFAULT true,
  digest_hour_local integer NOT NULL DEFAULT 20,
  digest_timezone text NOT NULL DEFAULT 'America/Toronto',
  last_digest_sent_for date,
  link_token text UNIQUE,
  link_token_expires_at timestamptz
);

CREATE INDEX idx_telegram_links_chat_id ON public.sitter_telegram_links(telegram_chat_id);

ALTER TABLE public.sitter_telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters manage their own telegram link"
  ON public.sitter_telegram_links
  FOR ALL
  TO authenticated
  USING (sitter_id = auth.uid())
  WITH CHECK (sitter_id = auth.uid());

-- 2. Extend booking_updates
ALTER TABLE public.booking_updates
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS undone_at timestamptz,
  ADD COLUMN IF NOT EXISTS undone_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_booking_updates_source ON public.booking_updates(source);
CREATE INDEX IF NOT EXISTS idx_booking_updates_created_by_active
  ON public.booking_updates(created_by, created_at DESC)
  WHERE undone_at IS NULL;

-- 3. Telegram messages log
CREATE TABLE public.telegram_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  telegram_chat_id bigint NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL,
  body text,
  raw_payload jsonb,
  related_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_log_sitter ON public.telegram_messages_log(sitter_id, created_at DESC);
CREATE INDEX idx_telegram_log_chat ON public.telegram_messages_log(telegram_chat_id, created_at DESC);

ALTER TABLE public.telegram_messages_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters read their own telegram log"
  ON public.telegram_messages_log
  FOR SELECT
  TO authenticated
  USING (sitter_id = auth.uid());

-- 4. Create link token
CREATE OR REPLACE FUNCTION public.create_telegram_link_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := encode(gen_random_bytes(6), 'hex');

  INSERT INTO public.sitter_telegram_links (sitter_id, telegram_chat_id, link_token, link_token_expires_at)
  VALUES (auth.uid(), 0, v_token, now() + interval '15 minutes')
  ON CONFLICT (sitter_id) DO UPDATE
    SET link_token = EXCLUDED.link_token,
        link_token_expires_at = EXCLUDED.link_token_expires_at;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_telegram_link_token() TO authenticated;

-- 5. Redeem link token
CREATE OR REPLACE FUNCTION public.redeem_telegram_link_token(
  p_token text,
  p_chat_id bigint,
  p_username text,
  p_first_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sitter_id uuid;
BEGIN
  SELECT sitter_id INTO v_sitter_id
  FROM public.sitter_telegram_links
  WHERE link_token = p_token
    AND link_token_expires_at > now();

  IF v_sitter_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.sitter_telegram_links
  SET telegram_chat_id = p_chat_id,
      telegram_username = p_username,
      telegram_first_name = p_first_name,
      linked_at = now(),
      link_token = NULL,
      link_token_expires_at = NULL
  WHERE sitter_id = v_sitter_id;

  RETURN v_sitter_id;
END;
$$;