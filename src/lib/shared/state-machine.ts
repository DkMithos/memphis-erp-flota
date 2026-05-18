/**
 * STATE MACHINE — Validador genérico de transiciones de estado
 * Usado por todos los módulos para prevenir transiciones ilegales
 */

export type TransitionMap<S extends string> = Partial<Record<S, S[]>>;

/**
 * Verifica si una transición de estado es válida
 */
export function isValidTransition<S extends string>(
  currentState: S,
  newState: S,
  allowedTransitions: TransitionMap<S>
): boolean {
  if (currentState === newState) return true; // no-op is always valid
  const allowed = allowedTransitions[currentState];
  return allowed ? allowed.includes(newState) : false;
}

/**
 * Valida una transición y lanza error descriptivo si no es válida
 */
export function validateTransition<S extends string>(
  currentState: S,
  newState: S,
  allowedTransitions: TransitionMap<S>,
  entityLabel?: string
): { valid: true } | { valid: false; error: string } {
  if (isValidTransition(currentState, newState, allowedTransitions)) {
    return { valid: true };
  }
  const allowed = allowedTransitions[currentState] ?? [];
  const label = entityLabel ?? 'Registro';
  return {
    valid: false,
    error: `${label}: no se puede cambiar de "${currentState}" a "${newState}". Transiciones permitidas: ${allowed.length ? allowed.join(', ') : 'ninguna (estado final)'}`,
  };
}

// ─── Transiciones por módulo ────────────────────────────────────

/** Flota — Órdenes de Trabajo */
export const OT_TRANSITIONS: TransitionMap<string> = {
  programada: ['en_ejecucion', 'espera_aprobacion', 'anulada'],
  espera_aprobacion: ['programada', 'anulada'],
  en_ejecucion: ['espera_repuesto', 'pausada', 'cerrada', 'anulada'],
  espera_repuesto: ['en_ejecucion', 'cerrada', 'anulada'],
  pausada: ['en_ejecucion', 'anulada'],
  cerrada: [], // estado final
  anulada: [], // estado final
};

/** Biomédico — Equipos */
export const EQUIPO_BIO_TRANSITIONS: TransitionMap<string> = {
  operativo: ['mantenimiento', 'fuera_servicio', 'calibracion', 'baja'],
  mantenimiento: ['operativo', 'fuera_servicio'],
  fuera_servicio: ['operativo', 'mantenimiento', 'baja'],
  calibracion: ['operativo', 'fuera_servicio'],
  baja: [], // estado final
};

/** Biomédico — Mantenimientos */
export const MANTENIMIENTO_BIO_TRANSITIONS: TransitionMap<string> = {
  programado: ['en_ejecucion', 'cancelado'],
  en_ejecucion: ['completado', 'cancelado', 'espera_repuesto'],
  espera_repuesto: ['en_ejecucion', 'cancelado'],
  completado: [], // estado final
  cancelado: [], // estado final
};

/** Compras — Requerimientos */
export const REQUERIMIENTO_TRANSITIONS: TransitionMap<string> = {
  borrador: ['pendiente', 'anulado'],
  pendiente: ['aprobado', 'rechazado', 'anulado'],
  aprobado: ['en_proceso', 'anulado'],
  en_proceso: ['completado', 'anulado'],
  rechazado: ['borrador'], // puede corregirse
  completado: [], // estado final
  anulado: [], // estado final
};

/** Compras — Cotizaciones */
export const COTIZACION_TRANSITIONS: TransitionMap<string> = {
  borrador: ['enviada', 'anulada'],
  enviada: ['recibida', 'anulada'],
  recibida: ['aprobada', 'rechazada'],
  aprobada: [], // estado final — genera orden
  rechazada: [],
  anulada: [],
};

/** Compras — Órdenes de Compra */
export const ORDEN_TRANSITIONS: TransitionMap<string> = {
  borrador: ['pendiente_aprobacion', 'anulada'],
  pendiente_aprobacion: ['aprobada', 'rechazada'],
  aprobada: ['en_ejecucion', 'anulada'],
  en_ejecucion: ['completada', 'anulada'],
  rechazada: ['borrador'], // puede corregirse
  completada: [], // estado final
  anulada: [], // estado final
};

/** CRM — Oportunidades (etapas pipeline) */
export const OPORTUNIDAD_TRANSITIONS: TransitionMap<string> = {
  prospecto: ['calificacion', 'perdida'],
  calificacion: ['propuesta', 'perdida'],
  propuesta: ['negociacion', 'perdida'],
  negociacion: ['cerrada_ganada', 'perdida'],
  cerrada_ganada: [], // estado final
  perdida: ['prospecto'], // puede reactivarse
};

/** Proyectos */
export const PROYECTO_TRANSITIONS: TransitionMap<string> = {
  planificacion: ['en_progreso', 'cancelado'],
  en_progreso: ['pausado', 'completado', 'cancelado'],
  pausado: ['en_progreso', 'cancelado'],
  completado: [], // estado final
  cancelado: [], // estado final
};
