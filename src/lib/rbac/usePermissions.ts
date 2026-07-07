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
  // hasRole = el usuario tiene al menos un rol RBAC asignado (o es admin).
  // Se usa para el gate de acceso: sin rol → pantalla "cuenta pendiente".
  const [hasRole, setHasRole] = useState(false);

  useEffect(() => {
    if (!user) {
      setPermisos([]);
      setIsAdmin(false);
      setHasRole(false);
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
            setHasRole(true);
            setPermisos([]);
          }
          return;
        }

        // Fast path 2: profile.rol is superadmin or admin_empresa
        const profileRol = profile?.rol;
        if (profileRol === 'superadmin' || profileRol === 'admin_empresa') {
          if (mounted) {
            setIsAdmin(true);
            setHasRole(true);
            setPermisos([]);
          }
          return;
        }

        // Non-admin users need tenantId to query roles
        if (!tenantId) {
          if (mounted) { setPermisos([]); setHasRole(false); }
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
          setHasRole(false);
          return;
        }

        if (!userRoles || userRoles.length === 0) {
          // Sin roles asignados → el gate mostrará "cuenta pendiente"
          setPermisos([]);
          setHasRole(false);
          return;
        }

        // Tiene al menos un rol RBAC asignado
        setHasRole(true);

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

    // Safety timeout: si la consulta tarda, desbloquear la UI con el estado actual.
    // 8s: la consulta normal toma ~1.2s, pero con red lenta/varias pestañas 3s
    // provocaba falsos "cuenta pendiente de aprobación".
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn('[usePermissions] timeout — unblocking UI');
        setLoading(false);
      }
    }, 8000);

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

  return { can, canAny, loading, isAdmin, hasRole, permisos };
}
