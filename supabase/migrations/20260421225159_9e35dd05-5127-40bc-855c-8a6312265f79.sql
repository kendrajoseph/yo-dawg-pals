-- Junction table: slot ↔ service (multi-select per slot)
CREATE TABLE IF NOT EXISTS public.availability_services (
  availability_id uuid NOT NULL REFERENCES public.availability(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (availability_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_availability_services_service
  ON public.availability_services(service_id);

ALTER TABLE public.availability_services ENABLE ROW LEVEL SECURITY;

-- Public can read (booking page needs this)
CREATE POLICY "Availability services are public"
  ON public.availability_services
  FOR SELECT
  USING (true);

-- Sitters manage tags only on their own slots
CREATE POLICY "Sitters manage tags on own slots"
  ON public.availability_services
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.availability a
      WHERE a.id = availability_services.availability_id
        AND a.sitter_id = auth.uid()
        AND public.has_role(auth.uid(), 'sitter'::public.app_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.availability a
      WHERE a.id = availability_services.availability_id
        AND a.sitter_id = auth.uid()
        AND public.has_role(auth.uid(), 'sitter'::public.app_role)
    )
  );

-- Migrate existing slots: tag every current slot with every active service
INSERT INTO public.availability_services (availability_id, service_id)
SELECT a.id, s.id
FROM public.availability a
CROSS JOIN public.services s
WHERE s.is_active = true
ON CONFLICT DO NOTHING;