/**
 * FLUJO DE APROBACIÓN — Memphis ERP
 *
 * El circuito real es **comprador → operaciones → gerencia**, con firmas
 * distintas, y el monto decide cuántas hacen falta. Antes esto se expresaba
 * como "N aprobadores" y el ERP daba la orden por aprobada con UNA sola firma,
 * aunque el nivel pidiera dos o tres.
 *
 * Ahora cada nivel declara QUÉ ETAPAS deben firmar, que es como funciona de
 * verdad y es lo que el PDF ya sabe imprimir.
 *
 * La configuración vive en la tabla `flujo_aprobacion` (jsonb), no en el
 * navegador: es una política de la empresa, no una preferencia de cada usuario.
 */

// ============================================================================
// TIPOS
// ============================================================================

/** Las tres etapas del circuito de compras. */
export type EtapaAprobacion = 'comprador' | 'operaciones' | 'gerencia';

export const ETIQUETA_ETAPA: Record<EtapaAprobacion, string> = {
  comprador: 'Comprador',
  operaciones: 'Operaciones',
  gerencia: 'Gerencia',
};

export interface NivelAprobacion {
  nivel: 1 | 2 | 3;
  label: string;
  descripcion: string;
  montoMin: number;        // en PEN
  montoMax: number | null; // en PEN, null = sin límite superior
  /** Etapas que deben firmar para que la orden quede aprobada. */
  etapas: EtapaAprobacion[];
  /** @deprecated Se conserva para leer configuraciones antiguas. */
  roles?: string[];
  /** @deprecated Reemplazado por `etapas`. */
  aprobadoresRequeridos?: number;
}

export interface FlujoAprobacionConfig {
  tipoCambioRef: number;   // tipo de cambio PEN/USD de referencia
  niveles: [NivelAprobacion, NivelAprobacion, NivelAprobacion];
  /** Qué roles del ERP pueden firmar cada etapa. */
  rolesPorEtapa: Record<EtapaAprobacion, string[]>;
  updatedAt: string;
  updatedBy: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export const FLUJO_APROBACION_DEFAULT: FlujoAprobacionConfig = {
  tipoCambioRef: 3.40,
  niveles: [
    {
      nivel: 1,
      label: 'Aprobación Estándar',
      descripcion: 'Hasta el umbral 1 — firman comprador y operaciones',
      montoMin: 0,
      montoMax: 10000,
      etapas: ['comprador', 'operaciones'],
    },
    {
      nivel: 2,
      label: 'Aprobación Gerencial',
      descripcion: 'Montos intermedios — suma la firma de Gerencia',
      montoMin: 10000,
      montoMax: 30000,
      etapas: ['comprador', 'operaciones', 'gerencia'],
    },
    {
      nivel: 3,
      label: 'Alta Dirección',
      descripcion: 'Montos mayores — comprador, operaciones y Gerencia',
      montoMin: 30000,
      montoMax: null,
      etapas: ['comprador', 'operaciones', 'gerencia'],
    },
  ],
  rolesPorEtapa: {
    comprador: ['Compras'],
    operaciones: ['Proyectos', 'Operador'],
    gerencia: ['Gerencia'],
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'sistema',
};

// ============================================================================
// PERSISTENCIA
// ============================================================================

/**
 * La configuración vive en la tabla `flujo_aprobacion`. Antes se guardaba en
 * localStorage: cada navegador tenía la suya y nadie compartía la política de
 * la empresa — lo que Kevin configuraba no lo veía Richard.
 *
 * Se cachea en memoria durante la sesión para no consultar en cada pantalla.
 */
let cache: FlujoAprobacionConfig | null = null;

/** Normaliza lo que venga de la base, tolerando configuraciones antiguas. */
export function normalizarConfig(raw: unknown): FlujoAprobacionConfig {
  const c = (raw ?? {}) as Partial<FlujoAprobacionConfig>;
  const niveles = (c.niveles ?? FLUJO_APROBACION_DEFAULT.niveles).map((n, i) => ({
    ...FLUJO_APROBACION_DEFAULT.niveles[i],
    ...n,
    // Una configuración vieja no trae etapas: se usan las del nivel equivalente.
    etapas: n.etapas?.length ? n.etapas : FLUJO_APROBACION_DEFAULT.niveles[i].etapas,
  })) as FlujoAprobacionConfig['niveles'];

  return {
    tipoCambioRef: c.tipoCambioRef ?? FLUJO_APROBACION_DEFAULT.tipoCambioRef,
    niveles,
    rolesPorEtapa: { ...FLUJO_APROBACION_DEFAULT.rolesPorEtapa, ...(c.rolesPorEtapa ?? {}) },
    updatedAt: c.updatedAt ?? new Date().toISOString(),
    updatedBy: c.updatedBy ?? 'sistema',
  };
}

/** Config en memoria. Devuelve la de por defecto hasta que llegue la de la base. */
export function loadFlujoAprobacion(): FlujoAprobacionConfig {
  return cache ?? FLUJO_APROBACION_DEFAULT;
}

/** La deja en memoria tras leerla de la base. */
export function setFlujoAprobacionCache(config: FlujoAprobacionConfig): void {
  cache = config;
}

/** Etapas que deben firmar una orden de este monto. */
export function etapasRequeridas(
  total: number,
  moneda: 'PEN' | 'USD',
  config: FlujoAprobacionConfig,
): EtapaAprobacion[] {
  return determinarNivelAprobacion(total, moneda, config).etapas;
}

/** ¿Alguno de los roles de esta persona puede firmar esta etapa? */
export function puedeFirmarEtapa(
  misRoles: string[],
  etapa: EtapaAprobacion,
  config: FlujoAprobacionConfig,
): boolean {
  const permitidos = config.rolesPorEtapa[etapa] ?? [];
  return misRoles.some(r =>
    permitidos.some(p => p.toLowerCase().trim() === r.toLowerCase().trim()));
}

/**
 * ¿Está la orden completamente firmada?
 *
 * Se compara contra las etapas REQUERIDAS: firmas de más (por ejemplo una
 * gerencia que firmó una orden pequeña) no estorban, pero ninguna requerida
 * puede faltar.
 */
export function firmasCompletas(
  etapasFirmadas: string[],
  requeridas: EtapaAprobacion[],
): boolean {
  return requeridas.every(e => etapasFirmadas.includes(e));
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
