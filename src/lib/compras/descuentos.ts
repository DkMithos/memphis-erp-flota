/**
 * Descuentos de proveedor en cotizaciones y órdenes (Compras, 26/10/2026).
 *
 * Por ítem, el proveedor puede dar el descuento de tres formas; el ERP guarda la
 * forma (`tipo` + `valor`) y calcula SIEMPRE el monto total del ítem (`descuento`):
 *   · porcentaje  → % sobre cantidad × precio
 *   · unidad      → monto por cada unidad
 *   · monto       → monto fijo por ítem
 * Sobre el subtotal hay un descuento global (porcentaje o monto).
 *
 * Regla única de totales:
 *   bruto           = Σ cantidad × precio de lista
 *   descuentoItems  = Σ descuento de cada ítem
 *   descuentoGlobal = % o monto sobre (bruto − descuentoItems)
 *   subtotal        = bruto − descuentoItems − descuentoGlobal   ← base imponible (lo que ya usan CxP, presupuesto, cadena)
 *   impuestos       = subtotal × tasa del régimen
 *   total           = subtotal + impuestos
 */
export type TipoDescuentoItem = 'porcentaje' | 'unidad' | 'monto';
export type TipoDescuentoGlobal = 'porcentaje' | 'monto';

export const TIPOS_DESCUENTO_ITEM: { value: TipoDescuentoItem; label: string; corto: string }[] = [
  { value: 'porcentaje', label: '% de la línea', corto: '%' },
  { value: 'unidad', label: 'Monto por unidad', corto: '/u' },
  { value: 'monto', label: 'Monto fijo del ítem', corto: 'fijo' },
];
export const TIPOS_DESCUENTO_GLOBAL: { value: TipoDescuentoGlobal; label: string }[] = [
  { value: 'porcentaje', label: '% del subtotal' },
  { value: 'monto', label: 'Monto fijo' },
];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface LineaConDescuento {
  cantidad: number;
  precioUnitario: number;
  /** Cómo lo dio el proveedor. Sin tipo, vale `descuento` (monto) tal cual. */
  descuentoTipo?: TipoDescuentoItem | null;
  descuentoValor?: number | null;
  /** Monto del descuento ya calculado (lo que guarda la base). */
  descuento?: number | null;
}

/** Monto del descuento de una línea, nunca negativo ni mayor que la línea. */
export function descuentoLinea(l: LineaConDescuento): number {
  const bruto = r2((Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0));
  const valor = Number(l.descuentoValor ?? 0) || 0;
  let d: number;
  if (l.descuentoTipo === 'porcentaje') d = bruto * valor / 100;
  else if (l.descuentoTipo === 'unidad') d = (Number(l.cantidad) || 0) * valor;
  else if (l.descuentoTipo === 'monto') d = valor;
  else d = Number(l.descuento ?? 0) || 0;
  return r2(Math.min(Math.max(d, 0), bruto));
}

export const brutoLinea = (l: Pick<LineaConDescuento, 'cantidad' | 'precioUnitario'>) => r2((Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0));
export const netoLinea = (l: LineaConDescuento) => r2(brutoLinea(l) - descuentoLinea(l));

export interface DescuentoGlobalInput { tipo?: TipoDescuentoGlobal | null; valor?: number | null }

/** Monto del descuento global sobre el subtotal neto de ítems. */
export function descuentoGlobalMonto(subtotalItems: number, g?: DescuentoGlobalInput | null): number {
  if (!g || !g.tipo) return 0;
  const valor = Number(g.valor ?? 0) || 0;
  const d = g.tipo === 'porcentaje' ? subtotalItems * valor / 100 : valor;
  return r2(Math.min(Math.max(d, 0), Math.max(subtotalItems, 0)));
}

export interface TotalesConDescuento {
  bruto: number;
  descuentoItems: number;
  descuentoGlobal: number;
  /** Base imponible: bruto − descuentos. Es el `subtotal` que se guarda. */
  subtotal: number;
  impuestos: number;
  total: number;
}

export function calcularTotalesConDescuento(items: LineaConDescuento[], tasa: number, global?: DescuentoGlobalInput | null): TotalesConDescuento {
  const bruto = r2(items.reduce((s, l) => s + brutoLinea(l), 0));
  const descuentoItems = r2(items.reduce((s, l) => s + descuentoLinea(l), 0));
  const subtotalItems = r2(bruto - descuentoItems);
  const descuentoGlobal = descuentoGlobalMonto(subtotalItems, global);
  const subtotal = r2(subtotalItems - descuentoGlobal);
  const impuestos = r2(subtotal * tasa);
  return { bruto, descuentoItems, descuentoGlobal, subtotal, impuestos, total: r2(subtotal + impuestos) };
}

/** Texto corto para listas y PDF: "5 %", "S/ 2.00/u", "S/ 50.00 fijo". */
export function etiquetaDescuentoItem(l: LineaConDescuento, moneda: string): string | null {
  const d = descuentoLinea(l);
  if (d <= 0) return null;
  const sim = moneda === 'USD' ? '$' : 'S/';
  const v = Number(l.descuentoValor ?? 0);
  if (l.descuentoTipo === 'porcentaje') return `${v} %`;
  if (l.descuentoTipo === 'unidad') return `${sim} ${v.toFixed(2)}/u`;
  return `${sim} ${d.toFixed(2)}`;
}
