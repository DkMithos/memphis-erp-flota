-- ===========================================================================
-- Cron diario para notif-scheduler (notificaciones programadas → Teams)
-- Corre 13:00 UTC (08:00 Perú). Llama a la Edge Function notif-scheduler vía pg_net.
-- El apikey es la anon key (pública). La función es verify_jwt=false y puede
-- endurecerse con CRON_SECRET (header x-cron-secret) si se desea.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notif-scheduler-diario') THEN
    PERFORM cron.unschedule('notif-scheduler-diario');
  END IF;
END $$;

SELECT cron.schedule(
  'notif-scheduler-diario',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://icmuqwgrjgjoebnwunnf.supabase.co/functions/v1/notif-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_KEY>'  -- reemplazar por la anon key del proyecto al aplicar
    ),
    body := '{}'::jsonb
  );
  $$
);
