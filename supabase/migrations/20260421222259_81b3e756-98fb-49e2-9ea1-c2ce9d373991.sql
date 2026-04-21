CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');

  IF lower(NEW.email) = 'anneke@yodawg.ca' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'sitter')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;