-- Allow clients to delete their own direct messages from the hub
CREATE POLICY "Clients delete their own direct messages"
ON public.client_messages
FOR DELETE
TO authenticated
USING (auth.uid() = customer_id);

-- Ensure pg_cron is available, then schedule expiry of stale alerts
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if present to make this idempotent
DO $$
BEGIN
  PERFORM cron.unschedule('deactivate-expired-service-alerts');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'deactivate-expired-service-alerts',
  '5 * * * *',
  $$UPDATE public.service_alerts
    SET is_active = false, updated_at = now()
    WHERE is_active = true
      AND ends_at IS NOT NULL
      AND ends_at < now();$$
);