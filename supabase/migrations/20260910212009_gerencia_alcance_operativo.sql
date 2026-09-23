-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260910212009  name: gerencia_alcance_operativo

-- GERENCIA SE ACOTA (Kevin, 10/09)
--
-- El recorte no era para William sino para el PUESTO: Gerencia ve Compras,
-- Fianzas, Proyectos y Flota, aprueba solo las órdenes bajo el flujo de montos,
-- y solo se le avisa de lo que tiene que firmar. Afecta a Guillermo, Miguel
-- Zegarra, el consultor y William.
--
-- Pierde: admin, biomédico, contabilidad, CRM, finanzas, inventario y
-- proveedores; y deja de aprobar en finanzas y en flota.
--
-- CONSECUENCIA A LA VISTA: el tablero "Flujo Gerencia" (/bi/gerencia) exige
-- `admin.ver`, así que deja de estar a su alcance. Es coherente con quitarles
-- Finanzas —ese tablero enseña caja y margen de toda la empresa— pero conviene
-- saberlo: hasta hoy era su pantalla. Devolverle `admin: ver` bastaría.

delete from roles_permisos
where rol_id in (
  select id from roles
  where nombre = 'Gerencia' and tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
);

insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id
from roles r, permisos p
where r.nombre = 'Gerencia'
  and r.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  and (
    (p.modulo = 'compras'   and p.accion in ('ver', 'exportar', 'aprobar'))
    or (p.modulo = 'fianzas'   and p.accion in ('ver', 'exportar'))
    or (p.modulo = 'proyectos' and p.accion in ('ver', 'exportar'))
    or (p.modulo = 'flota'     and p.accion in ('ver', 'exportar'))
  );

update roles
set solo_notifica_aprobaciones = true,
    descripcion = 'Gerencia con alcance de operaciones: Compras, Fianzas, Proyectos y Flota. '
                  || 'Firma las órdenes bajo el flujo de montos. Sin Administración ni Finanzas.'
where nombre = 'Gerencia' and tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';

-- William vuelve a Gerencia: el rol aparte ya no hace falta.
delete from usuarios_roles
where user_id = (select id from auth.users where email = 'wbelevan@memphis.pe');

insert into usuarios_roles (user_id, rol_id, tenant_id)
select (select id from auth.users where email = 'wbelevan@memphis.pe'), r.id, r.tenant_id
from roles r
where r.nombre = 'Gerencia' and r.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';

delete from roles_permisos
where rol_id in (select id from roles where nombre = 'Gerencia Operativa');
delete from roles where nombre = 'Gerencia Operativa';

-- El circuito de firmas vuelve a nombrar solo a Gerencia.
update flujo_aprobacion
set config = jsonb_set(config, '{rolesPorEtapa,gerencia}', '["Gerencia"]'::jsonb),
    actualizado_en = now(),
    actualizado_por = 'migracion:gerencia_alcance_operativo'
where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
