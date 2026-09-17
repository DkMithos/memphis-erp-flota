/**
 * EL MODELO DE CAJA CHICA DE ADMINISTRACIÓN — orden de las filas y totales.
 *
 * Lo que pidió Kevin (2026-09-17):
 *   1. Primer ítem: el saldo de la caja anterior, si la caja se abrió con una.
 *   2. Luego el depósito de apertura, si lo hay.
 *   3. El resto en orden de REGISTRO, no de fecha de pago.
 *   4. Ítems numerados 1, 2, 3…
 *
 * Y los totales:
 *   saldo inicial = lo positivo de la caja anterior, o cero
 *   ingresos      = todos los ingresos + el depósito de apertura
 *   gastos        = todos los gastos
 *   saldo final   = saldo inicial + ingresos − gastos
 *
 * Una deuda arrastrada (la caja anterior cerró en rojo) viene guardada como
 * ingreso NEGATIVO de tipo `saldo_anterior`, igual que la ve el ERP en pantalla.
 * Se deja como primer ítem con su importe negativo en la columna de ingreso:
 * así el saldo inicial es cero (no hay saldo a favor) y la deuda sigue
 * descontando del cierre, que cuadra al céntimo con `monto_disponible`.
 *
 * "Orden de registro": `creado_en` y, cuando varias filas comparten el mismo
 * instante (cajas cargadas en bloque), el correlativo del número (GCC-2026-007
 * → 7). La fecha de pago solo desempata al final.
 */

export interface IngresoCajaFila {
  numero: string | null;
  tipo: string | null;               // saldo_anterior | apertura | reposicion | reembolso
  monto: number | string | null;
  fecha: string | null;              // fecha de pago (ISO yyyy-mm-dd)
  origen?: string | null;
  descripcion?: string | null;
  centro_costo?: string | null;
  comprobante_tipo?: string | null;
  comprobante_numero?: string | null;
  creado_en?: string | null;
}

export interface GastoCajaFila {
  numero: string | null;
  categoria?: string | null;
  monto: number | string | null;
  fecha: string | null;
  beneficiario?: string | null;
  descripcion?: string | null;
  centro_costo?: string | null;
  comprobante_tipo?: string | null;
  comprobante_numero?: string | null;
  creado_en?: string | null;
}

export type ClaseFila = 'saldo_anterior' | 'apertura' | 'ingreso' | 'gasto';

export interface FilaCajaModelo {
  item: number;
  clase: ClaseFila;
  centroCosto: string | null;
  tipoDoc: string | null;
  comprobante: string | null;
  razonSocial: string | null;
  descripcion: string | null;
  ingreso: number | null;
  egreso: number | null;
  fecha: string | null;
}

export interface CajaModelo {
  filas: FilaCajaModelo[];
  saldoInicial: number;
  ingresos: number;
  gastos: number;
  saldoFinal: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/** Saldo arrastrado de la caja anterior (a favor o deuda). Las cajas viejas lo
 * guardaron como `apertura` con la leyenda "SALDO A FAVOR DE CAJA CHICA ANTERIOR". */
export function esSaldoAnterior(i: IngresoCajaFila): boolean {
  if (i.tipo === 'saldo_anterior') return true;
  return /CAJA\s+CHICA\s+ANTERIOR|CAJA\s+ANTERIOR/i.test(i.descripcion ?? '');
}

/** El depósito con el que se abre la caja. */
export function esApertura(i: IngresoCajaFila): boolean {
  if (esSaldoAnterior(i)) return false;
  return i.tipo === 'apertura' || /APERTURA/i.test(i.descripcion ?? '');
}

/** Correlativo del número: "GCC-2026-007" → 7, "12" → 12, sin número → null. */
export function correlativo(numero: string | null | undefined): number | null {
  const m = String(numero ?? '').match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

interface Candidata {
  rango: 0 | 1 | 2;          // 0 saldo anterior · 1 apertura · 2 el resto
  creadoEn: number;          // ms; Infinity si no hay
  correlativo: number;       // Infinity si no hay
  fecha: string;
  fila: Omit<FilaCajaModelo, 'item'>;
}

const ms = (iso?: string | null) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

/**
 * Ordena y numera los movimientos de una caja como en el modelo y calcula el
 * recuadro de saldos. Puro: sin Supabase ni Excel, para poder probarlo.
 */
export function prepararCajaModelo(ingresos: IngresoCajaFila[], gastos: GastoCajaFila[]): CajaModelo {
  const candidatas: Candidata[] = [];

  for (const i of ingresos) {
    const clase: ClaseFila = esSaldoAnterior(i) ? 'saldo_anterior' : esApertura(i) ? 'apertura' : 'ingreso';
    candidatas.push({
      rango: clase === 'saldo_anterior' ? 0 : clase === 'apertura' ? 1 : 2,
      creadoEn: ms(i.creado_en),
      correlativo: correlativo(i.numero) ?? Number.POSITIVE_INFINITY,
      fecha: i.fecha ?? '',
      fila: {
        clase,
        centroCosto: i.centro_costo ?? null,
        tipoDoc: i.comprobante_tipo ?? null,
        comprobante: i.comprobante_numero ?? null,
        razonSocial: i.origen ?? null,
        descripcion: i.descripcion ?? null,
        ingreso: r2(num(i.monto)),
        egreso: null,
        fecha: i.fecha ?? null,
      },
    });
  }
  for (const g of gastos) {
    candidatas.push({
      rango: 2,
      creadoEn: ms(g.creado_en),
      correlativo: correlativo(g.numero) ?? Number.POSITIVE_INFINITY,
      fecha: g.fecha ?? '',
      fila: {
        clase: 'gasto',
        centroCosto: g.centro_costo ?? null,
        tipoDoc: g.categoria ?? g.comprobante_tipo ?? null,
        comprobante: g.comprobante_numero ?? null,
        razonSocial: g.beneficiario ?? null,
        descripcion: g.descripcion ?? null,
        ingreso: null,
        egreso: r2(num(g.monto)),
        fecha: g.fecha ?? null,
      },
    });
  }

  candidatas.sort((a, b) =>
    a.rango - b.rango
    || a.creadoEn - b.creadoEn
    || a.correlativo - b.correlativo
    || a.fecha.localeCompare(b.fecha));

  const filas = candidatas.map((c, i) => ({ item: i + 1, ...c.fila }));

  const totalIngresos = r2(filas.reduce((t, f) => t + (f.ingreso ?? 0), 0));
  const gastosTotal = r2(filas.reduce((t, f) => t + (f.egreso ?? 0), 0));
  const arrastre = filas.find(f => f.clase === 'saldo_anterior')?.ingreso ?? 0;
  const saldoInicial = arrastre > 0 ? r2(arrastre) : 0;
  const ingresosNetos = r2(totalIngresos - saldoInicial);

  return {
    filas,
    saldoInicial,
    ingresos: ingresosNetos,
    gastos: gastosTotal,
    saldoFinal: r2(saldoInicial + ingresosNetos - gastosTotal),
  };
}
