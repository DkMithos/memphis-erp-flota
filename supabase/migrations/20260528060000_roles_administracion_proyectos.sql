-- ===========================================================================
-- Dos roles ERP nuevos para cubrir App Roles de Entra ID sin equivalente previo:
--   - "Administración" → compras + caja chica + finanzas (App Role 'Administracion')
--   - "Proyectos"      → módulo proyectos + ver finanzas/compras (App Role 'Proyectos')
-- Idempotente (NOT EXISTS) — sin ON CONFLICT.
-- ===========================================================================

-- Rol "Administración"
INSERT INTO roles (tenant_id, nombre, descripcion, es_sistema)
SELECT 'e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Administración',
       'Gestión de compras, caja chica y finanzas', false
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND nombre='Administración'
);

-- Rol "Proyectos"
INSERT INTO roles (tenant_id, nombre, descripcion, es_sistema)
SELECT 'e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Proyectos',
       'Gestión del módulo de proyectos', false
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND nombre='Proyectos'
);

-- Permisos de Administración: compras + finanzas (ver/crear/editar/aprobar/exportar)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permisos p
WHERE r.tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND r.nombre='Administración'
  AND (
    (p.modulo='compras'  AND p.accion IN ('ver','crear','editar','aprobar','exportar')) OR
    (p.modulo='finanzas' AND p.accion IN ('ver','crear','editar','aprobar','exportar'))
  )
  AND NOT EXISTS (SELECT 1 FROM roles_permisos rp WHERE rp.rol_id=r.id AND rp.permiso_id=p.id);

-- Permisos de Proyectos: proyectos completo + ver finanzas + ver compras
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permisos p
WHERE r.tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND r.nombre='Proyectos'
  AND (
    (p.modulo='proyectos' AND p.accion IN ('ver','crear','editar','aprobar','exportar')) OR
    (p.modulo='finanzas'  AND p.accion='ver') OR
    (p.modulo='compras'   AND p.accion='ver')
  )
  AND NOT EXISTS (SELECT 1 FROM roles_permisos rp WHERE rp.rol_id=r.id AND rp.permiso_id=p.id);

-- Mapeo App Role 'Administracion' → rol Administración
INSERT INTO ms_approle_role_map (tenant_id, app_role_value, rol_id)
SELECT 'e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Administracion', r.id
FROM roles r
WHERE r.tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND r.nombre='Administración'
  AND NOT EXISTS (
    SELECT 1 FROM ms_approle_role_map m
    WHERE m.tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND m.app_role_value='Administracion' AND m.rol_id=r.id
  );

-- Mapeo App Role 'Proyectos' → rol Proyectos
INSERT INTO ms_approle_role_map (tenant_id, app_role_value, rol_id)
SELECT 'e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Proyectos', r.id
FROM roles r
WHERE r.tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND r.nombre='Proyectos'
  AND NOT EXISTS (
    SELECT 1 FROM ms_approle_role_map m
    WHERE m.tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' AND m.app_role_value='Proyectos' AND m.rol_id=r.id
  );
