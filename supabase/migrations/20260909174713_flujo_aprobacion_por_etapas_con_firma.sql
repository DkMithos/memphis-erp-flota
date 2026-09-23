-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260909174713  name: flujo_aprobacion_por_etapas_con_firma

-- El circuito real de Memphis es comprador → operaciones → gerencia, con firmas
-- distintas. El ERP aprobaba con UNA sola firma aunque el nivel pidiera 2 o 3:
-- el primer clic cerraba la orden.
--
-- Se pasa de "cuántos aprobadores hacen falta" a "QUÉ ETAPAS deben firmar", que
-- es como funciona de verdad y es lo que el PDF ya sabe imprimir.
--
--   · comprador   — quien la generó (Richard). Evidencia de autoría, no
--                   aprobación: por eso Compras ya no necesita 'aprobar'.
--   · operaciones — Miguelangel. En la oficina es Proyectos; en el circuito de
--                   compras es Operaciones.
--   · gerencia    — Guillermo, William o cualquiera con el rol Gerencia.
--
-- Umbrales: los que ya estaban. Bajo S/ 10,000 firman comprador y operaciones;
-- a partir de ahí entra Gerencia.
update flujo_aprobacion
   set config = jsonb_build_object(
     'niveles', jsonb_build_array(
       jsonb_build_object(
         'nivel', 1, 'label', 'Aprobación Estándar',
         'montoMin', 0, 'montoMax', 10000,
         'descripcion', 'Hasta el umbral 1 — firman comprador y operaciones',
         'etapas', jsonb_build_array('comprador', 'operaciones')
       ),
       jsonb_build_object(
         'nivel', 2, 'label', 'Aprobación Gerencial',
         'montoMin', 10000, 'montoMax', 30000,
         'descripcion', 'Montos intermedios — suma la firma de Gerencia',
         'etapas', jsonb_build_array('comprador', 'operaciones', 'gerencia')
       ),
       jsonb_build_object(
         'nivel', 3, 'label', 'Alta Dirección',
         'montoMin', 30000, 'montoMax', null,
         'descripcion', 'Montos mayores — comprador, operaciones y Gerencia',
         'etapas', jsonb_build_array('comprador', 'operaciones', 'gerencia')
       )
     ),
     'rolesPorEtapa', jsonb_build_object(
       'comprador',   jsonb_build_array('Compras'),
       'operaciones', jsonb_build_array('Proyectos', 'Operador'),
       'gerencia',    jsonb_build_array('Gerencia')
     ),
     'tipoCambioRef', 3.40
   ),
   actualizado_en = now(),
   actualizado_por = 'migracion:flujo_por_etapas'
 where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';

-- Richard genera y FIRMA como comprador, pero no aprueba.
delete from roles_permisos rp
 using roles r, permisos p
 where rp.rol_id = r.id and rp.permiso_id = p.id
   and r.nombre = 'Compras' and p.modulo = 'compras' and p.accion = 'aprobar';

-- Operaciones (Miguelangel, rol Proyectos) sí aprueba compras: hasta ahora no
-- tenía ningún permiso sobre el módulo.
insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id
from roles r, permisos p
where r.nombre = 'Proyectos' and p.modulo = 'compras' and p.accion in ('ver', 'aprobar')
  and not exists (select 1 from roles_permisos x where x.rol_id = r.id and x.permiso_id = p.id);
