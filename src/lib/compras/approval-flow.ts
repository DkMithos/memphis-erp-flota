/**
 * FLUJO DE APROBACIÓN CONFIGURABLE — Memphis ERP
 * Permite definir 3 niveles de aprobación según monto total de la orden.
 * Config se almacena en localStorage por tenant (futuro: Supabase JSONB).
 */

// ============================================================================
// TIPOS
// ============================================================================

export interface NivelAprobacion {
  nivel: 1 | 2 | 3;
  label: string;
  descripcion: string;
  montoMin: number;        // en PEN
  montoMax: number | null; // en PEN, null = sin límite superior
  roles: string[];         // nombres de roles que pueden aprobar este nivel
  aprobadoresRequeridos: number;
}

export interface FlujoAprobacionConfig {
  tipoCambioRef: number;   // tipo de cambio PEN/USD de referencia
  niveles: [NivelAprobacion, NivelAprobacion, NivelAprobacion];
  updatedAt: string;
  updatedBy: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export const FLUJO_APROBACION_DEFAULT: FlujoAprobacionConfig = {
  tipoCambioRef: 3.75,
  niveles: [
    {
      nivel: 1,
      label: 'Aprobación Estándar',
      descripcion: 'Montos menores al umbral 1 — 1 aprobador',
      montoMin: 0,
      montoMax: 10000,
      roles: ['Gerencia', 'Admin Sistema'],
      aprobadoresRequeridos: 1,
    },
    {
      nivel: 2,
      label: 'Aprobación Gerencial',
      descripcion: 'Montos intermedios — 2 aprobadores',
      montoMin: 10000,
      montoMax: 30000,
      roles: ['Gerencia', 'Admin Sistema'],
      aprobadoresRequeridos: 2,
    },
    {
      nivel: 3,
      label: 'Alta Dirección',
      descripcion: 'Montos mayores al umbral 2 — alta dirección',
      montoMin: 30000,
      montoMax: null,
      roles: ['Admin Sistema'],
      aprobadoresRequeridos: 3,
    },
  ],
  updatedAt: new Date().toISOString(),
  updatedBy: 'sistema',
};

// ============================================================================
// PERSISTENCIA
// ============================================================================

const LS_KEY = 'memphis:flujo_aprobacion';

export function loadFlujoAprobacion(): FlujoAprobacionConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FlujoAprobacionConfig;
      // Ensure all 3 levels exist (migration-safe)
      if (parsed.niveles?.length === 3) return parsed;
    }
  } catch { /* ignore */ }
  return FLUJO_APROBACION_DEFAULT;
}

export function saveFlujoAprobacion(config: FlujoAprobacionConfig): void {
  localStorage.setItem(LS_KEY, JSON.stringify({ ...config, updatedAt: new Date().toISOString() }));
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Determina qué nivel de aprobación aplica para una orden dado su total.
 * Convierte a PEN si la orden es en USD.
 */
export function determinarNivelAprobacion(
  total: number,
  moneda: 'PEN' | 'USD',
  config: FlujoAprobacionConfig,
): NivelAprobacion {
  const totalPEN = moneda === 'USD' ? total * config.tipoCambioRef : total;
  const nivel = config.niveles.find(
    n => totalPEN >= n.montoMin && (n.montoMax === null || totalPEN < n.montoMax),
  );
  return nivel ?? config.niveles[2];
}

/**
 * Devuelve el color del badge según nivel de aprobación
 */
export function nivelAprobacionColor(nivel: 1 | 2 | 3): string {
  const map: Record<number, string> = {
    1: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    2: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    3: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };
  return map[nivel] ?? map[1];
}

/**
 * Formatea umbral de monto para display
 */
export function formatearUmbral(monto: number | null): string {
  if (monto === null) return 'Sin límite';
  return `S/ ${monto.toLocaleString('es-PE')}`;
}
