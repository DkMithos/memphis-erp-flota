-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260910211035  name: rol_gerencia_operativa_y_aviso_solo_aprobaciones

-- WILLIAM ENTRA CON UN ALCANCE ACOTADO
--
-- El rol "Gerencia" lo comparten cuatro personas (Guillermo, Miguel Zegarra, el
-- consultor y William). Recortarlo se los recortaría a todos, así que William
-- pasa a un rol propio: ve Compras, Fianzas, Proyectos y Flota, y firma como
-- Gerencia en el circuito de las órdenes. Nada de Administración ni Finanzas.
--
-- Cuando asuma el alcance completo de Guillermo, se le devuelve el rol Gerencia
-- y este queda libre para el siguiente que entre con el mismo recorte.

-- Un rol puede pedir que solo se le avise de lo que tiene que aprobar. Es una
-- propiedad del PUESTO, no de la persona: quien entre con este rol hereda la
-- misma tranquilidad.
alter table roles
  add column if not exists solo_notifica_aprobaciones boolean not null default false;

comment on column roles.solo_notifica_aprobaciones is
  'Si es true, a quien tenga SOLO roles con esta marca únicamente le llegan los '
  'avisos de aprobación de los módulos que puede aprobar.';

insert into roles (tenant_id, nombre, descripcion, es_sistema, solo_notifica_aprobaciones)
values (
  'e4b16a80-8500-418e-afaa-0e976b7d9b13',
  'Gerencia Operativa',
  'Gerencia con alcance de operaciones: Compras, Fianzas, Proyectos y Flota. '
  'Firma las órdenes como Gerencia. Sin Administración ni Finanzas.',
  false, true
)
on conflict do nothing;

-- Permisos: ver y exportar en sus cuatro módulos; aprobar solo en Compras.
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id
from roles r, permisos p
where r.nombre = 'Gerencia Operativa'
  and r.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  and (
    (p.modulo = 'compras'   and p.accion in ('ver', 'exportar', 'aprobar'))
    or (p.modulo = 'fianzas'   and p.accion in ('ver', 'exportar'))
    or (p.modulo = 'proyectos' and p.accion in ('ver', 'exportar'))
    or (p.modulo = 'flota'     and p.accion in ('ver', 'exportar'))
  )
on conflict do nothing;

-- William deja Gerencia y pasa al rol nuevo.
delete from usuarios_roles
where user_id = (select id from auth.users where email = 'wbelevan@memphis.pe');

insert into usuarios_roles (user_id, rol_id, tenant_id)
select (select id from auth.users where email = 'wbelevan@memphis.pe'),
       r.id, r.tenant_id
from roles r
where r.nombre = 'Gerencia Operativa'
  and r.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';

-- El circuito de firmas va por NOMBRE de rol: sin esto William no podría firmar
-- la etapa de Gerencia, que es justo lo único que se le pide.
update flujo_aprobacion
set config = jsonb_set(
      config,
      '{rolesPorEtapa,gerencia}',
      '["Gerencia", "Gerencia Operativa"]'::jsonb
    ),
    actualizado_en = now(),
    actualizado_por = 'migracion:gerencia_operativa'
where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
