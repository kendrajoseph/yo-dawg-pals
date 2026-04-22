ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS terms_version TEXT;

CREATE OR REPLACE FUNCTION public.validate_booking_terms_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.terms_accepted_at IS NULL OR NEW.terms_version IS NULL OR btrim(NEW.terms_version) = '' THEN
      RAISE EXCEPTION 'Terms acceptance is required before creating a booking';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.terms_accepted_at IS NOT NULL AND NEW.terms_accepted_at IS NULL THEN
      RAISE EXCEPTION 'Terms acceptance timestamp cannot be removed';
    END IF;

    IF OLD.terms_version IS NOT NULL AND (NEW.terms_version IS NULL OR btrim(NEW.terms_version) = '') THEN
      RAISE EXCEPTION 'Terms acceptance version cannot be removed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_booking_terms_acceptance_on_bookings ON public.bookings;

CREATE TRIGGER validate_booking_terms_acceptance_on_bookings
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_terms_acceptance();