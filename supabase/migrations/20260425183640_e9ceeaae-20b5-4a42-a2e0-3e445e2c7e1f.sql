DROP VIEW IF EXISTS public.blocked_dates_public;

CREATE OR REPLACE FUNCTION public.get_blocked_dates(_sitter_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, sitter_id uuid, blocked_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.sitter_id, b.blocked_date
  FROM public.blocked_dates b
  WHERE _sitter_id IS NULL OR b.sitter_id = _sitter_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_blocked_dates(uuid) TO anon, authenticated;