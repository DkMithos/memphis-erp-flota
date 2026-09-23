-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260810143005  name: auditoria_limpiar_policies_anon_muertas_vehiculo_documentos


-- AUDITORIA: restos del QR publico ANTERIOR. Estas dos politicas (duplicadas
-- entre si) daban SELECT anon a TODOS los vehiculo_documentos de cualquier
-- vehiculo con public_view_enabled, SIN exigir el token. Hoy no son explotables
-- porque en la Fase E se elimino la politica anon de `vehiculos` y su EXISTS ya
-- no resuelve — pero quedan como trampa: si alguien reintrodujera una politica
-- anon en `vehiculos`, los documentos (N° de SOAT, vencimientos) se filtrarian.
-- El QR publico ya NO necesita esta tabla: usa vehiculo_public_by_token(), que
-- devuelve solo tipo + estado del documento.
DROP POLICY IF EXISTS "vehiculo_docs: public access via vehiculo token" ON public.vehiculo_documentos;
DROP POLICY IF EXISTS "vehiculo_docs: public_token acceso sin auth" ON public.vehiculo_documentos;

