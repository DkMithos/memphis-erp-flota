-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904210056  name: vistas_tablero_gerencia

-- Vistas del tablero de Gerencia (Fase 1).
--
-- Todas separan PEN de USD a propósito. El gasto de Memphis es mayoritariamente
-- en dólares (902 OCs por $22.2M frente a 395 por S/20.2M), así que consolidar
-- con una constante movería la cifra en millones. El consolidado llega cuando
-- exista la tabla de tipos de cambio por fecha (N46).
--
-- Son vistas y no tablas: siempre reflejan el estado actual, sin proceso que
-- mantener ni riesgo de quedar desfasadas.

-- Por proyecto: presupuesto contra lo realmente comprometido en órdenes.
create or replace view v_gerencia_por_proyecto as
select p.tenant_id,
       p.id                as proyecto_id,
       p.nombre            as proyecto,
       p.estado,
       p.presupuesto,
       p.costo_real,
       p.porcentaje_avance,
       coalesce(sum(o.total) filter (where o.moneda = 'PEN'), 0) as comprometido_pen,
       coalesce(sum(o.total) filter (where o.moneda = 'USD'), 0) as comprometido_usd,
       count(o.id)                                              as ordenes
from proyectos p
left join ordenes_compra o
       on o.proyecto_id = p.id
      and o.estado not in ('anulada', 'rechazada')
group by p.tenant_id, p.id, p.nombre, p.estado, p.presupuesto, p.costo_real, p.porcentaje_avance;

-- Por centro de costo: el corte por área que hoy Carolina arma a mano.
create or replace view v_gerencia_por_centro_costo as
select cc.tenant_id,
       cc.codigo,
       cc.nombre,
       (cc.proyecto_id is not null) as tiene_proyecto,
       coalesce(sum(o.total) filter (where o.moneda = 'PEN'), 0) as comprometido_pen,
       coalesce(sum(o.total) filter (where o.moneda = 'USD'), 0) as comprometido_usd,
       count(o.id)                                              as ordenes
from centros_costo cc
left join ordenes_compra o
       on o.centro_costo_id = cc.id
      and o.estado not in ('anulada', 'rechazada')
group by cc.tenant_id, cc.codigo, cc.nombre, cc.proyecto_id;

-- Concentración de proveedores: cuánto del compromiso está en pocas manos.
-- El Flujo GM no lo tenía y es una de las preguntas que Gerencia hace siempre.
create or replace view v_gerencia_por_proveedor as
select o.tenant_id,
       pr.id            as proveedor_id,
       pr.razon_social  as proveedor,
       pr.ruc,
       coalesce(sum(o.total) filter (where o.moneda = 'PEN'), 0) as comprometido_pen,
       coalesce(sum(o.total) filter (where o.moneda = 'USD'), 0) as comprometido_usd,
       count(o.id)                                              as ordenes,
       max(o.fecha_emision)                                     as ultima_orden
from ordenes_compra o
join proveedores pr on pr.id = o.proveedor_id
where o.estado not in ('anulada', 'rechazada')
group by o.tenant_id, pr.id, pr.razon_social, pr.ruc;

-- Salida real de caja chica por mes, que es lo único "pagado" que hoy consta.
create or replace view v_gerencia_caja_mensual as
select g.tenant_id,
       to_char(g.fecha, 'YYYY-MM') as mes,
       g.moneda,
       count(*)      as movimientos,
       sum(g.monto)  as egreso
from gastos_caja_chica g
where g.fecha is not null
group by g.tenant_id, to_char(g.fecha, 'YYYY-MM'), g.moneda;
