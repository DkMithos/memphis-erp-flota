-- Semana 3 del plan de carga (2026-10-13) · Paso 1 (#8): los acreedores de las obligaciones financieras apuntan a su ficha de proveedor.
-- Enlaces ciertos (misma razón social en el directorio creado desde el SIRE): Cesce → PROV-0343, Corporación OXI → PROV-0372,
-- Imagen Pública → PROV-0354, Impacto Táctico → PROV-0432. SUNAT (6 fraccionamientos/deudas) se crea como proveedor con su RUC
-- institucional 20131312955. Quedan SIN proveedor, porque no hay RUC/DNI en el Libro de obligaciones y no se inventa: Sandra Wiese,
-- Miguel Zegarra, Susan Hoefken (préstamos de personas), Secrex y HFM Smart Solutions (Contabilidad debe dar el RUC).
-- Primero con ROLLBACK, luego COMMIT.
begin;
insert into proveedores (tenant_id, codigo, razon_social, ruc, tipo, categoria, estado, condicion, pais, domiciliado, regimen_igv, sujeto_detraccion, observaciones, creado_en)
select 'e4b16a80-8500-418e-afaa-0e976b7d9b13',
       'PROV-' || lpad((coalesce(max((regexp_match(codigo, '^PROV-(\d+)$'))[1]::int), 0) + 1)::text, 4, '0'),
       'SUNAT - Superintendencia Nacional de Aduanas y de Administración Tributaria', '20131312955', 'servicios', 'general', 'activo', 'sin_evaluar', 'Perú', true, 'inafecto', false,
       'Creado el 13/10/2026 como acreedor de los fraccionamientos y deudas tributarias (Obligaciones financieras).', now()
  from proveedores where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
on conflict (tenant_id, ruc) do nothing;

update obligaciones_financieras o set proveedor_id = p.id
  from (values ('Cesce', 'PROV-0343'), ('Corporación OXI', 'PROV-0372'), ('Imagen Pública Consultores Asociados SAC', 'PROV-0354'), ('Impacto Táctico', 'PROV-0432')) m(acreedor, codigo)
  join proveedores p on p.codigo = m.codigo and p.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
 where o.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and o.acreedor = m.acreedor and o.proveedor_id is null;
update obligaciones_financieras o set proveedor_id = p.id
  from proveedores p
 where p.tenant_id = o.tenant_id and p.ruc = '20131312955' and o.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and o.acreedor = 'SUNAT' and o.proveedor_id is null;

-- las cuotas-compromiso heredan el proveedor
update flujo_compromisos f set proveedor_id = o.proveedor_id
  from obligaciones_cuotas q join obligaciones_financieras o on o.id = q.obligacion_id
 where f.obligacion_cuota_id = q.id and f.proveedor_id is null and o.proveedor_id is not null;

select 'obligaciones' k, (select jsonb_agg(x)::text from (select acreedor, proveedor_id is not null con_proveedor, count(*) n from obligaciones_financieras where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' group by 1, 2 order by 2, 1) x) v
union all select 'cuotas_con_proveedor', (select jsonb_build_object('total', count(*), 'con_proveedor', count(proveedor_id))::text from flujo_compromisos where obligacion_cuota_id is not null)
union all select 'sunat_prov', (select codigo from proveedores where ruc = '20131312955' and tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13');
rollback;
