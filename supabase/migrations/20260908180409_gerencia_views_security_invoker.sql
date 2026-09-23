-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260908180409  name: gerencia_views_security_invoker

-- Las vistas de Gerencia corrían con los permisos de su dueño (postgres), así
-- que saltaban RLS y estaban concedidas a `anon`. Hoy no se filtra nada porque
-- el otro tenant está vacío, pero la vista no debe ser la puerta trasera al
-- aislamiento por tenant. Con security_invoker mandan las políticas de las
-- tablas de origen, que ya filtran por tenant.
alter view v_gerencia_compromiso_mensual set (security_invoker = true);
alter view v_gerencia_caja_mensual       set (security_invoker = true);
alter view v_gerencia_por_centro_costo   set (security_invoker = true);
alter view v_gerencia_por_proveedor      set (security_invoker = true);
alter view v_gerencia_por_proyecto       set (security_invoker = true);

revoke all on v_gerencia_compromiso_mensual from anon;
revoke all on v_gerencia_caja_mensual       from anon;
revoke all on v_gerencia_por_centro_costo   from anon;
revoke all on v_gerencia_por_proveedor      from anon;
revoke all on v_gerencia_por_proyecto       from anon;
