-- Semana 2 del plan de carga (2026-10-13) · Paso 5 (#6 del plan): registro masivo de los movimientos del extracto BBVA 2026 que
-- no son pagos a proveedores y no tenían transacción en el ERP. Usa la función real `bancos_registrar_movimiento` (crea la
-- transacción pagada en la cuenta, la enlaza al movimiento y lo deja conciliado). El flujo de caja NO lee transacciones (solo
-- compromisos), así que esto no duplica nada en el flujo: alimenta el saldo ERP por cuenta y los pagos acumulados por CDC.
-- Reglas (clasificación → categoría, CDC):
--   itf                                  → ITF, BANCOS
--   comisiones (incl. "*MP: … COM SUNAT") → Comisiones bancarias, BANCOS
--   "*MP: … SUNAT DETR"                  → Detracción SPOT, DETRACCIÓN (depósito de detracción a SUNAT por un proveedor)
--   "*… SUNAT NPS"                       → Impuestos SUNAT, sin CDC (el tributo no viene en el concepto: Contabilidad lo asigna)
--   "SPOT MER" (cargo PEN + abono USD con el mismo número de operación), "TRAS A :…" y "MEMPHIS MAQUINARIAS SAC"
--                                        → Cambio de moneda, BANCOS (transferencias entre las cuentas 806 y 830)
--   abonos de terceros                   → Cobro (MUNI DIS → proyecto MDI; INMUEBLE → INMPAN); devoluciones/CESCE/PROTECTA/
--                                          retención judicial → Devolución / reembolso. El cliente queda en la descripción.
-- NO se registran (quedan para Finanzas, uno por uno): pagos a proveedores sin factura identificada (los 102 OPE errados y
-- las compras grandes de vehículos "59 CAMIONETAS SALDO", "COMPRA DE AMBULANCIAS"), préstamos, planilla, caja chica y lo que
-- siga "por clasificar". Primero con ROLLBACK, luego COMMIT.
begin;
select set_config('request.jwt.claims', '{"sub":"de040564-3d98-45cf-8fb5-6383e1c95df6","role":"authenticated","app_metadata":{"tenant_id":"e4b16a80-8500-418e-afaa-0e976b7d9b13"}}', true);

create temp table _antes on commit drop as
select nombre, moneda, saldo_erp, saldo_banco, saldo_banco_fecha, sin_conciliar from v_bancos_resumen;

create temp table _plan on commit drop as
with cc as (select codigo, id from centros_costo where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and codigo in ('BANCOS', 'DETRACCIÓN')),
     py as (select codigo, id from proyectos where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and codigo in ('MDI', 'INMPAN')),
     m as (select m.*, upper(coalesce(m.concepto, '')) as c from movimientos_bancarios m where m.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and m.transaccion_id is null)
select m.id, m.importe, m.fecha_operacion, m.concepto,
       case
         when m.clasificacion = 'itf' then 'itf'
         when m.clasificacion = 'comision' or m.c like '%COM SUNAT%' then 'comision'
         when m.c like '%SUNAT DETR%' then 'detraccion'
         when m.c like '%SUNAT NPS%' then 'sunat'
         when m.c like '%SPOT MER%' or m.c like 'TRAS A %' or m.c like '%MEMPHIS%' then 'cambio_moneda'
         when m.clasificacion = 'abono' and m.importe > 0 then 'abono'
       end as clas,
       case
         when m.clasificacion = 'itf' then 'ITF'
         when m.clasificacion = 'comision' or m.c like '%COM SUNAT%' then 'Comisiones bancarias'
         when m.c like '%SUNAT DETR%' then 'Detracción SPOT'
         when m.c like '%SUNAT NPS%' then 'Impuestos SUNAT'
         when m.c like '%SPOT MER%' or m.c like 'TRAS A %' or m.c like '%MEMPHIS%' then 'Cambio de moneda'
         when m.c ~ 'DEV\.|DEVOLUCION|RET\.JUDICIAL|CESCE|PROTECTA' then 'Devolución / reembolso'
         else 'Cobro'
       end as categoria,
       case
         when m.clasificacion in ('itf', 'comision') or m.c like '%COM SUNAT%' or m.c like '%SPOT MER%' or m.c like 'TRAS A %' or m.c like '%MEMPHIS%' then (select id from cc where codigo = 'BANCOS')
         when m.c like '%SUNAT DETR%' then (select id from cc where codigo = 'DETRACCIÓN')
       end as cc_id,
       case when m.c like '%MUNI DIS%' then (select id from py where codigo = 'MDI')
            when m.c like '%INMUEBLE%' then (select id from py where codigo = 'INMPAN') end as proy_id,
       case
         when m.c like '%SUNAT NPS%' then m.concepto || ' · tributo por identificar (registro masivo 13/10/2026)'
         when m.c like '%SPOT MER%' then m.concepto || ' · compra/venta de dólares (registro masivo 13/10/2026)'
         when m.c like 'TRAS A %' or m.c like '%MEMPHIS%' then m.concepto || ' · transferencia entre cuentas propias (registro masivo 13/10/2026)'
         when m.clasificacion = 'abono' and m.importe > 0 and m.c not like '%MEMPHIS%' then m.concepto || ' · cliente por identificar (registro masivo 13/10/2026)'
         else m.concepto || ' · registro masivo 13/10/2026'
       end as descripcion
  from m;

delete from _plan where clas is null;

-- registro (uno a uno por la función real; si alguno falla, falla todo)
do $$ declare r record; n int := 0; begin
  for r in select * from _plan order by fecha_operacion, importe loop
    perform bancos_registrar_movimiento(r.id, r.clas, r.categoria, r.cc_id, r.proy_id, r.descripcion);
    n := n + 1;
  end loop;
  raise notice 'registrados %', n;
end $$;

-- contadores y saldos
select 'registrados' k, (select jsonb_agg(x)::text from (select clas, categoria, count(*) n, round(sum(importe)) importe from _plan group by 1, 2 order by 3 desc) x) v
union all select 'siguen_sin_conciliar', (select jsonb_agg(x)::text from (select cb.moneda, m.clasificacion, count(*) n, round(sum(m.importe)) importe from movimientos_bancarios m join cuentas_bancarias cb on cb.id = m.cuenta_bancaria_id where m.transaccion_id is null group by 1, 2 order by 3 desc) x)
union all select 'saldos_antes', (select jsonb_agg(x)::text from (select nombre, saldo_erp, saldo_banco, saldo_banco_fecha, sin_conciliar from _antes where saldo_banco is not null order by nombre) x)
union all select 'saldos_despues', (select jsonb_agg(x)::text from (select nombre, saldo_erp, saldo_banco, saldo_banco_fecha, sin_conciliar from v_bancos_resumen where saldo_banco is not null order by nombre) x)
union all select 'trx_nuevas', (select jsonb_build_object('n', count(*), 'con_asiento', count(asiento_id))::text from transacciones where referencia_tipo = 'banco' and creado_en > now() - interval '10 minutes');
rollback;
