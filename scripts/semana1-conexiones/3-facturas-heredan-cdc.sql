-- Semana 1 del plan de carga (2026-10-12) · Paso 3a: las facturas del SIRE heredan centro de costo y proyecto del pago histórico
-- que las cerró (el Excel de Contabilidad ya clasificó ese pago por CDC). Solo facturas sin CDC con al menos un pago enlazado; si el
-- pago tiene varios CDC se toma el más frecuente. El compromiso de la factura se actualiza por el trigger (ya propaga dimensión).
-- Con app.sin_asiento = '1' para que las facturas pagadas de 2024-2025 no generen asiento al cambiar de CDC.
-- Primero con ROLLBACK, luego COMMIT.
begin;
select set_config('app.sin_asiento', '1', true);
with cdc_pago as (
  select t.comprobante_id, t.centro_costo_id, t.proyecto_id, count(*) n,
         row_number() over (partition by t.comprobante_id order by count(*) desc, max(t.fecha) desc) rn
    from transacciones t
   where t.referencia_tipo = 'historico_contabilidad' and t.comprobante_id is not null and t.centro_costo_id is not null
   group by t.comprobante_id, t.centro_costo_id, t.proyecto_id
)
update comprobantes_pago c
   set centro_costo_id = cp.centro_costo_id,
       proyecto_id = coalesce(c.proyecto_id, cp.proyecto_id, (select proyecto_id from centros_costo where id = cp.centro_costo_id)),
       observaciones = concat_ws(' · ', nullif(c.observaciones, ''), 'CDC heredado del pago histórico')
  from cdc_pago cp
 where cp.rn = 1 and c.id = cp.comprobante_id and c.centro_costo_id is null;

-- compromisos de esas facturas: cdc/área/proyecto (por si el trigger no corrió para alguna)
update flujo_compromisos f
   set centro_costo_id = c.centro_costo_id, proyecto_id = coalesce(f.proyecto_id, c.proyecto_id), cdc = cc.codigo,
       area = case when c.proyecto_id is not null then 'PROYECTOS' else coalesce(cc.area, f.area) end
  from comprobantes_pago c join centros_costo cc on cc.id = c.centro_costo_id
 where f.comprobante_id = c.id and f.centro_costo_id is null;

select 'facturas_con_cdc' k, (select jsonb_build_object('total', count(*), 'con_cdc', count(centro_costo_id), 'con_proyecto', count(proyecto_id))::text from comprobantes_pago where direccion = 'recibido') v
union all select 'facturas_sire_con_cdc', (select jsonb_build_object('total', count(*), 'con_cdc', count(centro_costo_id), 'con_proyecto', count(proyecto_id))::text from comprobantes_pago where origen = 'sire')
union all select 'compromisos_erp_con_cdc', (select jsonb_build_object('total', count(*), 'con_cdc', count(centro_costo_id), 'con_proyecto', count(proyecto_id))::text from flujo_compromisos where fuente = 'erp')
union all select 'asientos_nuevos_hoy', (select count(*)::text from asientos_contables where creado_en > now() - interval '5 minutes');
rollback;
