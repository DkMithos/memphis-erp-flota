-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260710161122  name: portal_proveedores_fase_a

-- PORTAL DE PROVEEDORES — Fase A (backend de la factura).
-- docs/PORTAL-PROVEEDORES.md. Aditivo: no rompe nada existente.

-- 1. Flag de domiciliado (elegibilidad al portal). No inferir del prefijo del RUC.
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS domiciliado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS portal_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_portal text; -- email real para invitación/avisos

-- Backfill: los 5 proveedores extranjeros de software = no domiciliados.
UPDATE proveedores SET domiciliado = false
WHERE codigo IN ('PROV-0225','PROV-0222','PROV-0220','PROV-0187','PROV-0221');
-- Geremie (PROV-0324) queda domiciliado=true (RUC pendiente, no extranjero).

-- 2. Extender comprobantes_pago para el flujo de factura del portal.
ALTER TABLE comprobantes_pago
  ADD COLUMN IF NOT EXISTS orden_compra_id uuid REFERENCES ordenes_compra(id),
  ADD COLUMN IF NOT EXISTS recepcion_id uuid REFERENCES recepciones(id),
  ADD COLUMN IF NOT EXISTS estado_flujo text NOT NULL DEFAULT 'recibida',
    -- recibida | validada | observada | conforme | programada_pago | pagada | anulada
  ADD COLUMN IF NOT EXISTS xml_path text,   -- ruta en Storage (bucket facturas-proveedores)
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS subido_por_proveedor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subido_por uuid, -- auth.users.id del proveedor
  ADD COLUMN IF NOT EXISTS motivo_observacion text,
  ADD COLUMN IF NOT EXISTS validado_en timestamptz,
  ADD COLUMN IF NOT EXISTS conforme_por uuid,
  ADD COLUMN IF NOT EXISTS conforme_en timestamptz;

CREATE INDEX IF NOT EXISTS idx_comprobantes_oc ON comprobantes_pago(orden_compra_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_recepcion ON comprobantes_pago(recepcion_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_proveedor ON comprobantes_pago(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado_flujo ON comprobantes_pago(estado_flujo);

-- Unicidad de factura por tenant: mismo emisor + serie + número no se duplica.
CREATE UNIQUE INDEX IF NOT EXISTS uq_comprobante_emisor_serie_num
  ON comprobantes_pago(tenant_id, ruc_emisor, serie, numero)
  WHERE ruc_emisor IS NOT NULL AND serie IS NOT NULL AND numero IS NOT NULL
    AND estado_flujo <> 'anulada';

-- 3. Vista de saldo de facturación por OC (base del control de parcial).
--    aceptado = facturas 'conforme'/'programada_pago'/'pagada'; en_tramite = 'recibida'/'validada'.
CREATE OR REPLACE VIEW v_oc_saldo_facturacion
WITH (security_invoker = true) AS
SELECT
  o.id AS orden_compra_id,
  o.tenant_id,
  o.numero AS orden_numero,
  o.proveedor_id,
  o.total AS total_oc,
  o.moneda,
  COALESCE(sum(c.total) FILTER (WHERE c.estado_flujo IN ('conforme','programada_pago','pagada')), 0) AS facturado_aceptado,
  COALESCE(sum(c.total) FILTER (WHERE c.estado_flujo IN ('recibida','validada')), 0) AS facturado_en_tramite,
  o.total
    - COALESCE(sum(c.total) FILTER (WHERE c.estado_flujo IN ('conforme','programada_pago','pagada')), 0)
    - COALESCE(sum(c.total) FILTER (WHERE c.estado_flujo IN ('recibida','validada')), 0) AS saldo_por_facturar,
  CASE
    WHEN COALESCE(sum(c.total) FILTER (WHERE c.estado_flujo IN ('conforme','programada_pago','pagada')), 0) >= o.total THEN 'facturada_completa'
    WHEN COALESCE(sum(c.total) FILTER (WHERE c.estado_flujo NOT IN ('anulada')), 0) > 0 THEN 'parcialmente_facturada'
    ELSE 'sin_facturar'
  END AS estado_facturacion
FROM ordenes_compra o
LEFT JOIN comprobantes_pago c ON c.orden_compra_id = o.id AND c.estado_flujo <> 'anulada'
WHERE o.estado NOT IN ('anulada','borrador')
GROUP BY o.id, o.tenant_id, o.numero, o.proveedor_id, o.total, o.moneda;
