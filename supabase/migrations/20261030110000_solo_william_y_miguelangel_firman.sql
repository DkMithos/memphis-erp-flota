-- 2026-10-30 · Kevin: "Tony, Guillermo y Miguel no firman ni aprueban nada. Solo Miguelángel y William firman y aprueban;
-- los demás roles se mantienen como están".
--   · Guillermo Macher y Miguel Zegarra: solo rol Socio (se les quita Gerencia, que es el rol que firma la etapa Gerencia
--     de las órdenes y aprueba viajes).
--   · Tony (consultor@): rol nuevo "Consultor" = los módulos de Gerencia en lectura/exportación, sin aprobar ni aprobar_final,
--     más Dirección; se le quita Gerencia.
--   · Gerencia queda solo para William Belevan (firma la etapa Gerencia; aprueba viajes y rendiciones como final).
--   · Miguelángel no cambia: firma Operaciones con el rol Proyectos y aprueba viajes como jefatura.
--   · Los avisos "Aprobación requerida" abiertos dejan de estar dirigidos a los tres que ya no firman.
insert into roles (tenant_id, nombre, descripcion, es_sistema, solo_notifica_aprobaciones, solo_direccion)
select r.tenant_id, 'Consultor', 'Consultor de Gerencia: ve Compras, Proyectos, Flota, Fianzas, Viajes y Dirección; no aprueba ni firma', false, true, false
  from roles r where r.nombre = 'Gerencia'
   and not exists (select 1 from roles x where x.tenant_id = r.tenant_id and x.nombre = 'Consultor');

insert into roles_permisos (rol_id, permiso_id)
select c.id, rp.permiso_id
  from roles g join roles c on c.tenant_id = g.tenant_id and c.nombre = 'Consultor'
  join roles_permisos rp on rp.rol_id = g.id join permisos p on p.id = rp.permiso_id
 where g.nombre = 'Gerencia' and p.accion not in ('aprobar', 'aprobar_final')
   and not exists (select 1 from roles_permisos x where x.rol_id = c.id and x.permiso_id = rp.permiso_id);

insert into usuarios_roles (user_id, tenant_id, rol_id)
select ut.user_id, ut.tenant_id, r.id
  from usuarios_tenant ut join roles r on r.tenant_id = ut.tenant_id and r.nombre = 'Consultor'
 where ut.email = 'consultor@memphis.pe'
   and not exists (select 1 from usuarios_roles x where x.user_id = ut.user_id and x.rol_id = r.id);

delete from usuarios_roles ur
 using usuarios_tenant ut, roles r
 where ur.user_id = ut.user_id and ur.rol_id = r.id and r.nombre = 'Gerencia'
   and ut.email in ('consultor@memphis.pe', 'gmacher@memphis.pe', 'mzegarra@memphis.pe');

delete from notificaciones_destinatarios d
 using notificaciones n, usuarios_tenant ut
 where d.notificacion_id = n.id and d.user_id = ut.user_id
   and ut.email in ('consultor@memphis.pe', 'gmacher@memphis.pe', 'mzegarra@memphis.pe')
   and n.entidad_tipo = 'orden_compra' and not n.leida
   and translate(lower(n.titulo), 'áéíóú', 'aeiou') like 'aprobacion requerida%';
