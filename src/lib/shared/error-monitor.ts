/**
 * Monitor de errores global.
 *
 * Captura errores no manejados (`window.onerror`) y promesas rechazadas
 * sin catch (`unhandledrejection`) que de otro modo aparecerían como
 * trazas rojas crudas en la consola. Los centraliza vía `logger.error`,
 * que ya está preparado para reenviar a Sentry u otro monitor.
 *
 * Para integrar Sentry en el futuro: instalar @sentry/react, inicializarlo
 * en main.tsx y llamar `setErrorReporter(Sentry.captureException)`.
 *
 * Se inicializa una sola vez desde main.tsx con `initErrorMonitor()`.
 */

import { logger } from './logger';

let initialized = false;

// Deduplicación: evita spamear el mismo error N veces por segundo
const recent = new Map<string, number>();
const DEDUPE_MS = 5000;

function shouldReport(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUPE_MS) return false;
  recent.set(key, now);
  // Limpieza periódica para no crecer sin límite
  if (recent.size > 100) {
    for (const [k, t] of recent) {
      if (now - t > DEDUPE_MS) recent.delete(k);
    }
  }
  return true;
}

export function initErrorMonitor(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => {
    const msg = event.message ?? 'Error desconocido';
    const key = `error:${msg}:${event.filename}:${event.lineno}`;
    if (!shouldReport(key)) return;
    logger.error('[global.error]', msg, {
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
      error: event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    const key = `rejection:${msg}`;
    if (!shouldReport(key)) return;
    logger.error('[global.unhandledRejection]', msg, reason);
  });
}
