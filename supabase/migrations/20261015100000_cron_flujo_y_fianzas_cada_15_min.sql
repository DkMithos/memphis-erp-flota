-- 2026-10-15 · Shirley (Administración) reclamó que el ERP no refleja su Excel: el cron leía SharePoint solo a las 06:00 y
-- 15:00 (hora Perú), así que un cambio hecho a las 16:00 recién entraba al día siguiente. Las lecturas pasan a cada 15 minutos.
-- flujo-import solo reimporta la base cuya fecha de modificación cambió (las demás se "omiten"), y fianzas-import lee un
-- único libro: el costo por lectura es una llamada a Graph. Los dos jobs se recrean con nombre nuevo y el mismo comando
-- (apikey + x-cron-secret desde vault), desfasados 3 minutos para no coincidir.
select cron.schedule('flujo-import-15min', '*/15 * * * *', (select command from cron.job where jobname = 'flujo-import-2xdia'));
select cron.schedule('fianzas-import-15min', '3,18,33,48 * * * *', (select command from cron.job where jobname = 'fianzas-import-2xdia'));
select cron.unschedule('flujo-import-2xdia');
select cron.unschedule('fianzas-import-2xdia');
