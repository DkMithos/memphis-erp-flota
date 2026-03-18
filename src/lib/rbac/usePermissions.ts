import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../supabase/client';

export type Modulo =
  | 'flota'
  | 'biomedico'
  | 'compras'
  | 'proveedores'
  | 'inventario'
  | 'finanzas'
  | 'crm'
  | 'proyectos'
  | 'admin';

export type Accion =
  | 'ver'
  | 'crear'
  | 'editar'
  | 'eliminar'
  | 'aprobar'
  | 'exportar'
  | 'gestionar_usuarios'
  | 'gestionar_roles';

interface PermisoEntry {
  modulo: string;
  accion: string;
}

export function usePermissions() {
  const { user, tenantId } = useAuth();
  const [permisos, setPermisos] = useState<PermisoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user || !tenantId) {
      setPermisos([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        // Fast path: admin role in JWT bypasses DB query
        const jwtRole = user?.app_metadata?.role;
        if (jwtRole === 'admin') {
          setIsAdmin(true);
          setPermisos([]);
          return;
        }

        // Cargar roles del usuario
        const { data: userRoles } = await supabase
          .from('usuarios_roles')
          .select('rol_id, roles(nombre, roles_permisos(permiso_id, permisos(modulo, accion)))')
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id);

        if (!userRoles) {
          setLoading(false);
          return;
        }

        // Flatten permisos
        const allPermisos: PermisoEntry[] = [];
        let adminFlag = false;

        for (const ur of userRoles) {
          const rol = ur.roles as unknown as {
            nombre: string;
            roles_permisos: Array<{
              permiso_id: string;
              permisos: { modulo: string; accion: string } | null;
            }>;
          } | null;
          if (!rol) continue;
          if (rol.nombre === 'Administrador') adminFlag = true;
          for (const rp of rol.roles_permisos ?? []) {
            const p = rp.permisos;
            if (p) allPermisos.push({ modulo: p.modulo, accion: p.accion });
          }
        }

        setIsAdmin(adminFlag);
        setPermisos(allPermisos);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, tenantId]);

  const can = useCallback(
    (modulo: Modulo, accion: Accion): boolean => {
      if (isAdmin) return true; // Admin bypass
      return permisos.some(p => p.modulo === modulo && p.accion === accion);
    },
    [permisos, isAdmin],
  );

  const canAny = useCallback(
    (modulo: Modulo, acciones: Accion[]): boolean => {
      if (isAdmin) return true;
      return acciones.some(a => can(modulo, a));
    },
    [can, isAdmin],
  );

  return { can, canAny, loading, isAdmin, permisos };
}
