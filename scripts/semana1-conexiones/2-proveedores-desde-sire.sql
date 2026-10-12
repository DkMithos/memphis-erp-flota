-- Semana 1 del plan de carga (2026-10-12) · Paso 2: ficha mínima de proveedor para cada RUC del SIRE que no está en el directorio.
-- Razón social = la más reciente que trae el SIRE para ese RUC. RUC 10… = persona natural. Nada de cuentas bancarias ni condición
-- tributaria: quedan "por completar" (observaciones) y el lote de pago avisa "sin cuenta". Se enlazan las facturas, sus compromisos
-- y las constancias de detracción del mismo RUC. Primero con ROLLBACK, luego COMMIT.
begin;
create temp table _nuevos as
select ruc_emisor as ruc,
       (array_agg(razon_social_emisor order by fecha_emision desc nulls last))[1] as razon_social,
       count(*) as facturas, max(fecha_emision) as ultima, coalesce(bool_or(tiene_detraccion), false) as con_detraccion
  from comprobantes_pago
 where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and origen = 'sire' and proveedor_id is null and ruc_emisor is not null
   and not exists (select 1 from proveedores p where p.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and p.ruc = comprobantes_pago.ruc_emisor)
 group by ruc_emisor;

-- correlativo PROV-NNNN a continuación del último numérico
with base as (select coalesce(max((regexp_match(codigo, '^PROV-(\d+)$'))[1]::int), 0) as n from proveedores where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'),
     num as (select n.*, row_number() over (order by n.facturas desc, n.ruc) as rn from _nuevos n)
insert into proveedores (tenant_id, codigo, razon_social, nombre_comercial, ruc, tipo, categoria, estado, condicion, pais, domiciliado, regimen_igv,
                         sujeto_detraccion, migrado_de, migrado_id, observaciones, creado_en)
select 'e4b16a80-8500-418e-afaa-0e976b7d9b13', 'PROV-' || lpad((base.n + num.rn)::text, 4, '0'), coalesce(nullif(trim(num.razon_social), ''), 'RUC ' || num.ruc), null, num.ruc,
       case when num.ruc like '10%' then 'persona_natural' else 'servicios' end, 'general', 'activo', 'sin_evaluar', 'Perú', true, 'gravado',
       num.con_detraccion, 'sire', num.ruc,
       'Creado el 12/10/2026 desde el SIRE de compras (' || num.facturas || ' facturas, última ' || coalesce(num.ultima::text, '?') || '). Completar cuenta bancaria, tipo y condición tributaria antes de pagarle por lote.',
       now()
  from num cross join base
on conflict (tenant_id, ruc) do nothing;

-- enlazar facturas, compromisos y detracciones por RUC
select set_config('app.sin_asiento', '1', true);
update comprobantes_pago c set proveedor_id = p.id
  from proveedores p where p.tenant_id = c.tenant_id and p.ruc = c.ruc_emisor and c.proveedor_id is null and c.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
update flujo_compromisos f set proveedor_id = c.proveedor_id
  from comprobantes_pago c where f.comprobante_id = c.id and f.proveedor_id is null and c.proveedor_id is not null;
update detracciones d set proveedor_id = p.id
  from proveedores p where p.tenant_id = d.tenant_id and p.ruc = d.ruc_proveedor and d.proveedor_id is null;

select 'proveedores_creados' k, (select count(*) from proveedores where migrado_de = 'sire')::text v
union all select 'proveedores_total', (select count(*) from proveedores where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13')::text
union all select 'facturas_sin_proveedor', (select count(*) from comprobantes_pago where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and direccion = 'recibido' and proveedor_id is null)::text
union all select 'compromisos_sin_proveedor', (select count(*) from flujo_compromisos where fuente = 'erp' and comprobante_id is not null and proveedor_id is null)::text
union all select 'detracciones_sin_proveedor', (select count(*) from detracciones where proveedor_id is null)::text
union all select 'muestra', (select jsonb_agg(jsonb_build_object('codigo', codigo, 'ruc', ruc, 'rs', left(razon_social, 40), 'tipo', tipo)) from (select codigo, ruc, razon_social, tipo from proveedores where migrado_de = 'sire' order by codigo limit 5) x)::text;
rollback;
