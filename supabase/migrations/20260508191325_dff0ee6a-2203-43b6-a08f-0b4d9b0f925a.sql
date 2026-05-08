-- Manual clients & pets owned/created by sitter
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by_sitter_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS created_by_sitter_id UUID;

CREATE INDEX IF NOT EXISTS profiles_created_by_sitter_idx ON public.profiles(created_by_sitter_id);
CREATE INDEX IF NOT EXISTS pets_created_by_sitter_idx ON public.pets(created_by_sitter_id);

-- Sitters can insert/select/update profiles they manually created
DROP POLICY IF EXISTS "Sitters insert manual client profiles" ON public.profiles;
CREATE POLICY "Sitters insert manual client profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'sitter'::app_role)
    AND created_by_sitter_id = auth.uid()
    AND is_manual = true
  );

DROP POLICY IF EXISTS "Sitters read manual client profiles" ON public.profiles;
CREATE POLICY "Sitters read manual client profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'sitter'::app_role)
    AND created_by_sitter_id = auth.uid()
  );

DROP POLICY IF EXISTS "Sitters update manual client profiles" ON public.profiles;
CREATE POLICY "Sitters update manual client profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'sitter'::app_role) AND created_by_sitter_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'sitter'::app_role) AND created_by_sitter_id = auth.uid());

-- Sitters can manage pets they added (for any owner)
DROP POLICY IF EXISTS "Sitters insert pets they manage" ON public.pets;
CREATE POLICY "Sitters insert pets they manage"
  ON public.pets FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'sitter'::app_role)
    AND created_by_sitter_id = auth.uid()
  );

DROP POLICY IF EXISTS "Sitters read pets they manage" ON public.pets;
CREATE POLICY "Sitters read pets they manage"
  ON public.pets FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'sitter'::app_role)
    AND created_by_sitter_id = auth.uid()
  );

DROP POLICY IF EXISTS "Sitters update pets they manage" ON public.pets;
CREATE POLICY "Sitters update pets they manage"
  ON public.pets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'sitter'::app_role) AND created_by_sitter_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'sitter'::app_role) AND created_by_sitter_id = auth.uid());

DROP POLICY IF EXISTS "Sitters delete pets they manage" ON public.pets;
CREATE POLICY "Sitters delete pets they manage"
  ON public.pets FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'sitter'::app_role) AND created_by_sitter_id = auth.uid());