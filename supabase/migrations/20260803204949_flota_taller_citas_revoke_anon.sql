-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260803204949  name: flota_taller_citas_revoke_anon


-- El taller_mis_citas() solo debe ser llamado por usuarios autenticados (talleres).
-- Supabase concede EXECUTE por defecto a anon/authenticated/service_role; se revoca anon.
REVOKE EXECUTE ON FUNCTION public.taller_mis_citas() FROM anon;

