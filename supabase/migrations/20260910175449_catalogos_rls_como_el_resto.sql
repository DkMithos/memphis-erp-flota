-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260910175449  name: catalogos_rls_como_el_resto

-- LOS CATÁLOGOS SOLO LOS VEÍA KEVIN
--
-- `catalogos` era la ÚNICA tabla del sistema cuyas políticas resolvían el tenant
-- con la tabla `memberships`, en vez de `auth_tenant_id()` como todas las demás.
-- Y en `memberships` solo está Kevin.
--
-- Consecuencia: a Richard, Carolina, Walter y al resto la consulta les devolvía
-- CERO filas, y el store lo interpretaba como "la tabla está vacía" y caía a los
-- valores por defecto del código. Así que los bancos, condiciones de pago,
-- unidades y lugares de entrega que Kevin configuró eran invisibles para todos,
-- y lo que ellos agregaban desaparecía al recargar.
--
-- No se veía porque los valores por defecto son razonables: parecía que estaba
-- bien, solo que no era lo que la empresa había configurado.

drop policy if exists catalogos_tenant_select on catalogos;
drop policy if exists catalogos_tenant_insert on catalogos;
drop policy if exists catalogos_tenant_update on catalogos;
drop policy if exists catalogos_tenant_delete on catalogos;

create policy "catalogos: tenant completo" on catalogos
  for all
  using (tenant_id = (select auth_tenant_id()))
  with check (tenant_id = (select auth_tenant_id()));
