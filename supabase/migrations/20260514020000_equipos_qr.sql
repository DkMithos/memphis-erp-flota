-- ============================================================================
-- QR UNIVERSAL: Agregar soporte QR público a equipos biomédicos
-- Replica el patrón de vehiculos (public_token + public_view_enabled)
-- REFERENCIA — aplicar manualmente en Supabase Dashboard o CLI
-- ============================================================================

-- 1. Columnas nuevas
ALTER TABLE equipos_biomedicos
  ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS public_view_enabled BOOLEAN DEFAULT TRUE;

-- 2. Índice único para búsqueda por token
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipos_bio_public_token
  ON equipos_biomedicos(public_token)
  WHERE public_token IS NOT NULL;

-- 3. Backfill: generar token para equipos existentes sin token
UPDATE equipos_biomedicos
  SET public_token = gen_random_uuid()
  WHERE public_token IS NULL;

-- 4. RLS Policy: permitir SELECT público por token (sin auth)
-- Nota: requiere que RLS esté habilitado en la tabla
CREATE POLICY "equipos_biomedicos: acceso público por token"
  ON equipos_biomedicos
  FOR SELECT
  TO anon
  USING (public_view_enabled = TRUE AND public_token IS NOT NULL);
