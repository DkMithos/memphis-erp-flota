-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260903221212  name: rol_fianzas_solo_carolina_shirley

-- Corrección: colgar Fianzas del rol "Administración" también se lo daba a
-- Richard Navarro, que lo tiene además de "Compras". Kevin fue explícito:
-- "a esto solo debe tener acceso Shirley y Carolina".
--
-- Se saca de "Administración" y se crea un rol propio para ellas dos.

delete from roles_permisos rp
using roles r, permisos p
where rp.rol_id = r.id and rp.permiso_id = p.id
  and r.nombre = 'Administración' and p.modulo = 'fianzas';

insert into roles (tenant_id, nombre, descripcion)
select t.id, 'Fianzas', 'Gestión completa de fianzas, cartas y cargos.'
from tenants t
where not exists (
  select 1 from roles r where r.tenant_id = t.id and r.nombre = 'Fianzas'
);

insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id
from roles r join permisos p on p.modulo = 'fianzas'
where r.nombre = 'Fianzas'
on conflict do nothing;

-- Solo Carolina y Shirley.
insert into usuarios_roles (tenant_id, user_id, rol_id)
select ut.tenant_id, ut.user_id, r.id
from usuarios_tenant ut
join roles r on r.tenant_id = ut.tenant_id and r.nombre = 'Fianzas'
where ut.email in ('cokamura@memphis.pe', 'sbujaico@memphis.pe')
on conflict do nothing;
