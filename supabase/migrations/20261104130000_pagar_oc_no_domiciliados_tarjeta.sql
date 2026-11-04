-- 2026-11-04 · Kevin: "Márcalos como pagados con tarjeta, fecha de cada orden".
-- Cierra los 14 compromisos de OC de no domiciliados creados en 20261104120000 (fuente 'manual'):
-- un pago por compromiso con la fecha de emisión de su OC y referencia "Tarjeta de crédito".
-- Sin cuenta bancaria (p_cuenta es FK a cuentas_contables, va null) y como Kevin (sub del JWT = creado_por).
-- Ejecutado una sola vez por MCP; se guarda como registro. Resultado: 14 pagados, TRX-2026-1332..1345.
with cfg as (
  select set_config('request.jwt.claims', json_build_object(
           'sub', (select user_id from usuarios_tenant where email = 'kcastillo@memphis.pe'),
           'role', 'authenticated',
           'app_metadata', json_build_object('tenant_id', (select tenant_id from usuarios_tenant where email = 'kcastillo@memphis.pe')))::text, true) as c
), pagos as (
  select f.id as compromiso, o.numero, o.fecha_emision,
         registrar_pago_compromiso(f.id, o.fecha_emision::date, null, null, 'Tarjeta de crédito') as tx
    from cfg, flujo_compromisos f join ordenes_compra o on o.id = f.orden_compra_id
   where f.fuente = 'manual' and upper(coalesce(f.estado_pago, '')) not like 'PAGADO%' and cfg.c is not null
)
select count(*) as pagados, min(fecha_emision) desde, max(fecha_emision) hasta,
       string_agg(numero, ', ' order by numero) ordenes
  from pagos;
