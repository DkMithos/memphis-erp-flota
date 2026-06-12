-- ===========================================================================
-- Hardening según Supabase security advisors (re-auditoría QA 2026-06-10)
-- Resuelve 6 de 7 hallazgos del linter de seguridad de Supabase.
-- ===========================================================================

-- 1. Funciones SECURITY DEFINER no deben ser ejecutables vía RPC por anon/authenticated.
--    handle_new_user es un trigger (solo lo invoca el sistema al crear usuarios);
--    rls_auto_enable es interna de mantenimiento.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;

-- 2. Tablas con RLS habilitado pero sin políticas (deny-all implícito → política explícita).
--    tenant_email_domains: solo lectura para autenticados (mapeo dominio→tenant, no sensible;
--    la escritura queda denegada — solo service role / trigger SECURITY DEFINER).
CREATE POLICY "tenant_email_domains: lectura autenticados" ON public.tenant_email_domains
  FOR SELECT TO authenticated USING (true);

--    tipos_comprobante_sunat: catálogo de sistema SUNAT, lectura para autenticados.
CREATE POLICY "tipos_comprobante_sunat: lectura autenticados" ON public.tipos_comprobante_sunat
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- HALLAZGO ACEPTADO (no corregible):
-- "Extension pg_net is installed in the public schema" — pg_net NO soporta
-- ALTER EXTENSION ... SET SCHEMA (error 0A000). Sus funciones reales viven en
-- el esquema `net` (net.http_post), no en public. Riesgo residual: bajo.
-- ---------------------------------------------------------------------------
