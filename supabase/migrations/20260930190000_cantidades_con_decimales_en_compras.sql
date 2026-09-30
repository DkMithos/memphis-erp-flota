-- Las cantidades de cotizaciones, órdenes, recepciones y requerimientos eran INTEGER.
-- Una línea con cantidad decimal (horas, m3, galones…) hacía fallar el insert de
-- ítems con 400 y, como el store solo lo mandaba a consola, la cotización/orden
-- quedaba guardada SIN líneas (COT-0098 y MM-S-000429 el 30/09). Pasan a numeric(12,3).

-- La vista depende de orden_items.precio_total y requerimiento_items.cantidad
drop view if exists public.v_partida_ejecucion;
-- El trigger de valorización de recepciones nombra la columna cantidad_recibida
drop trigger if exists trg_recepcion_item_valor on public.recepcion_items;

-- precio_total es columna generada a partir de cantidad: hay que soltarla y volverla a crear
alter table public.orden_items drop column precio_total;
alter table public.orden_items alter column cantidad type numeric(12,3) using cantidad::numeric;
alter table public.orden_items add column precio_total numeric
  generated always as ((cantidad * precio_unitario) - descuento) stored;

alter table public.cotizacion_items drop column precio_total;
alter table public.cotizacion_items alter column cantidad type numeric(12,3) using cantidad::numeric;
alter table public.cotizacion_items add column precio_total numeric
  generated always as ((cantidad * precio_unitario) - descuento) stored;

alter table public.recepcion_items
  alter column cantidad_pedida type numeric(12,3) using cantidad_pedida::numeric,
  alter column cantidad_recibida type numeric(12,3) using cantidad_recibida::numeric;

alter table public.requerimiento_items alter column cantidad type numeric(12,3) using cantidad::numeric;

create trigger trg_recepcion_item_valor
  before insert or update of orden_item_id, cantidad_recibida, precio_unitario, descripcion
  on public.recepcion_items for each row execute function public.set_recepcion_item_valor();

-- Se recrea la vista tal cual estaba (bloque 2: ejecución de partidas con IGV)
create view public.v_partida_ejecucion as
 WITH oc AS (
         SELECT oi.partida_id,
            sum(oi.precio_total * (1::numeric +
                CASE
                    WHEN COALESCE(o.regimen_igv, 'gravado'::text) = 'gravado'::text THEN 0.18
                    ELSE 0::numeric
                END) *
                CASE
                    WHEN o.moneda = 'USD'::text THEN COALESCE(o.tipo_cambio, tc_vigente(o.fecha_emision))
                    ELSE 1::numeric
                END) AS comprometido,
            count(DISTINCT o.id) AS ordenes
           FROM orden_items oi
             JOIN ordenes_compra o ON o.id = oi.orden_id
          WHERE oi.partida_id IS NOT NULL AND (o.estado = ANY (ARRAY['aprobada'::text, 'recibida_parcial'::text, 'recibida_total'::text]))
          GROUP BY oi.partida_id
        ), req AS (
         SELECT ri.partida_id,
            sum(ri.cantidad::numeric * COALESCE(ri.costo_estimado_unitario, 0::numeric) * 1.18 *
                CASE
                    WHEN r.moneda = 'USD'::text THEN tc_vigente(COALESCE(r.creado_en::date, CURRENT_DATE))
                    ELSE 1::numeric
                END) AS solicitado,
            count(DISTINCT r.id) AS requerimientos
           FROM requerimiento_items ri
             JOIN requerimientos_compra r ON r.id = ri.requerimiento_id
          WHERE ri.partida_id IS NOT NULL AND r.estado <> 'anulado'::text
          GROUP BY ri.partida_id
        ), base AS (
         SELECT l.id, l.tenant_id, l.presupuesto_id, l.item, l.nivel, l.es_hoja, l.descripcion, l.unidad, l.cantidad,
            l.precio_unitario, l.moneda, l.precio_unitario_soles, l.total_sin_igv, l.igv_tasa, l.total_con_igv,
            l.proveedor_nota, l.orden, l.creado_en, l.vigente, l.forma_pago, l.moneda_final, l.precio_unitario_final,
            l.total_final, l.proveedor_final, l.forma_pago_final, l.fila_excel,
            pp.proyecto_id,
            COALESCE(l.total_con_igv, l.total_sin_igv * (1::numeric + COALESCE(l.igv_tasa, 0.18)), 0::numeric) AS presupuestado_con_igv
           FROM proyecto_presupuesto_lineas l
             JOIN proyecto_presupuestos pp ON pp.id = l.presupuesto_id
          WHERE l.es_hoja
        )
 SELECT b.tenant_id, b.presupuesto_id, b.proyecto_id, b.id AS partida_id, b.item, b.nivel, b.es_hoja, b.vigente,
    b.descripcion, b.unidad, b.cantidad,
    b.presupuestado_con_igv AS presupuestado,
    COALESCE(b.total_sin_igv, 0::numeric) AS presupuestado_sin_igv,
    COALESCE(req.solicitado, 0::numeric) AS solicitado,
    COALESCE(req.requerimientos, 0::bigint) AS requerimientos,
    COALESCE(oc.comprometido, 0::numeric) AS comprometido,
    COALESCE(oc.ordenes, 0::bigint) AS ordenes,
    b.presupuestado_con_igv - COALESCE(oc.comprometido, 0::numeric) AS saldo,
        CASE
            WHEN b.presupuestado_con_igv > 0::numeric THEN round(COALESCE(oc.comprometido, 0::numeric) / b.presupuestado_con_igv * 100::numeric, 1)
            ELSE NULL::numeric
        END AS pct_comprometido,
    COALESCE(oc.comprometido, 0::numeric) > (b.presupuestado_con_igv + 0.005) AS sobregirada
   FROM base b
     LEFT JOIN oc ON oc.partida_id = b.id
     LEFT JOIN req ON req.partida_id = b.id;
grant select on public.v_partida_ejecucion to authenticated, anon, service_role;
notify pgrst, 'reload schema';
