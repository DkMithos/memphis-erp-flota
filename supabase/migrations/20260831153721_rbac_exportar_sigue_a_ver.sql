-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260831153721  name: rbac_exportar_sigue_a_ver

-- Regla explícita: si un rol puede VER un módulo, puede EXPORTARLO.
-- Motivo (Kevin, 31/08/2026): "cada uno debe poder extraer todo lo que requiera".
-- El permiso `exportar` se conserva como interruptor propio para poder quitarle
-- la descarga a un rol concreto más adelante sin quitarle la lectura.

-- 1) El módulo `admin` era el único sin permiso `exportar`. Se crea para que no
--    quede ningún módulo fuera del control.
insert into permisos (modulo, accion, descripcion)
select 'admin', 'exportar', 'Exportar información del módulo de administración'
where not exists (
  select 1 from permisos where modulo = 'admin' and accion = 'exportar'
);

-- 2) A cada rol se le concede `<modulo>.exportar` de los módulos que ya ve.
insert into roles_permisos (rol_id, permiso_id)
select distinct rp.rol_id, pe.id
from roles_permisos rp
join permisos pv on pv.id = rp.permiso_id and pv.accion = 'ver'
join permisos pe on pe.modulo = pv.modulo and pe.accion = 'exportar'
on conflict do nothing;
