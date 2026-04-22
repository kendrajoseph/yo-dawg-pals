ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'requested';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'awaiting_payment';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_kind text NOT NULL DEFAULT 'instant',
  ADD COLUMN IF NOT EXISTS requested_date date,
  ADD COLUMN IF NOT EXISTS requested_window_label text,
  ADD COLUMN IF NOT EXISTS requested_window_start_minute integer,
  ADD COLUMN IF NOT EXISTS requested_window_end_minute integer,
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS group_assignment_label text,
  ADD COLUMN IF NOT EXISTS internal_notes text;

UPDATE public.bookings
SET booking_kind = COALESCE(booking_kind, 'instant'),
    scheduled_start_at = COALESCE(scheduled_start_at, start_at),
    scheduled_end_at = COALESCE(scheduled_end_at, end_at)
WHERE scheduled_start_at IS NULL
   OR scheduled_end_at IS NULL
   OR booking_kind IS DISTINCT FROM 'instant';

CREATE TABLE IF NOT EXISTS public.walk_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  weekday integer NOT NULL,
  start_minute integer NOT NULL,
  end_minute integer NOT NULL,
  window_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_walk_windows_sitter_weekday ON public.walk_windows (sitter_id, weekday);
CREATE INDEX IF NOT EXISTS idx_walk_windows_service ON public.walk_windows (service_id);

ALTER TABLE public.walk_windows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'walk_windows' AND policyname = 'Walk windows are public'
  ) THEN
    CREATE POLICY "Walk windows are public"
    ON public.walk_windows
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'walk_windows' AND policyname = 'Sitters manage own walk windows'
  ) THEN
    CREATE POLICY "Sitters manage own walk windows"
    ON public.walk_windows
    FOR ALL
    TO authenticated
    USING (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'))
    WITH CHECK (auth.uid() = sitter_id AND public.has_role(auth.uid(), 'sitter'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bookings_updated_at'
  ) THEN
    CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;