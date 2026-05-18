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
  const { user, profile, tenantId } = useAuth();
  const [permisos, setPermisos] = useState<PermisoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setPermisos([]);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        // Fast path 1: admin role in JWT bypasses DB query
        const jwtRole = user?.app_metadata?.role;
        if (jwtRole === 'admin') {
          if (mounted) {
            setIsAdmin(true);
            setPermisos([]);
          }
          return;
        }

        // Fast path 2: profile.rol is superadmin or admin_empresa
        const profileRol = profile?.rol;
        if (profileRol === 'superadmin' || profileRol === 'admin_empresa') {
          if (mounted) {
            setIsAdmin(true);
            setPermisos([]);
          }
          return;
        }

        // Non-admin users need tenantId to query roles
        if (!tenantId) {
          if (mounted) setPermisos([]);
          return;
        }

        // Cargar roles del usuario desde DB
        const { data: userRoles, error } = await supabase
          .from('usuarios_roles')
          .select('rol_id, roles(nombre, roles_permisos(permiso_id, permisos(modulo, accion)))')
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id);

        if (!mounted) return;

        if (error) {
          console.error('[usePermissions] Error loading roles:', error.message);
          // Fallback: si hay error en la consulta, verificar si el email es admin conocido
          setPermisos([]);
          return;
        }

        if (!userRoles || userRoles.length === 0) {
          // No roles assigned — could be first user / admin without DB roles
          setPermisos([]);
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

        if (mounted) {
          setIsAdmin(adminFlag);
          setPermisos(allPermisos);
        }
      } catch (err) {
        console.error('[usePermissions] Unexpected error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Safety timeout: if query takes >3s, unblock with current state
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn('[usePermissions] timeout — unblocking UI');
        setLoading(false);
      }
    }, 3000);

    load().finally(() => clearTimeout(safetyTimer));

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
    };
  }, [user, profile, tenantId]);

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
