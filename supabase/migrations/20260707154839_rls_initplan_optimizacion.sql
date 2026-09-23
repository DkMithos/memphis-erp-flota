-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260707154839  name: rls_initplan_optimizacion

-- OPTIMIZACIÓN RLS (Supabase best practice security-rls-performance):
-- envolver funciones auth en (SELECT …) para que se evalúen UNA vez por query
-- (initplan) y no una vez POR FILA. 5-100x más rápido en tablas grandes.
DO $$
DECLARE
  r record;
  new_qual text;
  new_chk text;
  cmd_str text;
  roles_str text;
  ddl text;
BEGIN
  FOR r IN
    SELECT c.relname,
           p.polname,
           p.polcmd,
           pg_get_expr(p.polqual, p.polrelid) AS qual,
           pg_get_expr(p.polwithcheck, p.polrelid) AS chk,
           CASE WHEN p.polroles = '{0}'::oid[] THEN NULL
                ELSE (SELECT string_agg(quote_ident(rolname), ', ') FROM pg_roles WHERE oid = ANY(p.polroles))
           END AS roles
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE (
      (pg_get_expr(p.polqual, p.polrelid) ~ 'auth_tenant_id\(\)|auth\.uid\(\)|current_tenant_id\(\)'
        AND pg_get_expr(p.polqual, p.polrelid) !~ 'SELECT (auth_tenant_id|auth\.uid|current_tenant_id)')
      OR
      (pg_get_expr(p.polwithcheck, p.polrelid) ~ 'auth_tenant_id\(\)|auth\.uid\(\)|current_tenant_id\(\)'
        AND pg_get_expr(p.polwithcheck, p.polrelid) !~ 'SELECT (auth_tenant_id|auth\.uid|current_tenant_id)')
    )
  LOOP
    new_qual := r.qual;
    new_chk  := r.chk;
    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, 'auth_tenant_id()', '( SELECT auth_tenant_id())');
      new_qual := replace(new_qual, 'auth.uid()', '( SELECT auth.uid())');
      new_qual := replace(new_qual, 'current_tenant_id()', '( SELECT current_tenant_id())');
    END IF;
    IF new_chk IS NOT NULL THEN
      new_chk := replace(new_chk, 'auth_tenant_id()', '( SELECT auth_tenant_id())');
      new_chk := replace(new_chk, 'auth.uid()', '( SELECT auth.uid())');
      new_chk := replace(new_chk, 'current_tenant_id()', '( SELECT current_tenant_id())');
    END IF;

    cmd_str := CASE r.polcmd
      WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE' ELSE 'ALL' END;

    EXECUTE format('DROP POLICY %I ON public.%I', r.polname, r.relname);

    ddl := format('CREATE POLICY %I ON public.%I FOR %s', r.polname, r.relname, cmd_str);
    IF r.roles IS NOT NULL THEN ddl := ddl || ' TO ' || r.roles; END IF;
    IF new_qual IS NOT NULL THEN ddl := ddl || format(' USING (%s)', new_qual); END IF;
    IF new_chk IS NOT NULL THEN ddl := ddl || format(' WITH CHECK (%s)', new_chk); END IF;
    EXECUTE ddl;
  END LOOP;
END $$;

-- Consolidación: centros_costo tenía DOS políticas permisivas equivalentes
-- (tenant_cc vía profiles + ti_centros vía JWT). Se conserva la del JWT (canónica).
DROP POLICY IF EXISTS tenant_cc ON public.centros_costo;
