-- 2026-10-30 · Dirección: quién es "solo tablero" y quién además opera.
-- Kevin: "William y Tony sí tienen que ver los módulos que tenían habilitados anteriormente, incluyendo el de Dirección.
-- También habilita a Miguelángel el módulo de Dirección".
--   · Gerencia deja de ser "solo Dirección": William Belevan y Tony (consultor@) recuperan Compras, Proyectos, Flota,
--     Fianzas y Viajes en lectura/aprobación y además ven Dirección.
--   · Rol nuevo "Socio" (solo Dirección, solo avisos de aprobación) para Guillermo Macher y Miguel Zegarra, que conservan
--     Gerencia para seguir firmando órdenes y viajes. La bandera manda si CUALQUIER rol la tiene (antes era "todos").
--   · Rol nuevo "Dirección (lectura)" con direccion.ver/exportar para Miguelángel Castañeda (suma a Proyectos y Técnico Flota).
update roles set solo_direccion = false where nombre = 'Gerencia';

insert into roles (tenant_id, nombre, descripcion, es_sistema, solo_notifica_aprobaciones, solo_direccion)
select r.tenant_id, 'Socio', 'Socio: ve solo el tablero de Dirección, descarga reportes y firma lo que le toca', false, true, true
  from roles r where r.nombre = 'Gerencia'
   and not exists (select 1 from roles x where x.tenant_id = r.tenant_id and x.nombre = 'Socio');
insert into roles (tenant_id, nombre, descripcion, es_sistema, solo_notifica_aprobaciones, solo_direccion)
select r.tenant_id, 'Dirección (lectura)', 'Ve el tablero de Dirección y descarga sus reportes, además de sus otros módulos', false, false, false
  from roles r where r.nombre = 'Gerencia'
   and not exists (select 1 from roles x where x.tenant_id = r.tenant_id and x.nombre = 'Dirección (lectura)');

insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r join permisos p on p.modulo = 'direccion' and p.accion in ('ver', 'exportar')
 where r.nombre in ('Socio', 'Dirección (lectura)')
   and not exists (select 1 from roles_permisos rp where rp.rol_id = r.id and rp.permiso_id = p.id);

insert into usuarios_roles (user_id, tenant_id, rol_id)
select ut.user_id, ut.tenant_id, r.id
  from usuarios_tenant ut join roles r on r.tenant_id = ut.tenant_id and r.nombre = 'Socio'
 where ut.email in ('gmacher@memphis.pe', 'mzegarra@memphis.pe')
   and not exists (select 1 from usuarios_roles x where x.user_id = ut.user_id and x.rol_id = r.id);
insert into usuarios_roles (user_id, tenant_id, rol_id)
select ut.user_id, ut.tenant_id, r.id
  from usuarios_tenant ut join roles r on r.tenant_id = ut.tenant_id and r.nombre = 'Dirección (lectura)'
 where ut.email = 'mcastaneda@memphis.pe'
   and not exists (select 1 from usuarios_roles x where x.user_id = ut.user_id and x.rol_id = r.id);
