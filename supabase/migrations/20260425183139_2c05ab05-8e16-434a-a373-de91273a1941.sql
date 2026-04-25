-- Lock down profiles table — currently publicly readable, leaks PII, Stripe IDs, and bio (door codes)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Sitters and admins read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'sitter') OR public.has_role(auth.uid(), 'admin'));

-- Public-safe view exposing only non-sensitive fields, for invoice/marketing surfaces
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT id, full_name, avatar_url
  FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Lock down blocked_dates — currently leaks Anneke's private "reason" text publicly
DROP POLICY IF EXISTS "Blocked dates are public" ON public.blocked_dates;

CREATE POLICY "Authenticated users read blocked dates"
  ON public.blocked_dates
  FOR SELECT
  TO authenticated
  USING (true);