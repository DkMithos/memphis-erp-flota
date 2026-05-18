-- ============================================================================
-- SEED: Centros de Costo iniciales para Memphis Maquinarias (tenant KESA)
-- Ejecutar después de verificar que la tabla centros_costo existe
-- ============================================================================

-- Usar el tenant_id de KESA (ajustar si cambia)
DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE nombre ILIKE '%kesa%' LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'Tenant KESA no encontrado. Omitiendo seed de centros_costo.';
    RETURN;
  END IF;

  INSERT INTO centros_costo (tenant_id, codigo, nombre, descripcion, activo)
  VALUES
    (v_tenant_id, 'ADM', 'Administración',         'Gastos administrativos generales',          true),
    (v_tenant_id, 'TI',  'Tecnología',              'Infraestructura y soporte TI',              true),
    (v_tenant_id, 'CON', 'Contabilidad',            'Área contable y tributaria',                true),
    (v_tenant_id, 'OPE', 'Operaciones',             'Operaciones y logística de campo',          true),
    (v_tenant_id, 'COM', 'Comercial',               'Ventas y licitaciones',                     true),
    (v_tenant_id, 'CMP', 'Compras',                 'Adquisiciones y abastecimiento',            true),
    (v_tenant_id, 'TES', 'Tesorería',               'Gestión de caja y bancos',                  true),
    (v_tenant_id, 'FLO', 'Flota',                   'Mantenimiento y operación de vehículos',    true),
    (v_tenant_id, 'BIO', 'Biomédico',               'Equipos biomédicos y mantenimiento',        true),
    (v_tenant_id, 'MAN', 'Mantenimiento General',   'Mantenimiento de instalaciones y equipos',  true)
  ON CONFLICT (tenant_id, codigo) DO NOTHING;

END $$;
