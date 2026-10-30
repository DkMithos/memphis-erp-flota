-- 2026-10-29 · Dirección: el ERP para socios y Gerencia.
--
-- Kevin: "los socios y Gerencia no tendrían por qué tener acceso a los módulos; deberían ver solo dashboards, descargar los
-- reportes que quieran, todo visual, y si quieren trabajar data la descargan; el ERP debe darles todo el análisis para la
-- toma de decisiones". Y antes: "cuánto se debe, cuánto deberemos, cuánto pagaremos, cuánto hemos pagado en el rango de
-- fechas que ellos elijan; indicadores y OKRs".
--
-- 1) Módulo `direccion` con permisos ver / exportar / editar (editar = definir OKRs).
-- 2) `roles.solo_direccion`: el rol vive solo en Dirección (el menú y las rutas de los módulos se le cierran; conserva lo que
--    firma: el detalle de la OC y del viaje que le toca aprobar). Gerencia queda así.
-- 3) `direccion_resumen(desde, hasta, corte)`: deuda al corte, por pagar/cobrar en el rango, pagado/cobrado en el rango,
--    compras y facturas del rango, bancos y cajas al corte, serie mensual, top proyectos y proveedores. Security definer:
--    las tablas de Finanzas tienen RLS por permiso y Gerencia no tiene Finanzas.
-- 4) `direccion_detalle(tipo, desde, hasta, corte)`: las filas detrás de cada cifra, para descargar y analizar.
-- 5) `direccion_por_firmar()`: lo que le toca firmar a quien mira (OC por etapa en turno, viajes y rendiciones).
-- 6) OKRs: `okr_objetivos` + `okr_resultados`; algunos resultados se alimentan solos del ERP (`fuente`).

-- 1. Permisos ---------------------------------------------------------------------------------------------------------
insert into permisos (modulo, accion, descripcion)
select v.modulo, v.accion, v.descripcion from (values
  ('direccion', 'ver', 'Tablero de Dirección: indicadores, deuda, pagos, cobros y OKRs por fechas'),
  ('direccion', 'exportar', 'Descargar los reportes del tablero de Dirección'),
  ('direccion', 'editar', 'Definir y actualizar objetivos y resultados clave (OKRs)')
) as v(modulo, accion, descripcion)
where not exists (select 1 from permisos p where p.modulo = v.modulo and p.accion = v.accion);

-- Administrador: todo (regla de Kevin). Gerencia: ver y exportar.
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r join permisos p on p.modulo = 'direccion'
 where r.nombre = 'Administrador'
   and not exists (select 1 from roles_permisos rp where rp.rol_id = r.id and rp.permiso_id = p.id);
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r join permisos p on p.modulo = 'direccion' and p.accion in ('ver', 'exportar')
 where r.nombre = 'Gerencia'
   and not exists (select 1 from roles_permisos rp where rp.rol_id = r.id and rp.permiso_id = p.id);

-- 2. Rol solo-Dirección ----------------------------------------------------------------------------------------------
alter table public.roles add column if not exists solo_direccion boolean not null default false;
comment on column public.roles.solo_direccion is
  'El rol solo usa el tablero de Dirección: el menú y las rutas de los módulos se le cierran; conserva el detalle de lo que firma.';
update roles set solo_direccion = true where nombre = 'Gerencia';

-- 3. Resumen para Dirección ------------------------------------------------------------------------------------------
create or replace function public.direccion_puede_ver() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_tiene_permiso('direccion', 'ver') or auth_tiene_permiso('finanzas', 'ver') or auth_tiene_permiso('admin', 'ver');
$$;

create or replace function public.direccion_resumen(p_desde date, p_hasta date, p_corte date default current_date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t uuid := auth_tenant_id(); r jsonb;
begin
  if not direccion_puede_ver() then raise exception 'Sin permiso para el tablero de Dirección'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'Rango de fechas inválido'; end if;
  if p_hasta - p_desde > 1100 then raise exception 'El rango no puede superar 3 años'; end if;

  with
  -- Deuda REGISTRADA = facturas, órdenes aprobadas y obligaciones del ERP (origen real/comprometido). Lo "proyectado" del
  -- Excel de flujo (proveedor "Estimado", fechas sin sentido) se informa aparte: es previsión, no deuda.
  cxp_todo as (
    select f.*, coalesce(f.fecha_vencimiento, f.mes_vencimiento) as vence,
           greatest(coalesce(f.monto_presupuestado, f.monto_ejecutado, 0) - coalesce(f.monto_pagado, 0), 0) as pendiente,
           coalesce(f.monto_presupuestado, f.monto_ejecutado, 0) as monto
      from flujo_compromisos f where f.tenant_id = t and f.sentido = 'pagar'
  ),
  cxp as (select * from cxp_todo where coalesce(origen, 'real') <> 'proyectado'),
  proyectado as (
    select jsonb_build_object(
      'pen', coalesce(sum(pendiente) filter (where moneda = 'PEN' and upper(coalesce(estado_pago, '')) not like 'PAGADO%'), 0),
      'usd', coalesce(sum(pendiente) filter (where moneda = 'USD' and upper(coalesce(estado_pago, '')) not like 'PAGADO%'), 0),
      'compromisos', count(*) filter (where upper(coalesce(estado_pago, '')) not like 'PAGADO%'),
      'rango_pen', coalesce(sum(pendiente) filter (where moneda = 'PEN' and upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence between p_desde and p_hasta), 0),
      'rango_usd', coalesce(sum(pendiente) filter (where moneda = 'USD' and upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence between p_desde and p_hasta), 0)
    ) as j from cxp_todo where coalesce(origen, 'real') = 'proyectado'
  ),
  cxc as (
    select f.*, coalesce(f.fecha_vencimiento, f.mes_vencimiento) as vence,
           greatest(coalesce(f.monto_presupuestado, f.monto_ejecutado, 0) - coalesce(f.monto_pagado, 0), 0) as pendiente
      from flujo_compromisos f where f.tenant_id = t and f.sentido = 'cobrar'
  ),
  pagos as (
    select x.*, coalesce(x.fecha_pago, x.fecha) as dia from transacciones x where x.tenant_id = t and x.estado = 'pagada'
  ),
  por_moneda_deuda as (
    select jsonb_build_object(
      'hoy', jsonb_build_object(
        'pen', coalesce(sum(pendiente) filter (where moneda = 'PEN' and upper(coalesce(estado_pago, '')) not like 'PAGADO%'), 0),
        'usd', coalesce(sum(pendiente) filter (where moneda = 'USD' and upper(coalesce(estado_pago, '')) not like 'PAGADO%'), 0),
        'compromisos', count(*) filter (where upper(coalesce(estado_pago, '')) not like 'PAGADO%')),
      'vencida_hoy', jsonb_build_object(
        'pen', coalesce(sum(pendiente) filter (where moneda = 'PEN' and upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence < current_date), 0),
        'usd', coalesce(sum(pendiente) filter (where moneda = 'USD' and upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence < current_date), 0),
        'compromisos', count(*) filter (where upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence < current_date)),
      -- Deuda a una fecha pasada: lo que vencía hasta esa fecha y a esa fecha no estaba pagado (pagos posteriores se devuelven).
      'al_corte', jsonb_build_object(
        'pen', coalesce(sum(case when fecha_pagado is not null and fecha_pagado > p_corte then monto else pendiente end)
                 filter (where moneda = 'PEN' and vence <= p_corte and (upper(coalesce(estado_pago, '')) not like 'PAGADO%' or fecha_pagado > p_corte)), 0),
        'usd', coalesce(sum(case when fecha_pagado is not null and fecha_pagado > p_corte then monto else pendiente end)
                 filter (where moneda = 'USD' and vence <= p_corte and (upper(coalesce(estado_pago, '')) not like 'PAGADO%' or fecha_pagado > p_corte)), 0),
        'compromisos', count(*) filter (where vence <= p_corte and (upper(coalesce(estado_pago, '')) not like 'PAGADO%' or fecha_pagado > p_corte))),
      'por_pagar_rango', jsonb_build_object(
        'pen', coalesce(sum(pendiente) filter (where moneda = 'PEN' and upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence between p_desde and p_hasta), 0),
        'usd', coalesce(sum(pendiente) filter (where moneda = 'USD' and upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence between p_desde and p_hasta), 0),
        'compromisos', count(*) filter (where upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence between p_desde and p_hasta),
        'sin_fecha_pen', coalesce(sum(pendiente) filter (where moneda = 'PEN' and upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence is null), 0),
        'sin_fecha_usd', coalesce(sum(pendiente) filter (where moneda = 'USD' and upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence is null), 0))
    ) as j from cxp
  ),
  cobrar as (
    select jsonb_build_object(
      'por_cobrar_rango', jsonb_build_object(
        'pen', coalesce(sum(pendiente) filter (where moneda = 'PEN' and upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence between p_desde and p_hasta), 0),
        'usd', coalesce(sum(pendiente) filter (where moneda = 'USD' and upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence between p_desde and p_hasta), 0),
        'compromisos', count(*) filter (where upper(coalesce(estado_pago, '')) not like 'PAGADO%' and vence between p_desde and p_hasta)),
      'por_cobrar_total', jsonb_build_object(
        'pen', coalesce(sum(pendiente) filter (where moneda = 'PEN' and upper(coalesce(estado_pago, '')) not like 'PAGADO%'), 0),
        'usd', coalesce(sum(pendiente) filter (where moneda = 'USD' and upper(coalesce(estado_pago, '')) not like 'PAGADO%'), 0))
    ) as j from cxc
  ),
  tesoreria as (
    select jsonb_build_object(
      'pagado_rango', jsonb_build_object(
        'pen', coalesce(sum(monto) filter (where tipo = 'egreso' and moneda = 'PEN' and dia between p_desde and p_hasta), 0),
        'usd', coalesce(sum(monto) filter (where tipo = 'egreso' and moneda = 'USD' and dia between p_desde and p_hasta), 0),
        'soles_equiv', coalesce(sum(coalesce(monto_soles, case when moneda = 'USD' then monto * coalesce(tipo_cambio, 1) else monto end)) filter (where tipo = 'egreso' and dia between p_desde and p_hasta), 0),
        'pagos', count(*) filter (where tipo = 'egreso' and dia between p_desde and p_hasta)),
      'cobrado_rango', jsonb_build_object(
        'pen', coalesce(sum(monto) filter (where tipo = 'ingreso' and moneda = 'PEN' and dia between p_desde and p_hasta), 0),
        'usd', coalesce(sum(monto) filter (where tipo = 'ingreso' and moneda = 'USD' and dia between p_desde and p_hasta), 0),
        'cobros', count(*) filter (where tipo = 'ingreso' and dia between p_desde and p_hasta))
    ) as j from pagos
  ),
  compras as (
    select jsonb_build_object(
      'ordenes_rango', jsonb_build_object(
        'cantidad', count(*), 'pen', coalesce(sum(total) filter (where moneda = 'PEN'), 0), 'usd', coalesce(sum(total) filter (where moneda = 'USD'), 0))
    ) as j from ordenes_compra o
     where o.tenant_id = t and o.fecha_emision between p_desde and p_hasta and o.estado not in ('borrador', 'anulada', 'rechazada')
  ),
  facturas as (
    select jsonb_build_object(
      'facturas_rango', jsonb_build_object(
        'cantidad', count(*), 'pen', coalesce(sum(total) filter (where moneda = 'PEN'), 0), 'usd', coalesce(sum(total) filter (where moneda = 'USD'), 0),
        'por_conformar', count(*) filter (where coalesce(estado_flujo, 'recibida') in ('recibida', 'validada')))
    ) as j from comprobantes_pago c
     where c.tenant_id = t and c.direccion = 'recibido' and c.fecha_emision between p_desde and p_hasta
  ),
  bancos as (
    select coalesce(jsonb_agg(jsonb_build_object('cuenta', cb.nombre, 'moneda', cb.moneda,
             'saldo_corte', cb.saldo_inicial + coalesce((select sum(m.importe) from movimientos_bancarios m
                 where m.cuenta_bancaria_id = cb.id and m.fecha_operacion >= coalesce(cb.saldo_inicial_fecha, '2000-01-01') and m.fecha_operacion <= p_corte), 0),
             'extracto_hasta', (select max(m.fecha_operacion) from movimientos_bancarios m where m.cuenta_bancaria_id = cb.id),
             'saldo_inicial_fijado', cb.saldo_inicial is not null and cb.saldo_inicial <> 0)
           order by cb.orden), '[]'::jsonb) as j
      from cuentas_bancarias cb where cb.tenant_id = t and cb.activa
  ),
  cajas as (
    select coalesce(jsonb_agg(jsonb_build_object('caja', nombre, 'moneda', moneda, 'disponible', monto_disponible) order by nombre), '[]'::jsonb) as j
      from cajas_chicas where tenant_id = t and estado = 'activo'
  ),
  meses as (
    select to_char(d, 'YYYY-MM') as mes, d::date as ini, (d + interval '1 month' - interval '1 day')::date as fin
      from generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), interval '1 month') d
  ),
  serie as (
    select coalesce(jsonb_agg(jsonb_build_object('mes', m.mes,
      'pagado_pen', (select coalesce(sum(monto), 0) from pagos p where p.tipo = 'egreso' and p.moneda = 'PEN' and p.dia between greatest(m.ini, p_desde) and least(m.fin, p_hasta)),
      'pagado_usd', (select coalesce(sum(monto), 0) from pagos p where p.tipo = 'egreso' and p.moneda = 'USD' and p.dia between greatest(m.ini, p_desde) and least(m.fin, p_hasta)),
      'cobrado_pen', (select coalesce(sum(monto), 0) from pagos p where p.tipo = 'ingreso' and p.moneda = 'PEN' and p.dia between greatest(m.ini, p_desde) and least(m.fin, p_hasta)),
      'cobrado_usd', (select coalesce(sum(monto), 0) from pagos p where p.tipo = 'ingreso' and p.moneda = 'USD' and p.dia between greatest(m.ini, p_desde) and least(m.fin, p_hasta)),
      'por_pagar_pen', (select coalesce(sum(pendiente), 0) from cxp c where c.moneda = 'PEN' and upper(coalesce(c.estado_pago, '')) not like 'PAGADO%' and c.vence between greatest(m.ini, p_desde) and least(m.fin, p_hasta)),
      'por_pagar_usd', (select coalesce(sum(pendiente), 0) from cxp c where c.moneda = 'USD' and upper(coalesce(c.estado_pago, '')) not like 'PAGADO%' and c.vence between greatest(m.ini, p_desde) and least(m.fin, p_hasta)),
      'por_cobrar_pen', (select coalesce(sum(pendiente), 0) from cxc c where c.moneda = 'PEN' and upper(coalesce(c.estado_pago, '')) not like 'PAGADO%' and c.vence between greatest(m.ini, p_desde) and least(m.fin, p_hasta))
    ) order by m.mes), '[]'::jsonb) as j from meses m
  ),
  top_proy_pagado as (
    select coalesce(jsonb_agg(x order by x.soles desc), '[]'::jsonb) as j from (
      select coalesce(pr.codigo, '(sin proyecto)') as proyecto, pr.nombre,
             sum(coalesce(p.monto_soles, case when p.moneda = 'USD' then p.monto * coalesce(p.tipo_cambio, 1) else p.monto end)) as soles,
             sum(p.monto) filter (where p.moneda = 'PEN') as pen, sum(p.monto) filter (where p.moneda = 'USD') as usd, count(*) as pagos
        from pagos p left join proyectos pr on pr.id = p.proyecto_id
       where p.tipo = 'egreso' and p.dia between p_desde and p_hasta
       group by pr.codigo, pr.nombre order by soles desc limit 10) x
  ),
  top_prov_pagado as (
    select coalesce(jsonb_agg(x order by x.soles desc), '[]'::jsonb) as j from (
      select coalesce(nullif(p.proveedor_nombre, ''), '(sin proveedor)') as proveedor,
             sum(coalesce(p.monto_soles, case when p.moneda = 'USD' then p.monto * coalesce(p.tipo_cambio, 1) else p.monto end)) as soles,
             sum(p.monto) filter (where p.moneda = 'PEN') as pen, sum(p.monto) filter (where p.moneda = 'USD') as usd, count(*) as pagos
        from pagos p where p.tipo = 'egreso' and p.dia between p_desde and p_hasta
       group by 1 order by soles desc limit 10) x
  ),
  top_prov_deuda as (
    select coalesce(jsonb_agg(x order by x.pen + x.usd * 3.4 desc), '[]'::jsonb) as j from (
      select coalesce(nullif(c.proveedor, ''), '(sin proveedor)') as proveedor,
             coalesce(sum(pendiente) filter (where moneda = 'PEN'), 0) as pen, coalesce(sum(pendiente) filter (where moneda = 'USD'), 0) as usd,
             count(*) as compromisos, min(vence) filter (where vence >= '2020-01-01') as vence_primero
        from cxp c where upper(coalesce(c.estado_pago, '')) not like 'PAGADO%'
       group by 1 order by coalesce(sum(pendiente) filter (where moneda = 'PEN'), 0) + coalesce(sum(pendiente) filter (where moneda = 'USD'), 0) * 3.4 desc limit 10) x
  ),
  top_proy_deuda as (
    select coalesce(jsonb_agg(x order by x.pen + x.usd * 3.4 desc), '[]'::jsonb) as j from (
      select coalesce(pr.codigo, coalesce(c.area, '(sin proyecto)')) as proyecto, pr.nombre,
             coalesce(sum(pendiente) filter (where c.moneda = 'PEN'), 0) as pen, coalesce(sum(pendiente) filter (where c.moneda = 'USD'), 0) as usd,
             count(*) as compromisos
        from cxp c left join proyectos pr on pr.id = c.proyecto_id where upper(coalesce(c.estado_pago, '')) not like 'PAGADO%'
       group by 1, 2 order by coalesce(sum(pendiente) filter (where c.moneda = 'PEN'), 0) + coalesce(sum(pendiente) filter (where c.moneda = 'USD'), 0) * 3.4 desc limit 10) x
  )
  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta, 'corte', p_corte, 'generado_en', now(),
    'tc_referencia', (select coalesce(venta, compra) from tipos_cambio order by fecha desc limit 1),
    'deuda', (select j from por_moneda_deuda),
    'proyectado', (select j from proyectado),
    'cobrar', (select j from cobrar),
    'tesoreria', (select j from tesoreria),
    'compras', (select j from compras),
    'facturas', (select j from facturas),
    'bancos', (select j from bancos),
    'cajas', (select j from cajas),
    'serie', (select j from serie),
    'top_proyectos_pagado', (select j from top_proy_pagado),
    'top_proveedores_pagado', (select j from top_prov_pagado),
    'top_proveedores_deuda', (select j from top_prov_deuda),
    'top_proyectos_deuda', (select j from top_proy_deuda)
  ) into r;
  return r;
end $$;
revoke all on function public.direccion_resumen(date, date, date) from public, anon;
grant execute on function public.direccion_resumen(date, date, date) to authenticated;

-- 4. Detalle descargable ---------------------------------------------------------------------------------------------
-- tipo: 'pagos' | 'cobros' | 'por_pagar' | 'por_cobrar' | 'deuda' (todo lo pendiente hoy) | 'ordenes' | 'facturas'
create or replace function public.direccion_detalle(p_tipo text, p_desde date, p_hasta date, p_corte date default current_date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t uuid := auth_tenant_id(); r jsonb;
begin
  if not direccion_puede_ver() then raise exception 'Sin permiso para el tablero de Dirección'; end if;
  if p_tipo in ('pagos', 'cobros') then
    select coalesce(jsonb_agg(x order by x.fecha desc), '[]'::jsonb) into r from (
      select coalesce(p.fecha_pago, p.fecha) as fecha, p.numero, p.tipo, p.descripcion, p.proveedor_nombre as proveedor, pr.codigo as proyecto,
             p.moneda, p.monto, p.tipo_cambio, p.monto_soles, p.categoria, p.referencia_tipo, p.referencia_numero as ope_referencia, cb.nombre as cuenta
        from transacciones p left join proyectos pr on pr.id = p.proyecto_id left join cuentas_bancarias cb on cb.id = p.cuenta_bancaria_id
       where p.tenant_id = t and p.estado = 'pagada' and p.tipo = case p_tipo when 'pagos' then 'egreso' else 'ingreso' end
         and coalesce(p.fecha_pago, p.fecha) between p_desde and p_hasta
       order by 1 desc limit 5000) x;
  elsif p_tipo in ('por_pagar', 'por_cobrar', 'deuda') then
    select coalesce(jsonb_agg(x order by x.vence nulls last), '[]'::jsonb) into r from (
      select coalesce(f.fecha_vencimiento, f.mes_vencimiento) as vence, f.concepto, f.proveedor, f.area, f.cdc, pr.codigo as proyecto, f.categoria,
             f.moneda, coalesce(f.monto_presupuestado, f.monto_ejecutado, 0) as monto, coalesce(f.monto_pagado, 0) as pagado,
             greatest(coalesce(f.monto_presupuestado, f.monto_ejecutado, 0) - coalesce(f.monto_pagado, 0), 0) as pendiente,
             f.estado_pago, f.origen, f.referencia_doc, f.pago_ligado_a,
             (coalesce(f.fecha_vencimiento, f.mes_vencimiento) < current_date) as vencido
        from flujo_compromisos f left join proyectos pr on pr.id = f.proyecto_id
       where f.tenant_id = t and f.sentido = case p_tipo when 'por_cobrar' then 'cobrar' else 'pagar' end
         and upper(coalesce(f.estado_pago, '')) not like 'PAGADO%'
         and (p_tipo = 'deuda' or coalesce(f.fecha_vencimiento, f.mes_vencimiento) between p_desde and p_hasta)
       order by 1 nulls last limit 5000) x;
  elsif p_tipo = 'ordenes' then
    select coalesce(jsonb_agg(x order by x.fecha_emision desc), '[]'::jsonb) into r from (
      select o.numero, o.tipo, o.estado, o.fecha_emision, pv.razon_social as proveedor, pr.codigo as proyecto, o.centro_costo_texto as centro_costo,
             o.moneda, o.subtotal, o.igv, o.total, o.condiciones_pago, o.comprador_email
        from ordenes_compra o left join proveedores pv on pv.id = o.proveedor_id left join proyectos pr on pr.id = o.proyecto_id
       where o.tenant_id = t and o.fecha_emision between p_desde and p_hasta and o.estado not in ('borrador', 'anulada', 'rechazada')
       order by o.fecha_emision desc limit 5000) x;
  elsif p_tipo = 'facturas' then
    select coalesce(jsonb_agg(x order by x.fecha_emision desc), '[]'::jsonb) into r from (
      select c.numero_completo as factura, c.fecha_emision, c.fecha_vencimiento, c.razon_social_emisor as proveedor, c.ruc_emisor as ruc, pr.codigo as proyecto,
             c.moneda, c.subtotal, c.igv, c.total, c.estado_flujo, c.orden_compra_numero as orden, c.tiene_detraccion, c.detraccion_monto
        from comprobantes_pago c left join proyectos pr on pr.id = c.proyecto_id
       where c.tenant_id = t and c.direccion = 'recibido' and c.fecha_emision between p_desde and p_hasta
       order by c.fecha_emision desc limit 5000) x;
  else
    raise exception 'Tipo de detalle desconocido: %', p_tipo;
  end if;
  return r;
end $$;
revoke all on function public.direccion_detalle(text, date, date, date) from public, anon;
grant execute on function public.direccion_detalle(text, date, date, date) to authenticated;

-- 5. Lo que le toca firmar a quien mira --------------------------------------------------------------------------------
create or replace function public.direccion_por_firmar() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t uuid := auth_tenant_id(); u uuid := auth.uid(); cfg jsonb; mis_roles text[]; es_admin boolean; r jsonb;
begin
  select config into cfg from flujo_aprobacion where tenant_id = t;
  select coalesce(array_agg(r.nombre), '{}') into mis_roles from usuarios_roles ur join roles r on r.id = ur.rol_id where ur.user_id = u and ur.tenant_id = t;
  es_admin := 'Administrador' = any(mis_roles);
  with oc as (
    select o.id, o.numero, o.fecha_emision, o.moneda, o.total, pv.razon_social as proveedor, pr.codigo as proyecto,
           notif_oc_etapa_en_turno(o.id) as etapa
      from ordenes_compra o left join proveedores pv on pv.id = o.proveedor_id left join proyectos pr on pr.id = o.proyecto_id
     where o.tenant_id = t and o.estado = 'enviada'
  ), oc_mias as (
    select * from oc where etapa is not null and (es_admin or exists (
      select 1 from jsonb_array_elements_text(coalesce(cfg->'rolesPorEtapa'->etapa, '[]'::jsonb)) x where lower(trim(x)) in (select lower(trim(m)) from unnest(mis_roles) m)))
  )
  select jsonb_build_object(
    'ordenes', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'numero', numero, 'fecha', fecha_emision, 'moneda', moneda, 'total', total, 'proveedor', proveedor, 'proyecto', proyecto, 'etapa', etapa) order by fecha_emision), '[]'::jsonb) from oc_mias),
    'viajes', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'numero', v.numero, 'destino', v.destino, 'fecha_salida', v.fecha_salida, 'estado', v.estado, 'solicitante', us.nombre, 'presupuesto', v.presupuesto_viaticos) order by v.fecha_salida), '[]'::jsonb)
                 from viajes v left join usuarios_tenant us on us.user_id = v.solicitado_por and us.tenant_id = v.tenant_id
                where v.tenant_id = t and ((v.estado = 'solicitado' and auth_tiene_permiso('viajes', 'aprobar')) or (v.estado = 'aprobado_jefatura' and auth_tiene_permiso('viajes', 'aprobar_final')))),
    'rendiciones', (select coalesce(jsonb_agg(jsonb_build_object('id', rd.id, 'numero', rd.numero, 'viaje_id', rd.viaje_id, 'estado', rd.estado, 'gastado', rd.gastado) order by rd.numero), '[]'::jsonb)
                 from viaje_rendiciones rd
                where rd.tenant_id = t and ((rd.estado = 'presentada' and auth_tiene_permiso('viajes', 'aprobar')) or (rd.estado = 'revisada_jefatura' and auth_tiene_permiso('viajes', 'aprobar_final'))))
  ) into r;
  return r;
end $$;
revoke all on function public.direccion_por_firmar() from public, anon;
grant execute on function public.direccion_por_firmar() to authenticated;

-- 6. OKRs ------------------------------------------------------------------------------------------------------------
create table if not exists public.okr_objetivos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  periodo text not null,                       -- '2026', '2026-T4', '2027-S1'
  titulo text not null,
  descripcion text,
  responsable text,
  estado text not null default 'activo' check (estado in ('activo', 'cerrado', 'cancelado')),
  orden int not null default 0,
  creado_por uuid, creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create table if not exists public.okr_resultados (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  objetivo_id uuid not null references public.okr_objetivos(id) on delete cascade,
  titulo text not null,
  unidad text not null default 'S/',           -- 'S/', 'US$', '%', 'días', 'unidades'…
  valor_inicial numeric not null default 0,
  meta numeric not null,
  valor_actual numeric not null default 0,
  direccion text not null default 'subir' check (direccion in ('subir', 'bajar')),
  -- Si se fija, el ERP calcula el valor solo (ver okr_valor_fuente); si es null, se actualiza a mano.
  fuente text,
  notas text,
  orden int not null default 0,
  actualizado_por uuid, actualizado_en timestamptz not null default now()
);
create index if not exists okr_resultados_objetivo_idx on public.okr_resultados(objetivo_id);
alter table public.okr_objetivos enable row level security;
alter table public.okr_resultados enable row level security;
drop policy if exists okr_obj_sel on public.okr_objetivos;
create policy okr_obj_sel on public.okr_objetivos for select to authenticated using (tenant_id = auth_tenant_id() and direccion_puede_ver());
drop policy if exists okr_obj_wr on public.okr_objetivos;
create policy okr_obj_wr on public.okr_objetivos for all to authenticated using (tenant_id = auth_tenant_id() and auth_tiene_permiso('direccion', 'editar')) with check (tenant_id = auth_tenant_id() and auth_tiene_permiso('direccion', 'editar'));
drop policy if exists okr_res_sel on public.okr_resultados;
create policy okr_res_sel on public.okr_resultados for select to authenticated using (tenant_id = auth_tenant_id() and direccion_puede_ver());
drop policy if exists okr_res_wr on public.okr_resultados;
create policy okr_res_wr on public.okr_resultados for all to authenticated using (tenant_id = auth_tenant_id() and auth_tiene_permiso('direccion', 'editar')) with check (tenant_id = auth_tenant_id() and auth_tiene_permiso('direccion', 'editar'));
grant select, insert, update, delete on public.okr_objetivos, public.okr_resultados to authenticated;

-- Fuentes automáticas: el valor sale del ERP cada vez que se consulta.
create or replace function public.okr_valor_fuente(p_fuente text) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare t uuid := auth_tenant_id(); v numeric; anio date := date_trunc('year', current_date)::date;
begin
  case p_fuente
    when 'cxp_vencida_pen' then
      select coalesce(sum(monto_pendiente), 0) into v from v_cxp where tenant_id = t and moneda = 'PEN' and vencido and estado_pago <> 'PAGADO';
    when 'cxp_vencida_usd' then
      select coalesce(sum(monto_pendiente), 0) into v from v_cxp where tenant_id = t and moneda = 'USD' and vencido and estado_pago <> 'PAGADO';
    when 'cxp_pendiente_pen' then
      select coalesce(sum(monto_pendiente), 0) into v from v_cxp where tenant_id = t and moneda = 'PEN' and estado_pago <> 'PAGADO';
    when 'cxp_pendiente_usd' then
      select coalesce(sum(monto_pendiente), 0) into v from v_cxp where tenant_id = t and moneda = 'USD' and estado_pago <> 'PAGADO';
    when 'cobrado_anio_pen' then
      select coalesce(sum(monto), 0) into v from transacciones where tenant_id = t and tipo = 'ingreso' and estado = 'pagada' and moneda = 'PEN' and coalesce(fecha_pago, fecha) >= anio;
    when 'pagado_anio_pen' then
      select coalesce(sum(monto), 0) into v from transacciones where tenant_id = t and tipo = 'egreso' and estado = 'pagada' and moneda = 'PEN' and coalesce(fecha_pago, fecha) >= anio;
    when 'pagado_anio_usd' then
      select coalesce(sum(monto), 0) into v from transacciones where tenant_id = t and tipo = 'egreso' and estado = 'pagada' and moneda = 'USD' and coalesce(fecha_pago, fecha) >= anio;
    when 'facturas_por_conformar' then
      select count(*) into v from comprobantes_pago where tenant_id = t and direccion = 'recibido' and coalesce(estado_flujo, 'recibida') in ('recibida', 'validada');
    when 'cartas_vencidas' then
      select count(*) into v from correspondencia where tenant_id = t and estado = 'pendiente' and fecha_limite < current_date;
    when 'cartas_sin_plazo' then
      select count(*) into v from correspondencia where tenant_id = t and estado = 'pendiente' and fecha_limite is null;
    when 'proyectos_en_ejecucion' then
      select count(*) into v from proyectos where tenant_id = t and estado = 'en_ejecucion';
    when 'valorizaciones_por_cobrar' then
      select count(*) into v from valorizaciones where tenant_id = t and estado <> 'pagada';
    when 'oc_en_aprobacion' then
      select count(*) into v from ordenes_compra where tenant_id = t and estado = 'enviada';
    when 'bancos_sin_conciliar' then
      select count(*) into v from movimientos_bancarios where tenant_id = t and transaccion_id is null;
    else v := null;
  end case;
  return v;
end $$;
revoke all on function public.okr_valor_fuente(text) from public, anon;
grant execute on function public.okr_valor_fuente(text) to authenticated;

create or replace view public.v_okr_resultados with (security_invoker = true) as
  select r.*, coalesce(okr_valor_fuente(r.fuente), r.valor_actual) as valor,
         case when r.meta = r.valor_inicial then 100
              else greatest(0, least(100, round((coalesce(okr_valor_fuente(r.fuente), r.valor_actual) - r.valor_inicial) / (r.meta - r.valor_inicial) * 100))) end as avance_pct
    from okr_resultados r;
grant select on public.v_okr_resultados to authenticated;
