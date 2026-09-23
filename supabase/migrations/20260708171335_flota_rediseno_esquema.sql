-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260708171335  name: flota_rediseno_esquema

-- REDISEÑO FLOTA (docs/FLOTA-REQUISITOS.md): flotas por proyecto, contratos de
-- mantenimiento con tarifario por km, servicios ejecutados, seguimiento admin.
-- Aditivo: no toca vehiculos/ordenes_trabajo existentes (backup flota-2026-07-08).

-- 1. Flotas (grupo de vehículos de un proyecto)
CREATE TABLE IF NOT EXISTS flotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  proyecto_id uuid NOT NULL REFERENCES proyectos(id),
  codigo text NOT NULL,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'otro', -- camioneta|moto|bus|ambulancia|otro
  descripcion text,
  estado text NOT NULL DEFAULT 'activa', -- activa|cerrada
  creado_por uuid,
  creado_en timestamptz NOT NULL DEFAULT now(),
  modificado_en timestamptz,
  UNIQUE (tenant_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_flotas_tenant ON flotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flotas_proyecto ON flotas(proyecto_id);

-- 2. Contratos de mantenimiento por flota
CREATE TABLE IF NOT EXISTS flota_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  flota_id uuid NOT NULL REFERENCES flotas(id) ON DELETE CASCADE,
  proveedor_id uuid REFERENCES proveedores(id),
  proveedor_nombre text, -- texto libre si no está en directorio
  nombre text NOT NULL,
  moneda text NOT NULL DEFAULT 'PEN', -- PEN|USD
  tipo_cambio numeric, -- para provisión en PEN cuando moneda=USD
  duracion_meses integer,
  km_limite integer, -- cobertura por km (lo que ocurra primero con duracion)
  cantidad_servicios integer, -- total contratado por vehículo
  costo_total_por_vehiculo numeric, -- provisión por vehículo (suma tarifario)
  modalidad_pago text NOT NULL DEFAULT 'mensual', -- adelantado|mensual
  monto_pagado numeric, -- pagado real a la firma (modalidad adelantado)
  fecha_inicio date,
  fecha_fin date,
  estado text NOT NULL DEFAULT 'activo', -- activo|cerrado
  notas text,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flota_contratos_tenant ON flota_contratos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flota_contratos_flota ON flota_contratos(flota_id);
CREATE INDEX IF NOT EXISTS idx_flota_contratos_proveedor ON flota_contratos(proveedor_id);

-- 3. Tarifario del contrato: precio por servicio según km
CREATE TABLE IF NOT EXISTS flota_contrato_tarifas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  contrato_id uuid NOT NULL REFERENCES flota_contratos(id) ON DELETE CASCADE,
  orden integer NOT NULL, -- 1..N
  km_servicio integer NOT NULL, -- 500, 2500... / 5000, 10000...
  mes_estimado integer, -- nro de mes del plan (provisión por tiempo)
  costo numeric NOT NULL, -- con IGV, en moneda del contrato
  descripcion text,
  UNIQUE (contrato_id, km_servicio)
);
CREATE INDEX IF NOT EXISTS idx_fct_tenant ON flota_contrato_tarifas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fct_contrato ON flota_contrato_tarifas(contrato_id);

-- 4. Vehículos: enlaces al nuevo modelo (aditivo)
ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS flota_id uuid REFERENCES flotas(id),
  ADD COLUMN IF NOT EXISTS placa_interna text,
  ADD COLUMN IF NOT EXISTS es_administrativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_soat boolean,
  ADD COLUMN IF NOT EXISTS soat_vigencia text,
  ADD COLUMN IF NOT EXISTS tiene_seguro boolean,
  ADD COLUMN IF NOT EXISTS seguro_vigencia text;
CREATE INDEX IF NOT EXISTS idx_vehiculos_flota ON vehiculos(flota_id);

-- 5. Mantenimientos (reemplaza OTs para flota; carga masiva)
CREATE TABLE IF NOT EXISTS vehiculo_mantenimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  vehiculo_id uuid NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES flota_contratos(id),
  km_servicio integer, -- rutina del plan (5000, 10000…)
  km_odometro numeric, -- lectura real al ejecutar
  fecha_programada date,
  fecha_ejecucion date,
  estado text NOT NULL DEFAULT 'programado', -- programado|ejecutado|no_ejecutado|reprogramado
  taller text,
  costo numeric,
  moneda text DEFAULT 'PEN',
  oc_numero text, -- MM-NNNNNN (enlace suave a ordenes_compra)
  factura text,
  conformidad text,
  observaciones text,
  origen text NOT NULL DEFAULT 'manual', -- manual|masivo|migrado-excel
  creado_por uuid,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vm_tenant ON vehiculo_mantenimientos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vm_vehiculo ON vehiculo_mantenimientos(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_vm_contrato ON vehiculo_mantenimientos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_vm_fecha ON vehiculo_mantenimientos(fecha_ejecucion);

-- 6. Seguimiento documentario SOLO vehículos administrativos
CREATE TABLE IF NOT EXISTS vehiculo_admin_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  vehiculo_id uuid NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- soat|seguro|tive|revision_tecnica|multa|papeleta|otro
  descripcion text,
  fecha_emision date,
  fecha_vencimiento date,
  monto numeric,
  estado text NOT NULL DEFAULT 'vigente', -- vigente|por_vencer|vencido|pagado|pendiente
  alerta_dias integer NOT NULL DEFAULT 30,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vae_tenant ON vehiculo_admin_eventos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vae_vehiculo ON vehiculo_admin_eventos(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_vae_vencimiento ON vehiculo_admin_eventos(fecha_vencimiento);

-- 7. Lecturas de odómetro (promedio km/día → proyección próximo servicio)
CREATE TABLE IF NOT EXISTS vehiculo_km_lecturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  vehiculo_id uuid NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  km numeric NOT NULL,
  fuente text NOT NULL DEFAULT 'manual', -- manual|mantenimiento|masivo
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehiculo_id, fecha, fuente)
);
CREATE INDEX IF NOT EXISTS idx_vkl_tenant ON vehiculo_km_lecturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vkl_vehiculo ON vehiculo_km_lecturas(vehiculo_id, fecha DESC);

-- 8. RLS multi-tenant (patrón initplan del proyecto)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['flotas','flota_contratos','flota_contrato_tarifas',
    'vehiculo_mantenimientos','vehiculo_admin_eventos','vehiculo_km_lecturas'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%s ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%s ON %I FOR ALL TO authenticated USING (tenant_id = ( SELECT auth_tenant_id() )) WITH CHECK (tenant_id = ( SELECT auth_tenant_id() ))',
      t, t);
  END LOOP;
END $$;

-- 9. Vista: consumo del presupuesto por vehículo (precio y cantidad)
CREATE OR REPLACE VIEW v_vehiculo_consumo
WITH (security_invoker = true) AS
SELECT
  v.id AS vehiculo_id,
  v.tenant_id,
  v.flota_id,
  f.proyecto_id,
  c.id AS contrato_id,
  c.moneda,
  c.cantidad_servicios AS servicios_contratados,
  c.costo_total_por_vehiculo AS provision_total,
  count(m.id) FILTER (WHERE m.estado = 'ejecutado') AS servicios_ejecutados,
  COALESCE(sum(m.costo) FILTER (WHERE m.estado = 'ejecutado'), 0) AS gastado,
  c.costo_total_por_vehiculo
    - COALESCE(sum(m.costo) FILTER (WHERE m.estado = 'ejecutado'), 0) AS saldo_provision
FROM vehiculos v
JOIN flotas f ON f.id = v.flota_id
LEFT JOIN flota_contratos c ON c.flota_id = f.id AND c.estado = 'activo'
LEFT JOIN vehiculo_mantenimientos m ON m.vehiculo_id = v.id
  AND (m.contrato_id = c.id OR m.contrato_id IS NULL)
GROUP BY v.id, v.tenant_id, v.flota_id, f.proyecto_id, c.id, c.moneda,
  c.cantidad_servicios, c.costo_total_por_vehiculo;
