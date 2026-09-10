/**
 * PERMISOS DEL USUARIO — una sola consulta para toda la aplicación.
 *
 * Antes esto era un hook con estado propio, y lo llaman 39 componentes: cada
 * uno lanzaba su consulta a `usuarios_roles` y arrancaba en `loading: true`.
 * Además el efecto dependía del objeto `profile`, que AuthProvider vuelve a
 * crear cada vez que refresca el token: bastaba eso para que TODOS volvieran a
 * "cargando" y el menú enseñara de golpe módulos que el usuario no puede abrir.
 * Era el parpadeo que se veía al entrar y, de rato en rato, ya trabajando.
 *
 * Ahora el resultado vive en un solo sitio, fuera de React, y los componentes
 * se suscriben. La consulta se hace una vez por usuario+tenant. Si el objeto
 * `profile` cambia de identidad pero el usuario es el mismo, no se vuelve a
 * consultar ni se vuelve a "cargando": lo que ya se sabe sigue valiendo.
 *
 * La API del hook no cambió — los 39 llamadores siguen igual.
 */
import { useEffect, useSyncExternalStore, useCallback } from 'react';
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
  | 'contabilidad'
  | 'fianzas'
  | 'admin';

export type Accion =
  | 'ver'
  | 'crear'
  | 'editar'
  | 'eliminar'
  | 'aprobar'
  | 'exportar'
  | 'recepcionar'
  | 'cargos'
  | 'gestionar_usuarios'
  | 'gestionar_roles';

interface PermisoEntry {
  modulo: string;
  accion: string;
}

interface EstadoPermisos {
  permisos: PermisoEntry[];
  isAdmin: boolean;
  /** Tiene al menos un rol RBAC asignado (o es admin). */
  hasRole: boolean;
  /**
   * La consulta RESPONDIÓ y devolvió cero roles. El gate de "cuenta pendiente"
   * SOLO debe usar esto — un timeout o un error de red no es evidencia de falta
   * de rol (antes producía falsos "pendiente de aprobación").
   */
  sinRolConfirmado: boolean;
  /** Todavía no sabemos qué puede ver este usuario. */
  loading: boolean;
  /**
   * Todos sus roles piden que solo se le avise de lo que tiene que aprobar.
   * Es "todos" y no "alguno": si además tiene un rol normal, ese manda y
   * seguirá recibiendo lo suyo.
   */
  soloNotificaAprobaciones: boolean;
}

const SIN_RESPUESTA: EstadoPermisos = {
  permisos: [],
  isAdmin: false,
  hasRole: false,
  sinRolConfirmado: false,
  loading: true,
  soloNotificaAprobaciones: false,
};

// ── Estado compartido ───────────────────────────────────────────────────────
let estado: EstadoPermisos = SIN_RESPUESTA;
/** usuario+tenant+rol del perfil: si no cambia, no hay nada que volver a pedir. */
let claveCargada: string | null = null;
let enVuelo = false;
const oyentes = new Set<() => void>();

function publicar(cambios: Partial<EstadoPermisos>) {
  estado = { ...estado, ...cambios };
  oyentes.forEach(avisar => avisar());
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => { oyentes.delete(avisar); };
}

const leer = () => estado;

/**
 * Identidad del usuario a efectos de permisos, **por valor**.
 *
 * Aquí estaba el parpadeo: el efecto dependía del objeto `profile`, y
 * AuthProvider lo vuelve a crear en cada refresco de token. Un objeto nuevo con
 * los mismos datos no cambia lo que el usuario puede ver, así que la clave se
 * arma con los valores que sí importan.
 */
export function clavePermisos(
  user: { id: string } | null | undefined,
  tenantId: string | null | undefined,
  profile: { rol?: string | null } | null | undefined,
): string | null {
  if (!user) return null;
  return `${user.id}|${tenantId ?? ''}|${profile?.rol ?? ''}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function consultar(user: any, profile: any, tenantId: string | null, intento = 1) {
  // Atajo 1: el rol admin viaja en el JWT, no hace falta consultar nada.
  if (user?.app_metadata?.role === 'admin') {
    publicar({ isAdmin: true, hasRole: true, sinRolConfirmado: false, permisos: [], loading: false });
    return;
  }

  // Atajo 2: el perfil ya dice que es administrador de la empresa.
  if (profile?.rol === 'superadmin' || profile?.rol === 'admin_empresa') {
    publicar({ isAdmin: true, hasRole: true, sinRolConfirmado: false, permisos: [], loading: false });
    return;
  }

  // Sin tenant (el perfil aún carga o falló) el estado es INDETERMINADO: no se
  // confirma "sin rol" y se deja la clave sin marcar para reintentar al llegar.
  if (!tenantId) {
    claveCargada = null;
    publicar({ permisos: [], isAdmin: false, hasRole: false, sinRolConfirmado: false, loading: false });
    return;
  }

  const { data: userRoles, error } = await supabase
    .from('usuarios_roles')
    .select('rol_id, roles(nombre, solo_notifica_aprobaciones, roles_permisos(permiso_id, permisos(modulo, accion)))')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[usePermissions] Error al cargar roles:', error.message);
    // Un error de red no es "sin rol": se reintenta y nunca se manda a pendiente.
    if (intento < 2) {
      // `enVuelo` sigue en alto hasta que el reintento termine, para que otro
      // componente que se monte entretanto no lance una carga en paralelo.
      setTimeout(() => {
        void consultar(user, profile, tenantId, intento + 1).finally(() => { enVuelo = false; });
      }, 2000);
      return;
    }
    // Nos rendimos: se olvida la clave para poder reintentar más adelante.
    claveCargada = null;
    publicar({ permisos: [], isAdmin: false, hasRole: false, sinRolConfirmado: false, loading: false });
    return;
  }

  if (!userRoles || userRoles.length === 0) {
    // CONFIRMADO por la consulta: cero roles → gate de "cuenta pendiente".
    publicar({ permisos: [], isAdmin: false, hasRole: false, sinRolConfirmado: true, loading: false });
    return;
  }

  const permisos: PermisoEntry[] = [];
  let esAdmin = false;
  const marcas: boolean[] = [];

  for (const ur of userRoles as any[]) {
    const rol = ur.roles as {
      nombre: string;
      solo_notifica_aprobaciones?: boolean;
      roles_permisos: Array<{ permiso_id: string; permisos: { modulo: string; accion: string } | null }>;
    } | null;
    if (!rol) continue;
    if (rol.nombre === 'Administrador') esAdmin = true;
    marcas.push(rol.solo_notifica_aprobaciones === true);
    for (const rp of rol.roles_permisos ?? []) {
      if (rp.permisos) permisos.push({ modulo: rp.permisos.modulo, accion: rp.permisos.accion });
    }
  }

  publicar({
    permisos,
    isAdmin: esAdmin,
    hasRole: true,
    sinRolConfirmado: false,
    loading: false,
    soloNotificaAprobaciones: marcas.length > 0 && marcas.every(Boolean),
  });
}

/**
 * Pide los permisos si hacen falta. Si la clave no cambió, no hace nada: ni
 * consulta de más ni vuelta a "cargando" — que es lo que hacía parpadear el
 * menú cada vez que se refrescaba el token.
 */
function asegurarCarga(clave: string | null, user: any, profile: any, tenantId: string | null) {
  if (!clave) {
    // Sesión cerrada: se olvida todo y se deja de "cargar".
    claveCargada = null;
    enVuelo = false;
    estado = { ...SIN_RESPUESTA, loading: false };
    oyentes.forEach(avisar => avisar());
    return;
  }

  if (clave === claveCargada || enVuelo) return;

  claveCargada = clave;
  enVuelo = true;
  publicar({ loading: true });

  // Red de seguridad: si la consulta se cuelga, no dejar la interfaz bloqueada.
  const alarma = setTimeout(() => {
    if (enVuelo) {
      console.warn('[usePermissions] la consulta tardó demasiado — se desbloquea la interfaz');
      enVuelo = false;
      claveCargada = null;
      publicar({ loading: false });
    }
  }, 8000);

  void consultar(user, profile, tenantId).finally(() => {
    clearTimeout(alarma);
    // Si hay un reintento programado, él bajará la bandera al terminar.
    if (!estado.loading) enVuelo = false;
  });
}

export function usePermissions() {
  const { user, profile, tenantId } = useAuth();
  const snapshot = useSyncExternalStore(suscribir, leer);

  // La clave es por VALOR, no por identidad de objeto: `profile` se vuelve a
  // crear en cada refresco de token y eso no cambia lo que el usuario puede ver.
  const clave = clavePermisos(user, tenantId, profile);

  useEffect(() => {
    asegurarCarga(clave, user, profile, tenantId);
    // `user`/`profile` van fuera de las dependencias a propósito: solo se usan
    // como datos de la consulta que `clave` ya identifica.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const { permisos, isAdmin, hasRole, sinRolConfirmado, loading, soloNotificaAprobaciones } = snapshot;

  const can = useCallback(
    (modulo: Modulo, accion: Accion): boolean => {
      if (isAdmin) return true;
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

  return { can, canAny, loading, isAdmin, hasRole, sinRolConfirmado, permisos, soloNotificaAprobaciones };
}
