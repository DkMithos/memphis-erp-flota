/**
 * Logger condicionado por entorno.
 *
 * En desarrollo (import.meta.env.DEV): todos los niveles van a la consola.
 * En producción: `debug` e `info` se silencian para no exponer datos
 * sensibles ni llenar la consola del navegador; `warn` y `error` se
 * mantienen (y se reenvían a Sentry si está configurado).
 *
 * Uso:
 *   import { logger } from '@/lib/shared/logger';
 *   logger.debug('[auth] sesión recuperada', email);   // solo en DEV
 *   logger.error('[ordenes] fallo al guardar', err);   // siempre + Sentry
 */

const isDev = import.meta.env.DEV;

type LogArgs = unknown[];

// Hook opcional para Sentry u otro monitor (se inyecta en main.tsx si existe)
let errorReporter: ((error: unknown, context?: unknown) => void) | null = null;

export function setErrorReporter(fn: (error: unknown, context?: unknown) => void) {
  errorReporter = fn;
}

export const logger = {
  /** Detalle de depuración — SOLO visible en desarrollo. */
  debug(...args: LogArgs): void {
    if (isDev) console.log(...args);
  },

  /** Información general — SOLO visible en desarrollo. */
  info(...args: LogArgs): void {
    if (isDev) console.info(...args);
  },

  /** Advertencia — visible siempre. */
  warn(...args: LogArgs): void {
    console.warn(...args);
  },

  /** Error — visible siempre + reportado al monitor si está configurado. */
  error(...args: LogArgs): void {
    console.error(...args);
    if (errorReporter && args.length > 0) {
      try {
        errorReporter(args[0], args.slice(1));
      } catch {
        /* nunca dejar que el reporte de errores rompa la app */
      }
    }
  },
};
