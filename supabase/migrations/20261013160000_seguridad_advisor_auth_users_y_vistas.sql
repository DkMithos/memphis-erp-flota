-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-10-13 · Correo de Supabase "Action required: security vulnerabilities".
--
-- ERROR auth_users_exposed: `v_lotes_pago` y `v_lotes_pago_items` hacían JOIN con
-- `auth.users` para mostrar el correo de quien creó/validó/ajustó. Como las vistas
-- corren con los permisos del dueño (postgres), cualquier llamada a la API con la
-- clave anónima podía leer correos de auth.users. Arreglo: el correo sale de
-- `usuarios_tenant` (misma empresa, con RLS) y las vistas pasan a
-- `security_invoker = true` (se evalúan con los permisos del usuario que consulta).
--
-- WARN security_definer_view: las demás vistas del ERP también pasan a
-- security_invoker: todas leen tablas con RLS por tenant, así que un usuario
-- autenticado ve lo mismo que antes y un anónimo no ve nada.
-- Además se retira al rol `anon` el SELECT de todas las vistas `v_%` (el ERP
-- siempre consulta autenticado; el portal público usa RPC propias).
--
-- WARN anon_security_definer_function_executable: las funciones SECURITY DEFINER
-- del ERP eran ejecutables por `anon`. Se retira ese permiso salvo a las dos que
-- sirven páginas públicas (`vehiculo_public_by_token`, `taller_mis_citas`) y a los
-- predicados que usan las políticas RLS. Se cambian los privilegios por defecto para
-- que las funciones nuevas no nazcan ejecutables por `anon`.
--
-- WARN function_search_path_mutable: 8 funciones pequeñas sin `search_path` fijo.
-- WARN extension_in_public (pg_net): no se mueve; Supabase la instala en public y
-- la usan los cron (http_post). Queda documentado.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Vistas de lotes sin auth.users
create or replace view public.v_lotes_pago with (security_invoker = true) as
select l.id, l.tenant_id, l.numero, l.estado, l.fecha_prevista_pago, l.notas, l.creado_por, l.creado_en,
       l.enviado_revision_por, l.enviado_revision_en, l.validado_por, l.validado_en, l.enviado_tesoreria_por, l.enviado_tesoreria_en,
       l.pagado_en, l.conciliado_en, l.anulado_por, l.anulado_en, l.motivo_anulacion,
       coalesce(x.n, 0::bigint) as lineas, coalesce(x.pendientes, 0::bigint) as lineas_pendientes, coalesce(x.pagadas, 0::bigint) as lineas_pagadas,
       coalesce(x.con_alertas, 0::bigint) as lineas_con_alertas, coalesce(x.ajustadas, 0::bigint) as lineas_ajustadas,
       coalesce(x.bruto_pen, 0::numeric) as bruto_pen, coalesce(x.bruto_usd, 0::numeric) as bruto_usd,
       coalesce(x.neto_pen, 0::numeric) as neto_pen, coalesce(x.neto_usd, 0::numeric) as neto_usd,
       coalesce(x.detraccion_soles, 0::numeric) as detraccion_soles, coalesce(x.retencion_pen, 0::numeric) as retencion_pen,
       coalesce(x.retencion_usd, 0::numeric) as retencion_usd, coalesce(x.neto_total_soles, 0::numeric) as neto_total_soles,
       uc.email::varchar(255) as creado_por_email, uv.email::varchar(255) as validado_por_email
  from lotes_pago l
  left join lateral (
    select count(*) as n,
           count(*) filter (where i.estado = 'pendiente') as pendientes,
           count(*) filter (where i.estado = 'pagada') as pagadas,
           count(*) filter (where cardinality(i.alertas) > 0 and i.estado <> 'excluida') as con_alertas,
           count(*) filter (where i.ajustado) as ajustadas,
           sum(i.monto) filter (where i.moneda = 'PEN' and i.estado <> 'excluida') as bruto_pen,
           sum(i.monto) filter (where i.moneda = 'USD' and i.estado <> 'excluida') as bruto_usd,
           sum(i.neto) filter (where i.moneda = 'PEN' and i.estado <> 'excluida') as neto_pen,
           sum(i.neto) filter (where i.moneda = 'USD' and i.estado <> 'excluida') as neto_usd,
           sum(i.detraccion_soles) filter (where i.estado <> 'excluida') as detraccion_soles,
           sum(i.retencion_monto) filter (where i.moneda = 'PEN' and i.estado <> 'excluida') as retencion_pen,
           sum(i.retencion_monto) filter (where i.moneda = 'USD' and i.estado <> 'excluida') as retencion_usd,
           sum(i.neto_soles) filter (where i.estado <> 'excluida') as neto_total_soles
      from lotes_pago_items i where i.lote_id = l.id) x on true
  left join usuarios_tenant uc on uc.user_id = l.creado_por and uc.tenant_id = l.tenant_id
  left join usuarios_tenant uv on uv.user_id = l.validado_por and uv.tenant_id = l.tenant_id;

create or replace view public.v_lotes_pago_items with (security_invoker = true) as
select i.id, i.tenant_id, i.lote_id, i.orden, i.tipo_linea, i.compromiso_id, i.comprobante_id, i.orden_compra_id, i.proveedor_id, i.proveedor, i.ruc,
       i.proyecto_id, i.centro_costo_id, i.cdc, i.concepto, i.referencia_doc, i.moneda, i.monto, i.tc, i.fecha_tc, i.banco, i.cuenta, i.cci, i.moneda_cuenta,
       i.cuenta_detraccion, i.detraccion_aplica, i.detraccion_codigo, i.detraccion_tasa, i.detraccion_base, i.detraccion_soles, i.detraccion_monto,
       i.retencion_tipo, i.retencion_tasa, i.retencion_monto, i.neto, i.neto_soles, i.alertas, i.ajustado, i.ajustado_por, i.ajustado_en, i.ajuste_motivo,
       i.estado, i.fecha_pago, i.cuenta_bancaria_id, i.numero_operacion, i.voucher_path, i.transaccion_id, i.detraccion_id, i.retencion_id,
       i.motivo_exclusion, i.notas, i.creado_en,
       p.codigo as proyecto_codigo, cb.nombre as cuenta_origen_nombre, dc.descripcion as detraccion_descripcion,
       ua.email::varchar(255) as ajustado_por_email,
       c.numero_completo as comprobante_numero, c.total as comprobante_total, c.fecha_emision as comprobante_fecha, c.fecha_vencimiento as comprobante_vence
  from lotes_pago_items i
  left join proyectos p on p.id = i.proyecto_id
  left join cuentas_bancarias cb on cb.id = i.cuenta_bancaria_id
  left join detraccion_codigos dc on dc.codigo = i.detraccion_codigo
  left join usuarios_tenant ua on ua.user_id = i.ajustado_por and ua.tenant_id = i.tenant_id
  left join comprobantes_pago c on c.id = i.comprobante_id;

-- 2) El resto de vistas con permisos del dueño pasan a permisos del que consulta
alter view public.v_facturas_cdc_sugerido set (security_invoker = true);
alter view public.v_flujo_ultima_lectura set (security_invoker = true);
alter view public.v_despachos set (security_invoker = true);
alter view public.v_cuentas_bancarias_saldo set (security_invoker = true);
alter view public.v_partida_ejecucion set (security_invoker = true);
alter view public.v_detracciones set (security_invoker = true);
alter view public.v_movimientos_bancarios set (security_invoker = true);
alter view public.v_bancos_resumen set (security_invoker = true);
alter view public.v_pagos_acumulados set (security_invoker = true);
alter view public.v_obligaciones_cuotas set (security_invoker = true);
alter view public.v_obligaciones set (security_invoker = true);

-- 3) anon no lee ninguna vista del ERP
do $$ declare r record; begin
  for r in select viewname from pg_views where schemaname = 'public' and viewname like 'v\_%' loop
    execute format('revoke all on public.%I from anon', r.viewname);
  end loop;
end $$;

-- 4) search_path fijo en las funciones que no lo tenían
alter function public.bancos_clasificar_concepto(text, numeric) set search_path = public;
alter function public.bn_texto(text, integer) set search_path = public;
alter function public.capacitaciones_calcular_horas() set search_path = public;
alter function public.capacitaciones_touch() set search_path = public;
alter function public.detraccion_vence(date) set search_path = public;
alter function public.dias_credito_de(text) set search_path = public;
alter function public.flujo_ref_norm(text) set search_path = public;
alter function public.pago_ligado_de(text) set search_path = public;

-- 5) anon no ejecuta funciones SECURITY DEFINER del ERP (salvo las públicas y los predicados de RLS)
do $$ declare r record; begin
  for r in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
             from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
              and has_function_privilege('anon', p.oid, 'execute')
              and p.proname not in ('vehiculo_public_by_token', 'taller_mis_citas',
                                    'auth_tiene_permiso', 'auth_tenant_id', 'lote_puede_ver', 'flujo_puede_ver', 'bancos_puede_operar',
                                    'flujo_ve_todo_actual', 'obligacion_puede_editar') loop
    execute format('revoke execute on function public.%I(%s) from anon', r.proname, r.args);
  end loop;
end $$;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- 6) (aplicado el mismo día, tras ver que el advisor seguía marcando anon) Postgres da EXECUTE a PUBLIC por defecto, así que
--    revocar solo a `anon` no basta: se revoca a PUBLIC y anon, y se concede explícitamente a authenticated y service_role.
do $$ declare r record; begin
  for r in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
             from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
              and has_function_privilege('anon', p.oid, 'execute')
              and p.proname not in ('vehiculo_public_by_token', 'taller_mis_citas',
                                    'auth_tiene_permiso', 'auth_tenant_id', 'lote_puede_ver', 'flujo_puede_ver', 'bancos_puede_operar',
                                    'flujo_ve_todo_actual', 'obligacion_puede_editar') loop
    execute format('revoke execute on function public.%I(%s) from public, anon', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', r.proname, r.args);
  end loop;
end $$;
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public grant execute on functions to authenticated, service_role;
