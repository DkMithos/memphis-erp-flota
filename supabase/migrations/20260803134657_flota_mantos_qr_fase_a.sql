-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260803134657  name: flota_mantos_qr_fase_a

-- FLOTA · Mantenimientos con confirmación por QR — Fase A (modelo).
-- docs/FLOTA-MANTENIMIENTOS-FLUJO.md (N23). Aditivo, no rompe nada.

-- 1. Taller fijo por flota
ALTER TABLE flotas ADD COLUMN IF NOT EXISTS taller_id uuid REFERENCES talleres(id);
CREATE INDEX IF NOT EXISTS idx_flotas_taller ON flotas(taller_id);

-- 2. talleres: código único por tenant (identidad de login) + acceso al portal.
--    proveedor_id ya existe y es OPCIONAL (un taller NO tiene que ser proveedor).
ALTER TABLE talleres
  ADD COLUMN IF NOT EXISTS portal_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_user_id uuid,
  ADD COLUMN IF NOT EXISTS email_portal text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_talleres_codigo ON talleres(tenant_id, codigo);

-- 3. vehiculo_mantenimientos: cita + confirmación del taller + aprobación de Memphis + evidencia.
--    estado (text libre): programado → registrado_taller | pendiente_aprobacion → confirmado | observado
--    (además de los previos ejecutado/no_ejecutado/reprogramado, que se mantienen).
ALTER TABLE vehiculo_mantenimientos
  ADD COLUMN IF NOT EXISTS taller_id uuid REFERENCES talleres(id),
  ADD COLUMN IF NOT EXISTS hora_cita time,
  ADD COLUMN IF NOT EXISTS confirmado_por_taller boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_taller_en timestamptz,
  ADD COLUMN IF NOT EXISTS requiere_aprobacion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprobado_por uuid,
  ADD COLUMN IF NOT EXISTS aprobado_en timestamptz,
  ADD COLUMN IF NOT EXISTS cerrado_por uuid,
  ADD COLUMN IF NOT EXISTS cerrado_en timestamptz,
  ADD COLUMN IF NOT EXISTS km_proyectado_siguiente integer,
  ADD COLUMN IF NOT EXISTS fotos jsonb NOT NULL DEFAULT '[]'::jsonb;  -- [{path, subido_en}]
CREATE INDEX IF NOT EXISTS idx_vm_taller ON vehiculo_mantenimientos(taller_id);
CREATE INDEX IF NOT EXISTS idx_vm_estado ON vehiculo_mantenimientos(estado);

-- 4. Bucket privado de fotos de evidencia (las políticas del taller se afinan en Fase C).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidencias-mantenimiento', 'evidencias-mantenimiento', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','image/heic'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Staff del tenant lee las evidencias de su tenant (primer segmento del path = tenant_id).
DROP POLICY IF EXISTS staff_lee_evidencias_tenant ON storage.objects;
CREATE POLICY staff_lee_evidencias_tenant ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidencias-mantenimiento'
    AND (storage.foldername(name))[1] = ( SELECT auth_tenant_id() )::text
  );
