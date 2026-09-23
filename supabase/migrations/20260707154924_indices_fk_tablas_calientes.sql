-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260707154924  name: indices_fk_tablas_calientes

-- ÍNDICES EN FKs DE TABLAS CALIENTES (Supabase best practice schema-foreign-key-indexes):
-- sin índice, cada join/lookup por FK y cada verificación de integridad escanea la tabla.
-- Se generan desde el catálogo SOLO para los FKs sin índice de los módulos en uso activo
-- (compras, finanzas, proyectos, flota, admin) — no se indexan módulos semilla/fríos.
DO $$
DECLARE
  r record;
  col_list text;
  idx_name text;
BEGIN
  FOR r IN
    SELECT con.conname,
           cl.relname AS tabla,
           (SELECT array_agg(att.attname ORDER BY u.ord)
              FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
              JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum
           ) AS cols
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
    WHERE con.contype = 'f'
      AND cl.relname IN (
        'ordenes_compra','orden_items','cotizaciones','cotizacion_items',
        'requerimientos_compra','requerimiento_items','recepciones','recepcion_items',
        'gastos_caja_chica','ingresos_caja_chica','cajas_chicas','transacciones',
        'presupuestos','presupuesto_lineas',
        'proyectos','fases_proyecto','tareas_proyecto','miembros_proyecto',
        'adendas_proyecto','gastos_fijos_proyecto','documentos_proyecto',
        'riesgos_proyecto','valorizaciones_proyecto','centros_costo',
        'ordenes_trabajo','ot_repuestos','ot_extras','vehiculos','vehiculo_documentos',
        'gps_dispositivos','proveedores','evaluaciones_proveedores','contratos_proveedores',
        'talleres','notificaciones','audit_logs','usuarios_roles','usuarios_tenant',
        'roles_permisos','movimientos_inventario','stock_almacen','articulos'
      )
      -- sin índice cuyo prefijo cubra las columnas del FK
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = con.conrelid
          AND (i.indkey::int2[])[0:array_length(con.conkey,1)-1] @> con.conkey
          AND con.conkey <@ (i.indkey::int2[])[0:array_length(con.conkey,1)-1]
      )
  LOOP
    col_list := array_to_string(r.cols, ', ');
    idx_name := left('idx_' || r.tabla || '_' || array_to_string(r.cols, '_'), 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', idx_name, r.tabla, col_list);
    RAISE NOTICE 'creado: % en %(%)', idx_name, r.tabla, col_list;
  END LOOP;
END $$;
SELECT count(*) AS indices_totales FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx\_%';
