CREATE OR REPLACE FUNCTION public.create_telegram_link_token()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token text;
BEGIN
  v_token := replace(gen_random_uuid()::text, '-', '');
  v_token := substr(v_token, 1, 12);

  INSERT INTO public.sitter_telegram_links (sitter_id, telegram_chat_id, link_token, link_token_expires_at)
  VALUES (auth.uid(), 0, v_token, now() + interval '15 minutes')
  ON CONFLICT (sitter_id) DO UPDATE
    SET link_token = EXCLUDED.link_token,
        link_token_expires_at = EXCLUDED.link_token_expires_at;

  RETURN v_token;
END;
$function$;