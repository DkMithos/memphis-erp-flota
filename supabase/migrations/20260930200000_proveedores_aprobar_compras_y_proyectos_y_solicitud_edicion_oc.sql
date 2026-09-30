-- 1. Aprobar proveedores: lo hacen Compras (Richard) y Operaciones/Proyectos (Miguelángel).
--    Proyectos no tenía NINGÚN permiso de proveedores, así que se le da ver + aprobar.
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id
  from roles r cross join permisos p
 where r.nombre in ('Compras','Proyectos')
   and p.modulo = 'proveedores' and p.accion in ('ver','aprobar')
on conflict do nothing;

-- 2. Solicitud de edición de una orden ya enviada/aprobada (como en el sistema anterior):
--    Compras pide editar con un motivo; quien aprueba (compras.aprobar) autoriza o deniega.
--    Si autoriza, la orden vuelve a borrador y se reenvía a aprobación después de editarla.
alter table public.ordenes_compra add column if not exists solicitud_edicion jsonb;
comment on column public.ordenes_compra.solicitud_edicion is
  '{estado: pendiente|aprobada|rechazada, motivo, solicitado_por, solicitado_por_email, solicitado_en, resuelto_por, resuelto_por_email, resuelto_en, observacion}';
create index if not exists ordenes_compra_solicitud_edicion_pend_idx
  on public.ordenes_compra ((solicitud_edicion->>'estado')) where solicitud_edicion->>'estado' = 'pendiente';
notify pgrst, 'reload schema';
