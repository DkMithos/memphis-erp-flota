/**
 * RUTA → PERMISO REQUERIDO
 *
 * Única fuente de verdad de qué permiso hace falta para entrar a cada pantalla.
 * La usan el sidebar (para no mostrar lo que no se puede abrir) y App
 * (para bloquear de verdad si alguien teclea la URL).
 *
 * Regla general: la ruta `/<modulo>/...` exige `<modulo>.ver`.
 * Las excepciones son las rutas que un rol usa sin tener el módulo completo —
 * hoy solo Recepciones, que la usan Compras, Flota (jramirez) y Proyectos
 * (mcastaneda) sin darles el resto de Compras.
 */
import type { Modulo, Accion } from './usePermissions';

/** Una ruta es accesible si el usuario cumple AL MENOS UNA de estas parejas. */
export interface RequisitoRuta {
  modulo: Modulo;
  accion: Accion;
}

/** Rutas visibles para cualquier usuario con sesión y rol, sin permiso extra. */
const RUTAS_LIBRES = ['/home', '/', '', '/perfil', '/notificaciones', '/ayuda'];

/**
 * Excepciones ruta→permiso. Se evalúan por prefijo y gana la más específica,
 * por eso el orden importa: primero las más largas.
 */
const EXCEPCIONES: { prefijo: string; requisitos: RequisitoRuta[] }[] = [
  // Recepciones: Compras, Técnico Flota y Proyectos (N35)
  {
    prefijo: '/compras/recepciones',
    requisitos: [
      { modulo: 'compras', accion: 'ver' },
      { modulo: 'compras', accion: 'recepcionar' },
    ],
  },
  // Cargos de fianzas: Lisbet Monteza entra aquí con `fianzas.cargos` y sin
  // `fianzas.ver`, así que no ve montos ni el tablero. Mismo criterio que
  // Recepciones para Flota.
  {
    prefijo: '/fianzas/cargos',
    requisitos: [
      { modulo: 'fianzas', accion: 'cargos' },
      { modulo: 'fianzas', accion: 'ver' },
    ],
  },
  // Admin: cada pantalla pide su permiso fino
  { prefijo: '/admin/usuarios', requisitos: [{ modulo: 'admin', accion: 'gestionar_usuarios' }] },
  { prefijo: '/admin/roles', requisitos: [{ modulo: 'admin', accion: 'gestionar_roles' }] },
  { prefijo: '/admin', requisitos: [{ modulo: 'admin', accion: 'ver' }] },
  // BI cruza módulos: basta con poder ver alguno de los que reporta
  {
    prefijo: '/bi',
    requisitos: [
      { modulo: 'compras', accion: 'ver' },
      { modulo: 'finanzas', accion: 'ver' },
      { modulo: 'proyectos', accion: 'ver' },
      { modulo: 'flota', accion: 'ver' },
    ],
  },
  // El dashboard general lo ve cualquiera con rol
  { prefijo: '/dashboard', requisitos: [] },
];

/** Prefijo de ruta → módulo, para la regla general. */
const MODULO_POR_PREFIJO: { prefijo: string; modulo: Modulo }[] = [
  { prefijo: '/proveedores', modulo: 'proveedores' },
  { prefijo: '/compras', modulo: 'compras' },
  { prefijo: '/inventario', modulo: 'inventario' },
  { prefijo: '/contabilidad', modulo: 'contabilidad' },
  { prefijo: '/finanzas', modulo: 'finanzas' },
  { prefijo: '/fianzas', modulo: 'fianzas' },
  { prefijo: '/proyectos', modulo: 'proyectos' },
  { prefijo: '/flota', modulo: 'flota' },
  { prefijo: '/biomedico', modulo: 'biomedico' },
  { prefijo: '/crm', modulo: 'crm' },
];

/**
 * Qué se necesita para entrar a `ruta`.
 * - `[]` → libre para cualquiera con rol.
 * - lista → basta con cumplir UNA de las parejas.
 */
export function requisitosDeRuta(ruta: string): RequisitoRuta[] {
  const r = (ruta || '/').split('?')[0];
  if (RUTAS_LIBRES.includes(r)) return [];

  const exc = EXCEPCIONES.find(e => r === e.prefijo || r.startsWith(e.prefijo + '/'));
  if (exc) return exc.requisitos;

  const mod = MODULO_POR_PREFIJO.find(m => r === m.prefijo || r.startsWith(m.prefijo + '/'));
  return mod ? [{ modulo: mod.modulo, accion: 'ver' }] : [];
}

/** ¿Puede el usuario abrir esta ruta? `can` viene de usePermissions(). */
export function puedeVerRuta(
  ruta: string,
  can: (m: Modulo, a: Accion) => boolean,
): boolean {
  const req = requisitosDeRuta(ruta);
  if (req.length === 0) return true;
  return req.some(x => can(x.modulo, x.accion));
}
