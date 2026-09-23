-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260921155419  name: flujo_escritura_por_area

-- Antes solo los "ve-todo" podían escribir. Para que cada área maneje SU flujo
-- en el ERP (crear/editar/borrar), la escritura se abre a quien puede VER el
-- área (misma regla que la lectura): Walter en Contabilidad, Miguelangel en
-- Proyectos, etc.; Carolina y los administradores en todas. La importación sigue
-- entrando por service role (salta RLS).
drop policy if exists flujo_comp_wr on public.flujo_compromisos;
create policy flujo_comp_wr on public.flujo_compromisos
  for all using (tenant_id = auth_tenant_id() and public.flujo_puede_ver(area))
  with check (tenant_id = auth_tenant_id() and public.flujo_puede_ver(area));
