-- Semana 2 del plan de carga (2026-10-12) · Paso 4: las facturas emitidas apuntan a su cliente y, cuando no hay duda, a su proyecto.
-- 1) Un cliente del CRM por cada RUC receptor del SIRE de ventas que no exista (la tabla `clientes` estaba vacía). Código CLI-NNNN,
--    tipo `gobierno` si la razón social es una entidad pública, `persona_natural` si el RUC empieza en 10, `empresa` en el resto.
-- 2) comprobantes_pago.cliente_id por RUC; proyectos.cliente_id para las entidades con proyecto.
-- 3) proyecto_id de la factura: (a) clientes con un solo proyecto (Surco → MSS-30, Independencia → MDI, OXI → C-OXI, Inmuebles
--    Panamericana → INMPAN, GORE Huánuco → 03HNCPNP25, GORE Amazonas → 05AMAPNP25); (b) GORE Cusco (tres proyectos): solo si el
--    total de la factura cuadra (±8 %) con una valorización o con un CIPRL del flujo de uno de ellos. Las facturas a las empresas
--    financistas de OXI (E.I.G.R., Amazonas Corporation, Alihcom, Fondo Investa…) quedan sin proyecto: Operaciones/Contabilidad
--    deben decir qué proyecto financia cada una.
-- Todo con app.sin_asiento = '1': cambiar cliente/proyecto no debe generar asientos (2025 es ejercicio cerrado; 2026 ya los tiene).
-- Primero con ROLLBACK, luego COMMIT.
begin;
select set_config('app.sin_asiento', '1', true);

-- 1) clientes nuevos
with base as (select coalesce(max((regexp_match(codigo, '^CLI-(\d+)$'))[1]::int), 0) as n from clientes where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'),
     rucs as (
       select ruc_receptor as ruc, (array_agg(razon_social_receptor order by fecha_emision desc nulls last))[1] as rs, count(*) n, max(fecha_emision) ultima
         from comprobantes_pago
        where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and direccion = 'emitido' and ruc_receptor is not null
          and not exists (select 1 from clientes c where c.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and c.ruc = comprobantes_pago.ruc_receptor)
        group by ruc_receptor),
     num as (select r.*, row_number() over (order by r.n desc, r.ruc) rn from rucs r)
insert into clientes (tenant_id, codigo, razon_social, ruc, tipo, sector, estado, moneda, origen, observaciones, creado_por)
select 'e4b16a80-8500-418e-afaa-0e976b7d9b13', 'CLI-' || lpad((base.n + num.rn)::text, 4, '0'), coalesce(nullif(trim(num.rs), ''), 'RUC ' || num.ruc), num.ruc,
       case when num.ruc like '10%' then 'persona_natural'
            when num.rs ~* 'GOBIERNO|MUNICIPALIDAD|REGIONAL|MINISTERIO|POLIC|MARINA DE GUERRA|EJERCITO|FUERZA' then 'gobierno' else 'empresa' end,
       case when num.rs ~* 'GOBIERNO|MUNICIPALIDAD|REGIONAL|MINISTERIO|POLIC|MARINA DE GUERRA|EJERCITO|FUERZA' then 'Sector público' else 'Privado' end,
       'activo', 'PEN', 'sire',
       'Creado el 12/10/2026 desde el SIRE de ventas (' || num.n || ' comprobantes, último ' || num.ultima || '). Completar contacto y condiciones.',
       'semana2-ingresos'
  from num cross join base;

-- 2) enlaces por RUC
update comprobantes_pago c set cliente_id = cl.id
  from clientes cl where cl.tenant_id = c.tenant_id and cl.ruc = c.ruc_receptor and c.direccion = 'emitido' and c.cliente_id is null;
update proyectos p set cliente_id = cl.id
  from (values ('02CUSAMB25', '20527147612'), ('06CUSPNP25', '20527147612'), ('07CUSHAM26', '20527147612'), ('03HNCPNP25', '20489250731'),
               ('05AMAPNP25', '20479569861'), ('MSS-30', '20131367423'), ('MDI', '20131373661'), ('C-OXI', '20608046659'), ('INMPAN', '20423264617')) m(codigo, ruc)
  join clientes cl on cl.ruc = m.ruc and cl.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
 where p.codigo = m.codigo and p.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and p.cliente_id is null;

-- 3a) clientes con un solo proyecto
update comprobantes_pago c set proyecto_id = p.id
  from (values ('20131367423', 'MSS-30'), ('20131373661', 'MDI'), ('20608046659', 'C-OXI'), ('20423264617', 'INMPAN'), ('20489250731', '03HNCPNP25'), ('20479569861', '05AMAPNP25')) m(ruc, codigo)
  join proyectos p on p.codigo = m.codigo and p.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
 where c.direccion = 'emitido' and c.proyecto_id is null and c.ruc_receptor = m.ruc and c.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';

-- 3b) GORE Cusco: por monto (valorización o CIPRL del flujo, ±8 %)
with cand as (
  select v.proyecto_id, v.monto from valorizaciones v join proyectos p on p.id = v.proyecto_id where p.codigo in ('02CUSAMB25', '06CUSPNP25', '07CUSHAM26')
  union all
  select f.proyecto_id, coalesce(f.monto_presupuestado, f.monto_ejecutado) from flujo_compromisos f join proyectos p on p.id = f.proyecto_id
   where f.sentido = 'cobrar' and f.fuente = 'excel' and p.codigo in ('02CUSAMB25', '06CUSPNP25', '07CUSHAM26')
), match as (
  select c.id, (array_agg(distinct cand.proyecto_id))[1] as proyecto_id, count(distinct cand.proyecto_id) n
    from comprobantes_pago c join cand on abs(cand.monto - c.total) <= c.total * 0.08
   where c.direccion = 'emitido' and c.ruc_receptor = '20527147612' and c.proyecto_id is null and c.moneda = 'PEN' and c.tipo = '01'
   group by c.id
)
update comprobantes_pago c set proyecto_id = m.proyecto_id, observaciones = concat_ws(' · ', nullif(c.observaciones, ''), 'Proyecto asignado por monto (valorización/CIPRL ±8 %)')
  from match m where m.id = c.id and m.n = 1;

-- contadores
select 'clientes' k, (select jsonb_build_object('total', count(*), 'sire', count(*) filter (where origen = 'sire'), 'gobierno', count(*) filter (where tipo = 'gobierno'))::text from clientes) v
union all select 'emitidos', (select jsonb_build_object('total', count(*), 'con_cliente', count(cliente_id), 'con_proyecto', count(proyecto_id), 'facturas_vivas_2026', count(*) filter (where tipo = '01' and estado_flujo = 'emitida'))::text from comprobantes_pago where direccion = 'emitido')
union all select 'proyectos_con_cliente', (select count(*)::text from proyectos where cliente_id is not null)
union all select 'ventas_por_proyecto', (select jsonb_agg(x)::text from (select p.codigo, count(*) docs, round(sum(case when c.tipo = '07' then -1 else 1 end * c.total * case when c.moneda = 'USD' then coalesce(nullif(c.tipo_cambio, 1), tc_vigente(c.fecha_emision)) else 1 end)) neto_soles from comprobantes_pago c join proyectos p on p.id = c.proyecto_id where c.direccion = 'emitido' group by 1 order by 1) x)
union all select 'sin_proyecto_por_cliente', (select jsonb_agg(x)::text from (select left(razon_social_receptor, 30) cliente, count(*) docs, round(sum(case when tipo = '07' then -1 else 1 end * total)) neto from comprobantes_pago where direccion = 'emitido' and proyecto_id is null group by 1 order by 3 desc limit 8) x);
rollback;
