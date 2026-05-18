/**
 * CURRENCY UTILS — Memphis ERP
 * Utilidades para manejo multi-moneda.
 * Funciones puras que NO requieren hooks/contexto.
 */

export type Moneda = 'PEN' | 'USD' | 'EUR';

export const MONEDA_BASE: Moneda = 'PEN';

export const MONEDA_SIMBOLOS: Record<Moneda, string> = {
  PEN: 'S/',
  USD: '$',
  EUR: '€',
};

// ─── Tipo de cambio por defecto (fallback cuando no hay contexto) ───────

const LS_KEY = 'memphis:tipo_cambio';

function getTipoCambioFromLS(): number {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.PEN_USD ?? 3.75;
    }
  } catch { /* ignore */ }
  return 3.75;
}

// ─── Conversión ─────────────────────────────────────────────────────────

/**
 * Convierte un monto a la moneda base (PEN) usando el tipo de cambio.
 * Si ya está en PEN, retorna el monto sin cambios.
 * @param tipoCambioPENUSD — cuántos PEN vale 1 USD (default: lee de localStorage)
 */
export function convertirAMonedaBase(
  monto: number,
  moneda: string | null | undefined,
  tipoCambioPENUSD?: number
): number {
  if (!moneda || moneda === 'PEN') return monto;
  const tc = tipoCambioPENUSD ?? getTipoCambioFromLS();
  if (moneda === 'USD') return monto * tc;
  if (moneda === 'EUR') return monto * tc * 1.08; // EUR→USD→PEN approximation
  return monto; // moneda desconocida, retornar sin cambio
}

/**
 * Suma segura de montos multi-moneda, convirtiendo todo a PEN.
 */
export function sumarEnMonedaBase(
  items: Array<{ monto: number; moneda?: string | null }>,
  tipoCambioPENUSD?: number
): number {
  return items.reduce((total, item) => {
    return total + convertirAMonedaBase(item.monto ?? 0, item.moneda, tipoCambioPENUSD);
  }, 0);
}

// ─── Formateo ───────────────────────────────────────────────────────────

/**
 * Formatea un monto con símbolo de moneda
 */
export function formatMonto(monto: number, moneda?: string | null): string {
  const m = (moneda as Moneda) || 'PEN';
  const simbolo = MONEDA_SIMBOLOS[m] ?? m;
  return `${simbolo} ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formatea en moneda base (PEN) — para KPIs y totales agregados
 */
export function formatMontoBase(monto: number): string {
  return formatMonto(monto, 'PEN');
}
