/**
 * Carga diferida de módulos que sobrevive a un despliegue.
 *
 * El ERP parte en ~90 archivos que se piden bajo demanda, y cada uno lleva un
 * hash en el nombre. Cuando se publica una versión nueva, los archivos de la
 * anterior desaparecen: quien tenía el ERP abierto pide un archivo que ya no
 * está, la importación falla y el ErrorBoundary muestra "Ocurrió un error
 * inesperado". Le pasó a Kevin con el dashboard de Flota (09/09/2026) y le iba
 * a seguir pasando a cualquiera con el sistema abierto durante una publicación.
 *
 * La solución es recargar UNA vez: al recargar llega el index.html nuevo, con
 * los nombres nuevos, y todo sigue. Se marca en sessionStorage para que un
 * fallo de verdad —un módulo roto— no entre en un bucle de recargas: la segunda
 * vez el error sube al ErrorBoundary, que es lo correcto.
 */
import { lazy, type ComponentType } from 'react';

const MARCA = 'memphis:recarga-por-modulo';

/** sessionStorage puede lanzar en ventanas privadas; nunca debe tumbar la carga. */
const marca = {
  puesta(): boolean {
    try { return sessionStorage.getItem(MARCA) !== null; } catch { return false; }
  },
  poner() {
    try { sessionStorage.setItem(MARCA, String(Date.now())); } catch { /* sin storage, se sigue */ }
  },
  limpiar() {
    try { sessionStorage.removeItem(MARCA); } catch { /* idem */ }
  },
};

/**
 * ¿El fallo es "no encontré el archivo del módulo" y no un error del módulo?
 * Cada navegador lo redacta distinto, así que se buscan las tres formas
 * conocidas. Ante la duda NO se recarga: se deja ver el error.
 */
export function esFalloDeDescarga(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e ?? '');
  return /failed to fetch dynamically imported module/i.test(msg)  // Chrome, Edge
      || /error loading dynamically imported module/i.test(msg)    // Firefox
      || /importing a module script failed/i.test(msg)             // Safari
      || /dynamically imported module.*(404|not found)/i.test(msg);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Igual que `React.lazy`, pero con la recarga de cortesía descrita arriba. */
export function lazyModulo<T extends ComponentType<any>>(
  cargar: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const modulo = await cargar();
      marca.limpiar();          // cargó bien: la próxima vez puede reintentar
      return modulo;
    } catch (e) {
      if (esFalloDeDescarga(e) && !marca.puesta()) {
        marca.poner();
        window.location.reload();
        // No resuelve nunca: la página se está yendo. Evita pintar el error
        // medio segundo antes de la recarga.
        return new Promise<never>(() => {});
      }
      throw e;
    }
  });
}
