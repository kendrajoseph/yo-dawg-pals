CREATE TABLE public.client_admin_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL UNIQUE,
  star_rating SMALLINT NOT NULL DEFAULT 3,
  internal_notes TEXT,
  last_updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT client_admin_profiles_star_rating_check CHECK (star_rating BETWEEN 1 AND 5)
);

ALTER TABLE public.client_admin_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view client admin profiles"
ON public.client_admin_profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins create client admin profiles"
ON public.client_admin_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND last_updated_by = auth.uid()
);

CREATE POLICY "Admins update client admin profiles"
ON public.client_admin_profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND last_updated_by = auth.uid()
);

CREATE POLICY "Admins delete client admin profiles"
ON public.client_admin_profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_client_admin_profiles_updated_at
BEFORE UPDATE ON public.client_admin_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();