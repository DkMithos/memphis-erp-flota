/**
 * Inicialización de Sentry (monitoreo de errores en producción).
 *
 * Defensivo: si no hay `VITE_SENTRY_DSN` configurado, Sentry NO se inicializa
 * (no-op). Esto permite tener el código listo en el repo sin romper entornos
 * que aún no tienen el DSN, y activarlo simplemente seteando la variable.
 *
 * Para activar:
 *   1. Crear un proyecto React en Sentry → copiar su DSN.
 *   2. Setear VITE_SENTRY_DSN en Vercel (y en .env.local para pruebas).
 *
 * Conecta también `setErrorReporter` para que `logger.error` y el
 * `error-monitor` global reenvíen automáticamente a Sentry.
 */

import * as Sentry from '@sentry/react';
import { setErrorReporter } from './logger';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

  // Sin DSN → no se activa (entornos sin Sentry configurado)
  if (!dsn) return;

  // Solo en producción para no ensuciar la cuenta con errores de desarrollo
  if (!import.meta.env.PROD) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Muestreo de performance conservador (10%) para no consumir cuota
    tracesSampleRate: 0.1,
    // Captura de sesiones con error para reproducir (replay)
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
  });

  // Enlazar el logger y el monitor global con Sentry
  setErrorReporter((error: unknown, context?: unknown) => {
    Sentry.captureException(error, context ? { extra: { context } } : undefined);
  });
}
