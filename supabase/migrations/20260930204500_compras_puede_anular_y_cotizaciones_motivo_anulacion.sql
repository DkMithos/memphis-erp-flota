-- Compras (Richard) también anula órdenes, cotizaciones y requerimientos.
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r cross join permisos p
 where r.nombre = 'Compras' and p.modulo = 'compras' and p.accion = 'eliminar'
on conflict do nothing;

-- Anular una cotización escribía motivo_anulacion, pero la columna no existía
-- ("Could not find the 'motivo_anulacion' column of 'cotizaciones'"). Órdenes y
-- requerimientos sí la tienen.
alter table public.cotizaciones add column if not exists motivo_anulacion text;
comment on column public.cotizaciones.motivo_anulacion is 'Motivo de anulación (mínimo 30 caracteres, validado en el ERP)';
notify pgrst, 'reload schema';
