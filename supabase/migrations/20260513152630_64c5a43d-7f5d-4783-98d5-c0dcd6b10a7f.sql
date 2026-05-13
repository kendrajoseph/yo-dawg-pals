
CREATE TABLE public.personal_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sitter_id uuid NOT NULL,
  title text NOT NULL,
  notes text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  category text NOT NULL DEFAULT 'personal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX personal_events_sitter_start_idx ON public.personal_events (sitter_id, start_at);

ALTER TABLE public.personal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitter manages own personal events"
  ON public.personal_events FOR ALL
  TO authenticated
  USING (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'::app_role))
  WITH CHECK (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'::app_role));

CREATE POLICY "Admins view all personal events"
  ON public.personal_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER personal_events_set_updated_at
  BEFORE UPDATE ON public.personal_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
