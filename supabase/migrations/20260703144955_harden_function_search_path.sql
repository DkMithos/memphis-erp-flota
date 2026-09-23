-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260703144955  name: harden_function_search_path

-- Advisor: function_search_path_mutable (previene hijack de search_path en SECURITY DEFINER/triggers)
ALTER FUNCTION public.set_oc_proyecto_from_cc() SET search_path = public;
ALTER FUNCTION public.set_gasto_proyecto_from_cc() SET search_path = public;
ALTER FUNCTION public.block_gasto_caja_cerrada() SET search_path = public;
ALTER FUNCTION public.recalc_gastos_fijos_proyecto(uuid) SET search_path = public;
ALTER FUNCTION public.trg_recalc_gastos_fijos() SET search_path = public;
