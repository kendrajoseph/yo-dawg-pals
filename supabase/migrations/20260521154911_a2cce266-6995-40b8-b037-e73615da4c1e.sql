ALTER TABLE public.client_reviews
  ADD COLUMN IF NOT EXISTS service_feedback text,
  ADD COLUMN IF NOT EXISTS value_feedback text,
  ADD COLUMN IF NOT EXISTS improvement_feedback text;