-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260916164857  name: modulo_documentos_carpetas_de_sharepoint

-- DOCUMENTOS: VER Y DESCARGAR CARPETAS DE SHAREPOINT DESDE EL ERP.
--
-- Shirley necesita mirar y bajarse los archivos del expediente OXI sin salir
-- del sistema. Nada más: no hay que enlazarlos con proyectos ni con órdenes —
-- ella se entiende con esos documentos.
--
-- NO SE COPIAN LOS ARCHIVOS. El ERP lista la carpeta de SharePoint en vivo y
-- pide a Microsoft un enlace de descarga de un solo uso cuando alguien pulsa.
-- Copiarlos habría significado duplicar 96 MB y montar una sincronización que
-- se queda vieja; así lo que se ve es siempre lo que hay en Teams, que es
-- exactamente lo que se pidió.

create table if not exists documentos_carpetas (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  -- Identificadores de Graph. `ruta` es solo para que un humano sepa dónde
  -- está; lo que se usa es el par drive/item, que sobrevive a un renombrado.
  drive_id    text not null,
  item_id     text not null,
  ruta        text,
  orden       int  not null default 0,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  unique (tenant_id, nombre)
);

comment on table documentos_carpetas is
  'Carpetas de SharePoint que el ERP deja mirar y descargar. Los archivos NO se copian: se listan en vivo.';

alter table documentos_carpetas enable row level security;

drop policy if exists documentos_carpetas_tenant on documentos_carpetas;
create policy documentos_carpetas_tenant on documentos_carpetas
  for select using (tenant_id = auth_tenant_id());

-- Permisos del módulo nuevo.
insert into permisos (modulo, accion)
values ('documentos', 'ver'), ('documentos', 'exportar')
on conflict do nothing;

-- Quien ya lleva papeles hoy: Administración, Fianzas y Compras.
-- (El rol Administrador entra por ser admin, no por la tabla.)
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id
from roles r
cross join permisos p
where p.modulo = 'documentos'
  and r.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
  and r.nombre in ('Administración', 'Fianzas', 'Compras', 'Contabilidad')
on conflict do nothing;

-- La carpeta de Shirley.
insert into documentos_carpetas (tenant_id, nombre, descripcion, drive_id, item_id, ruta, orden)
values (
  'e4b16a80-8500-418e-afaa-0e976b7d9b13',
  'Facturas y CIPRL — Proyectos OXI',
  'Expediente por proyecto: cartas y estado del CIPRL, facturas por proveedor y la cadena ejecutor-financista.',
  'b!V85_UPSrhUqJJYUo_mqnQEHh-2rHBSRNsbP7LCuMNv0hQS7FEUoLTZP11gFbNxoB',
  '014MUEHVI36DDUB6U4CVGLF37CAJCMVPHXC',
  'COMPRAS / General / 05. ARCHIVOS VARIOS / Resumen Facturas y CIPRL - Proyectos OXI',
  1
)
on conflict (tenant_id, nombre) do update
  set drive_id = excluded.drive_id, item_id = excluded.item_id,
      ruta = excluded.ruta, descripcion = excluded.descripcion, activo = true;
