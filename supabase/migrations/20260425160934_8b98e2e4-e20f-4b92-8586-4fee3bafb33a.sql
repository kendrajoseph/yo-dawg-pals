-- Function that deletes service alerts whose ends_at has passed.
CREATE OR REPLACE FUNCTION public.delete_expired_service_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  removed integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.service_alerts
    WHERE ends_at IS NOT NULL
      AND ends_at < now()
    RETURNING 1
  )
  SELECT count(*) INTO removed FROM deleted;
  RETURN removed;
END;
$$;

-- Unschedule any prior version of the job, then schedule fresh (every 5 minutes).
DO $$
BEGIN
  PERFORM cron.unschedule('delete-expired-service-alerts');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'delete-expired-service-alerts',
  '*/5 * * * *',
  $$ SELECT public.delete_expired_service_alerts(); $$
);