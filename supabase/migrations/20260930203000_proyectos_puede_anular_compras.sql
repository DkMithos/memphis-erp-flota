-- Anular órdenes, cotizaciones y requerimientos exige `compras.eliminar` (así lo
-- comprueban los tres detalles). Operaciones/Proyectos (Miguelángel) debe poder anular.
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r cross join permisos p
 where r.nombre = 'Proyectos' and p.modulo = 'compras' and p.accion = 'eliminar'
on conflict do nothing;
