-- Hide blocked_dates.reason from customers
-- Drop the broad authenticated SELECT policy and replace with sitter/admin-only access
DROP POLICY IF EXISTS "Authenticated users read blocked dates" ON public.blocked_dates;

-- Sitters/admins keep full access via existing "Sitters manage own blocked dates" policy
-- Add an admin read policy for completeness
CREATE POLICY "Admins read all blocked dates"
  ON public.blocked_dates
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create a public view exposing only sitter_id + blocked_date (no reason)
CREATE OR REPLACE VIEW public.blocked_dates_public
WITH (security_invoker = off) AS
  SELECT id, sitter_id, blocked_date
  FROM public.blocked_dates;

GRANT SELECT ON public.blocked_dates_public TO anon, authenticated;