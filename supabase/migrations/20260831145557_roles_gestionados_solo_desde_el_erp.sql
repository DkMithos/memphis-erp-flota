-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260831145557  name: roles_gestionados_solo_desde_el_erp

-- Kevin (31/08/2026): por ahora los roles se gestionan desde el ERP, no desde Entra.
-- Se desactiva el mapeo App Role → rol. Con el mapeo inactivo, ms-user-sync no puede
-- agregar ni retirar roles: el login con Microsoft sigue funcionando para AUTENTICAR,
-- pero la AUTORIZACIÓN queda íntegramente en usuarios_roles.
-- Para devolverle el gobierno a Entra basta con volver a poner activo = true.
update ms_approle_role_map set activo = false where activo;

select count(*) filter (where activo) mapeos_activos,
       count(*) mapeos_totales
from ms_approle_role_map;
