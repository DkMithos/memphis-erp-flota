-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260703144626  name: fix_usuarios_roles_embed_fk

-- 1) Reparar usuario huérfano: osalazar tiene rol pero no ficha en usuarios_tenant
INSERT INTO usuarios_tenant (tenant_id, user_id, nombre, email, estado)
SELECT ur.tenant_id, ur.user_id,
       coalesce(u.raw_user_meta_data->>'nombre', split_part(u.email,'@',1)),
       u.email, 'activo'
FROM usuarios_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE NOT EXISTS (SELECT 1 FROM usuarios_tenant ut
                  WHERE ut.tenant_id = ur.tenant_id AND ut.user_id = ur.user_id)
ON CONFLICT DO NOTHING;

-- 2) FK compuesta para que PostgREST pueda embeber usuarios_tenant -> usuarios_roles
--    (Gestión de Usuarios hacía select '*, usuarios_roles(rol_id, roles(*))' y devolvía 400)
DO $$ BEGIN
  ALTER TABLE usuarios_roles
    ADD CONSTRAINT usuarios_roles_usuario_tenant_fkey
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES usuarios_tenant (tenant_id, user_id)
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Recargar el schema cache de PostgREST
NOTIFY pgrst, 'reload schema';
