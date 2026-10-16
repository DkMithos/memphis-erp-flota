-- 2026-10-16 · Kevin: "a cada personal solo le debe aparecer su propia información; solo a los jefes y Carolina les figura todo".
-- El rol Administrador (TI: Kevin, Adrián) deja de tener permisos del módulo viajes: administrar el sistema no es ser jefe de
-- nadie. Contabilidad tampoco ve todos los viajes. Quedan: Gerencia y Proyectos (jefatura) y Administración (Carolina).
-- En el frontend, usePermissions.can() deja de dar el comodín de Administrador para el módulo 'viajes'.
delete from roles_permisos rp using roles r, permisos p
 where rp.rol_id = r.id and rp.permiso_id = p.id and p.modulo = 'viajes'
   and r.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and r.nombre in ('Administrador', 'Contabilidad');
