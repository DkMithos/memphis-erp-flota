-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260831143402  name: cron_envia_cron_secret_desde_vault

-- CRON_SECRET ya está configurado en los secretos del proyecto (Kevin, 27/08/2026),
-- así que excel-sync y notif-scheduler ahora RECHAZAN lo que no traiga el header.
-- Los cron deben enviarlo o el trabajo diario empieza a fallar con 403.
-- El secreto se lee de Vault en cada ejecución: no queda en texto plano en cron.job.
-- La apikey sí va inline: es la anon key, que es pública por definición.

select cron.unschedule('notif-scheduler-diario');
select cron.schedule(
  'notif-scheduler-diario',
  '0 13 * * *',
  $cron$
  select net.http_post(
    url := 'https://icmuqwgrjgjoebnwunnf.supabase.co/functions/v1/notif-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljbXVxd2dyamdqb2Vibnd1bm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzY2NzIsImV4cCI6MjA4NzYxMjY3Mn0.HBtu1hNBxh_KfhtoimmGS10a819-J8s-tAeYrl7e0ig',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

select cron.unschedule('excel-sync-30min');
select cron.schedule(
  'excel-sync-30min',
  '*/30 * * * *',
  $cron$
  select net.http_post(
    url := 'https://icmuqwgrjgjoebnwunnf.supabase.co/functions/v1/excel-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljbXVxd2dyamdqb2Vibnd1bm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzY2NzIsImV4cCI6MjA4NzYxMjY3Mn0.HBtu1hNBxh_KfhtoimmGS10a819-J8s-tAeYrl7e0ig',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
-- excel-sync sigue desactivado: el espejo de Excel se actualiza a pedido (N27).
select cron.alter_job((select jobid from cron.job where jobname = 'excel-sync-30min'), active := false);
