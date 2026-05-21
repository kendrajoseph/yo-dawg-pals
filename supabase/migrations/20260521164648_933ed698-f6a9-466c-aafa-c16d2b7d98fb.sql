CREATE TABLE IF NOT EXISTS public.email_user_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('archive','log')),
  source_id text NOT NULL,
  read_at timestamptz,
  starred_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_type, source_id)
);

ALTER TABLE public.email_user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email state"
  ON public.email_user_state FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER email_user_state_updated_at
  BEFORE UPDATE ON public.email_user_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_email_user_state_lookup
  ON public.email_user_state(user_id, source_type, source_id);