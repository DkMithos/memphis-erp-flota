-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260710162450  name: portal_proveedores_fase_b_rls

-- PORTAL PROVEEDORES Fase B — acceso del rol proveedor vía RLS.
-- Diseño de seguridad: el JWT del proveedor lleva app_metadata.tipo='proveedor'
-- y app_metadata.proveedor_id, pero NO lleva tenant_id → auth_tenant_id() = NULL
-- → TODAS las políticas internas del ERP le niegan acceso. Solo estas políticas
-- específicas (SELECT) le abren exactamente sus datos.

-- 1. Identidad del proveedor desde el JWT (patrón initplan, como auth_tenant_id)
CREATE OR REPLACE FUNCTION public.auth_proveedor_id()
RETURNS uuid
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT CASE
    WHEN (auth.jwt() -> 'app_metadata' ->> 'tipo') = 'proveedor'
    THEN (auth.jwt() -> 'app_metadata' ->> 'proveedor_id')::uuid
    ELSE NULL
  END;
$$;

-- 2. El proveedor lee SU ficha (razón social para el portal)
DROP POLICY IF EXISTS portal_proveedor_lee_su_ficha ON proveedores;
CREATE POLICY portal_proveedor_lee_su_ficha ON proveedores
  FOR SELECT TO authenticated
  USING (id = ( SELECT auth_proveedor_id() ));

-- 3. El proveedor lee SUS órdenes (nunca borradores ni anuladas)
DROP POLICY IF EXISTS portal_proveedor_lee_sus_ordenes ON ordenes_compra;
CREATE POLICY portal_proveedor_lee_sus_ordenes ON ordenes_compra
  FOR SELECT TO authenticated
  USING (
    proveedor_id = ( SELECT auth_proveedor_id() )
    AND estado NOT IN ('borrador','anulada')
  );

-- 4. El proveedor lee SUS facturas
DROP POLICY IF EXISTS portal_proveedor_lee_sus_facturas ON comprobantes_pago;
CREATE POLICY portal_proveedor_lee_sus_facturas ON comprobantes_pago
  FOR SELECT TO authenticated
  USING (proveedor_id = ( SELECT auth_proveedor_id() ));

-- 5. Storage: el proveedor lee sus archivos; el staff del tenant lee todos los
--    del bucket de facturas. (Las subidas van por la Edge Function con admin.)
DROP POLICY IF EXISTS portal_proveedor_lee_sus_archivos ON storage.objects;
CREATE POLICY portal_proveedor_lee_sus_archivos ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'facturas-proveedores'
    AND (storage.foldername(name))[2] = ( SELECT auth_proveedor_id() )::text
  );
DROP POLICY IF EXISTS staff_lee_facturas_tenant ON storage.objects;
CREATE POLICY staff_lee_facturas_tenant ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'facturas-proveedores'
    AND (storage.foldername(name))[1] = ( SELECT auth_tenant_id() )::text
  );
