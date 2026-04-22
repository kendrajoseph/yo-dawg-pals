CREATE TABLE public.pet_temperament_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'owner' CHECK (visibility IN ('owner', 'internal')),
  risk_services TEXT[] NOT NULL DEFAULT '{}',
  risk_message TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_temperament_tags ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pet_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.pet_temperament_tags(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pet_id, tag_id)
);

ALTER TABLE public.pet_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pet_fit_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  approval_id UUID REFERENCES public.sitter_pet_approvals(id) ON DELETE SET NULL,
  triggered_by UUID NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  conflicting_tag_ids UUID[] NOT NULL DEFAULT '{}',
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_fit_alerts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_pet_temperament_tags_updated_at ON public.pet_temperament_tags;
CREATE TRIGGER update_pet_temperament_tags_updated_at
BEFORE UPDATE ON public.pet_temperament_tags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pet_fit_alerts_updated_at ON public.pet_fit_alerts;
CREATE TRIGGER update_pet_fit_alerts_updated_at
BEFORE UPDATE ON public.pet_fit_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone signed in can view owner-visible temperament tags"
ON public.pet_temperament_tags
FOR SELECT
TO authenticated
USING (is_active = true AND visibility = 'owner');

CREATE POLICY "Anneke and admins can view all temperament tags"
ON public.pet_temperament_tags
FOR SELECT
TO authenticated
USING (
  lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Anneke and admins can manage temperament tags"
ON public.pet_temperament_tags
FOR ALL
TO authenticated
USING (
  lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Owners can view visible tags on their pets"
ON public.pet_tag_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pets p
    JOIN public.pet_temperament_tags t ON t.id = public.pet_tag_assignments.tag_id
    WHERE p.id = public.pet_tag_assignments.pet_id
      AND p.owner_id = auth.uid()
      AND t.visibility = 'owner'
      AND t.is_active = true
  )
);

CREATE POLICY "Anneke and admins can view all pet tag assignments"
ON public.pet_tag_assignments
FOR SELECT
TO authenticated
USING (
  lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Owners can manage visible tags on their pets"
ON public.pet_tag_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.pets p
    JOIN public.pet_temperament_tags t ON t.id = public.pet_tag_assignments.tag_id
    WHERE p.id = public.pet_tag_assignments.pet_id
      AND p.owner_id = auth.uid()
      AND t.visibility = 'owner'
      AND t.is_active = true
  )
);

CREATE POLICY "Owners can remove visible tags from their pets"
ON public.pet_tag_assignments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pets p
    JOIN public.pet_temperament_tags t ON t.id = public.pet_tag_assignments.tag_id
    WHERE p.id = public.pet_tag_assignments.pet_id
      AND p.owner_id = auth.uid()
      AND t.visibility = 'owner'
  )
);

CREATE POLICY "Anneke and admins can manage all pet tag assignments"
ON public.pet_tag_assignments
FOR ALL
TO authenticated
USING (
  lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Anneke and admins can view fit alerts"
ON public.pet_fit_alerts
FOR SELECT
TO authenticated
USING (
  lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Anneke and admins can create fit alerts"
ON public.pet_fit_alerts
FOR INSERT
TO authenticated
WITH CHECK (
  triggered_by = auth.uid()
  AND (
    lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Anneke and admins can update fit alerts"
ON public.pet_fit_alerts
FOR UPDATE
TO authenticated
USING (
  lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  lower((auth.jwt() ->> 'email')) = 'anneke@yodawg.ca'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

INSERT INTO public.pet_temperament_tags (slug, label, description, visibility, risk_services, risk_message, sort_order)
VALUES
  ('dog-selective', 'Dog selective', 'Needs careful dog introductions and space around unfamiliar dogs.', 'owner', ARRAY['group-walk'], 'This pet may not be a safe fit for a group walk without extra review.', 10),
  ('reactive-on-leash', 'Reactive on leash', 'Can lunge, bark, or overreact when passing triggers on walks.', 'owner', ARRAY['group-walk'], 'Reactive leash behavior needs review before any shared walk setting.', 20),
  ('resource-guarding', 'Resource guarding', 'May guard food, toys, space, or handling.', 'owner', ARRAY['group-walk','boarding'], 'Resource guarding can create risk in shared care settings.', 30),
  ('fearful-of-strangers', 'Fearful of strangers', 'Needs slow introductions and patience with new people.', 'owner', ARRAY['group-walk'], 'Fearful dogs may struggle in group walk handoffs or group energy.', 40),
  ('high-prey-drive', 'High prey drive', 'Highly stimulated by squirrels, cats, or fast-moving animals.', 'owner', ARRAY['group-walk'], 'High prey drive needs extra consideration for shared walks.', 50),
  ('aggression-history', 'History of aggression', 'Has shown aggressive behavior toward people or other animals.', 'owner', ARRAY['group-walk','boarding'], 'Aggression history should not be auto-cleared for shared settings.', 60),
  ('escape-risk', 'Escape risk', 'Door darts, backs out of gear, or is likely to bolt.', 'owner', ARRAY['group-walk','boarding'], 'Escape risk needs extra handling review in higher-complexity services.', 70),
  ('needs-solo-handling', 'Needs solo handling', 'Does best one-on-one and away from shared pack settings.', 'owner', ARRAY['group-walk'], 'Solo-handling dogs should be reviewed carefully before group walks.', 80),
  ('bite-incident', 'Previous bite incident', 'Internal staff-only marker for previous bite concerns.', 'internal', ARRAY['group-walk','boarding'], 'A previous bite concern is a serious risk flag for shared services.', 90),
  ('staff-observed-reactivity', 'Staff observed reactivity', 'Internal staff-only note for behavior seen during care or meet-and-greet.', 'internal', ARRAY['group-walk'], 'Observed reactivity during care should be reviewed before shared walks.', 100)
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    visibility = EXCLUDED.visibility,
    risk_services = EXCLUDED.risk_services,
    risk_message = EXCLUDED.risk_message,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();