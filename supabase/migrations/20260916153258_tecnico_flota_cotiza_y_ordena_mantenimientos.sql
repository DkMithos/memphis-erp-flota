-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260916153258  name: tecnico_flota_cotiza_y_ordena_mantenimientos

-- EL TÉCNICO DE FLOTA COTIZA Y GENERA SUS ÓRDENES DE MANTENIMIENTO.
--
-- Los mantenimientos de vehículos son los que más órdenes generan y los que
-- menos decisión tienen: el precio ya está acordado con el taller. Hacer que
-- pasen por Compras para copiar unas cifras que no cambian carga de trabajo al
-- comprador y retrasa la camioneta.
--
-- Se le dan a Técnico Flota los permisos de Compras que hacen falta para
-- cotizar y ordenar. Lo tienen José Ramírez y Miguelangel Castañeda.
--
-- OJO, Y ESTO HAY QUE SABERLO: el RBAC no sabe distinguir "una orden de
-- mantenimiento de flota" de "una orden cualquiera". Con estos permisos pueden
-- generar cualquier orden, no solo las de su flota. Lo que NO cambia es el
-- control del gasto: toda orden sigue pasando por el flujo de montos, y a
-- partir de cierto importe la firma Gerencia. Si más adelante hace falta
-- acotarlo de verdad, hay que meter la dimensión de módulo en el RBAC —
-- hoy no existe.
--
-- No se les da `aprobar`: quien pide no firma lo que pide.

insert into roles_permisos (rol_id, permiso_id)
select '0c7e075f-fa06-4aa9-9195-5731beb5d87f'::uuid, p.id
from permisos p
where p.modulo = 'compras' and p.accion in ('ver', 'crear', 'editar')
on conflict do nothing;
