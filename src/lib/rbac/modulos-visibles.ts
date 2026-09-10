/**
 * QUÉ MÓDULOS VE ESTE USUARIO — una sola respuesta para todo el sistema.
 *
 * Existe porque la respuesta estaba escrita en varios sitios y no coincidían:
 * el menú la calculaba con RBAC, y el tutorial de bienvenida la tenía escrita a
 * mano ("Flota, Biomédico, Compras, Inventario, Finanzas y más"), así que a
 * Richard —que solo tiene Compras y Proveedores— el sistema le presentaba
 * módulos que no puede abrir.
 *
 * Un módulo se ve cuando se cumplen las dos cosas:
 *   1. el tenant lo tiene encendido (`modules_config`), y
 *   2. el usuario tiene permiso para entrar a su ruta (RBAC).
 */
import { loadModulesConfig, type ModuleConfig } from '../config/modules-config';
import { puedeVerRuta } from './rutas';
import type { Modulo, Accion } from './usePermissions';

export interface ModuloVisible {
  id: string;
  label: string;
  descripcion: string;
}

/** El tablero no es un módulo de trabajo: resume los demás, no se enumera. */
const NO_SE_ENUMERAN = new Set(['dashboard']);

export function modulosDelUsuario(
  can: (modulo: Modulo, accion: Accion) => boolean,
  config: ModuleConfig[] = loadModulesConfig(),
): ModuloVisible[] {
  return config
    .filter(m => m.enabled)
    .filter(m => !NO_SE_ENUMERAN.has(m.id))
    .filter(m => puedeVerRuta(`/${m.id}`, can))
    .map(({ id, label, descripcion }) => ({ id, label, descripcion }));
}

/**
 * "Compras", "Compras y Proveedores", "Compras, Proveedores y Finanzas".
 *
 * En castellano la última va con "y", no con coma. Se lee en una frase, así que
 * la puntuación importa más de lo que parece.
 */
export function enumerar(nombres: string[]): string {
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}
