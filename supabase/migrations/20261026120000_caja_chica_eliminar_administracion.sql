-- 2026-10-26 · Carolina (rol Administración) debe poder eliminar movimientos de caja chica (gastos e ingresos).
-- La pantalla exige finanzas.eliminar para borrar (antes solo existía "corregir" con finanzas.editar). El rol
-- Administración recibe ese permiso. El borrado es físico: trg_auditar deja el rastro, fn_caja_tras_movimiento
-- recalcula el saldo de la caja y los enlaces desde Viajes quedan en null (FK on delete set null).
insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id from public.roles r, public.permisos p
 where r.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and r.nombre = 'Administración'
   and p.modulo = 'finanzas' and p.accion = 'eliminar'
on conflict do nothing;
