-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260831141853  name: rbac_contabilidad_recepciones_y_proveedores

-- Ajustes de RBAC pedidos por Kevin (27/08/2026):
--  · Compras necesita dar de alta proveedores.
--  · Contabilidad no tenía módulo ni rol.
--  · Recepciones lo usan Compras, jramirez (Flota) y mcastaneda (Proyectos),
--    sin darles el resto de Compras → permiso propio `compras.recepcionar`.

-- 1) Permisos nuevos
insert into permisos (modulo, accion, descripcion)
select v.* from (values
  ('compras','recepcionar','Registrar recepciones de mercadería'),
  ('contabilidad','ver','Ver contabilidad'),
  ('contabilidad','crear','Registrar asientos y comprobantes'),
  ('contabilidad','editar','Editar asientos y comprobantes'),
  ('contabilidad','exportar','Exportar reportes contables')
) as v(modulo, accion, descripcion)
where not exists (select 1 from permisos p where p.modulo=v.modulo and p.accion=v.accion);

-- 2) Compras: alta y edición de proveedores
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r, permisos p
where r.nombre = 'Compras' and p.modulo='proveedores' and p.accion in ('crear','editar')
  and not exists (select 1 from roles_permisos rp where rp.rol_id=r.id and rp.permiso_id=p.id);

-- 3) Recepciones para Compras, Técnico Flota y Proyectos
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r, permisos p
where r.nombre in ('Compras','Técnico Flota','Proyectos')
  and p.modulo='compras' and p.accion='recepcionar'
  and not exists (select 1 from roles_permisos rp where rp.rol_id=r.id and rp.permiso_id=p.id);

-- 4) Rol Contabilidad
insert into roles (tenant_id, nombre, descripcion)
select 'e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Contabilidad', 'Registro contable, comprobantes y libros'
where not exists (select 1 from roles where nombre='Contabilidad'
  and tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13');

insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r, permisos p
where r.nombre='Contabilidad'
  and ( (p.modulo='contabilidad')
     or (p.modulo='compras'     and p.accion in ('ver','exportar'))
     or (p.modulo='finanzas'    and p.accion in ('ver','exportar'))
     or (p.modulo='proveedores' and p.accion='ver') )
  and not exists (select 1 from roles_permisos rp where rp.rol_id=r.id and rp.permiso_id=p.id);

-- 5) El Administrador debe tener TODO (incluidos los permisos nuevos)
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r, permisos p
where r.nombre='Administrador'
  and not exists (select 1 from roles_permisos rp where rp.rol_id=r.id and rp.permiso_id=p.id);

-- 6) Gerencia ve contabilidad (solo lectura)
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r, permisos p
where r.nombre='Gerencia' and p.modulo='contabilidad' and p.accion in ('ver','exportar')
  and not exists (select 1 from roles_permisos rp where rp.rol_id=r.id and rp.permiso_id=p.id);

-- 7) Módulos visibles del tenant: se ocultan inventario, biomédico y CRM;
--    se habilita contabilidad (antes no estaba en la lista y quedaba invisible).
update tenants set modules_config = '[
  {"id":"dashboard","enabled":true},
  {"id":"flota","enabled":true},
  {"id":"biomedico","enabled":false},
  {"id":"compras","enabled":true},
  {"id":"proveedores","enabled":true},
  {"id":"inventario","enabled":false},
  {"id":"contabilidad","enabled":true},
  {"id":"finanzas","enabled":true},
  {"id":"proyectos","enabled":true},
  {"id":"crm","enabled":false},
  {"id":"bi","enabled":true}
]'::jsonb
where id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';

-- 8) Nombre real de Adrian Salazar
update usuarios_tenant set nombre = 'Adrian Salazar', cargo = coalesce(cargo, 'TI')
where email = 'osalazar@memphis.pe';
