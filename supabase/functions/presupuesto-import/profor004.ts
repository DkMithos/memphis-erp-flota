/**
 * LEER EL FORMATO PRO-FOR-004 (plantilla de presupuesto de Operaciones, 2025).
 *
 * Es el formato con el que Operaciones presupuesta de verdad (los 10 proyectos
 * de "General - PROYECTOS" están en él). Difiere de la plantilla-v1:
 *
 *  - Cabecera: PROYECTO:, CUI:, "Costo de Ejecución…", "Tasa de Cambio" (el TC
 *    vive en la columna C de esa fila; a veces hay un segundo "TC" para el
 *    bloque FINAL) y "Plazo".
 *  - Tabla: ITEM | DESCRIPCION | UNIDAD | CANTIDAD | PRECIO U. | PRECIO T. |
 *    Proveedor | Forma de Pago  (bloque PLANIFICADO)  y luego  PRECIO U. |
 *    PRECIO T. | Proveedor | Forma de Pago  (bloque FINAL, lo negociado).
 *  - Ítems "01.02.03"; "01.02.00" es un grupo. Hay códigos repetidos.
 *  - LOS PRECIOS TRAEN IGV (`=ROUND(720*1.18,2)`): Σ PLANIFICADO coincide al
 *    céntimo con el presupuesto del ERP en tres proyectos. Sin IGV = /1.18.
 *  - LA MONEDA VA ESCONDIDA EN LA FÓRMULA: `=37990*$C$8` es dólares × celda
 *    del TC. El valor visible ya está en soles. Por eso se leen valores Y
 *    fórmulas (Graph: usedRange?$select=address,values,formulas).
 *
 * Sin nada de Deno dentro, para que las pruebas del repo importen exactamente
 * el mismo código que corre en producción.
 */

import { numeroPeru, texto, type CabeceraPlantilla, type LineaPlantilla } from './plantilla.ts'

export const IGV = 0.18

export interface CabeceraProFor004 extends CabeceraPlantilla {
  /** TC del bloque FINAL, si la hoja trae un segundo "TC". */
  tipoCambioFinal: number | null
  /** Celda del TC (p. ej. "C8"), para detectar dólares en las fórmulas. */
  celdaTc: string | null
  celdaTcFinal: string | null
}

export interface LineaProFor004 extends LineaPlantilla {
  formaPago: string
  monedaFinal: string
  precioUnitarioFinal: number | null
  totalFinal: number | null
  proveedorFinal: string
  formaPagoFinal: string
  /** Fila real en el Excel (1-based), para que Operaciones ubique la partida. */
  filaExcel: number
}

/** Origen del rango leído (0-based), porque usedRange no siempre arranca en A1. */
export interface OrigenRango { fila: number; col: number }

/** "Presu.!B3:M400" → { fila: 2, col: 1 }. */
export function origenDeDireccion(direccion: string | undefined): OrigenRango {
  const m = String(direccion ?? '').split('!').pop()?.match(/^\$?([A-Z]+)\$?(\d+)/)
  if (!m) return { fila: 0, col: 0 }
  let col = 0
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { fila: Number(m[2]) - 1, col: col - 1 }
}

function letraColumna(idx0: number): string {
  let n = idx0 + 1, s = ''
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}

/** Dirección "C8" de la celda (fila, col) 0-based del rango, ajustando al origen. */
export function direccion(fila: number, col: number, origen: OrigenRango): string {
  return `${letraColumna(col + origen.col)}${fila + origen.fila + 1}`
}

/** ¿La fórmula referencia esa celda (con o sin $)? */
export function referenciaCelda(formula: unknown, celda: string | null): boolean {
  if (!celda || typeof formula !== 'string' || !formula.startsWith('=')) return false
  const m = celda.match(/^([A-Z]+)(\d+)$/)
  if (!m) return false
  return new RegExp(`(?<![A-Z])\\$?${m[1]}\\$?${m[2]}(?!\\d)`).test(formula)
}

/**
 * "01.02.03" → { item: "1.2.3", grupo: false } · "01.02.00" → { item: "1.2", grupo: true }
 * · texto → null. Los ceros finales marcan grupo y se quitan.
 */
export function itemProFor004(bruto: unknown): { item: string; grupo: boolean } | null {
  const s = texto(bruto).replace(/,/g, '.')
  if (!/^\d+(\.\d+)*$/.test(s)) return null
  const segs = s.split('.').map(x => String(Number(x)))
  const grupo = segs[segs.length - 1] === '0'
  while (segs.length > 1 && segs[segs.length - 1] === '0') segs.pop()
  return { item: segs.join('.'), grupo }
}

/** Fila de la cabecera de la tabla (ITEM | DESCRIPCION…), o -1. */
export function filaTabla(valores: unknown[][]): number {
  return valores.findIndex(f =>
    texto(f?.[0]).toUpperCase() === 'ITEM' && /DESCRIPCI/i.test(texto(f?.[1])))
}

/**
 * ¿Es PRO-FOR-004? La plantilla-v1 lleva MONEDA en la 6.ª columna; el
 * PRO-FOR-004 lleva ahí "PRECIO T." (y "Proveedor" en la 7.ª).
 */
export function esProFor004(valores: unknown[][]): boolean {
  const i = filaTabla(valores)
  if (i === -1) return false
  const f = valores[i]
  return /PRECIO\s*T/i.test(texto(f[5])) && /PROVEEDOR/i.test(texto(f[6]))
}

export function leerCabeceraProFor004(valores: unknown[][], origen: OrigenRango = { fila: 0, col: 0 }): CabeceraProFor004 {
  const cab: CabeceraProFor004 = {
    proyecto: '', cui: '', importeEjecucion: null, importeReferencial: null,
    tipoCambio: null, plazoDias: null, tipoCambioFinal: null, celdaTc: null, celdaTcFinal: null,
  }
  const fin = filaTabla(valores)
  const hasta = fin === -1 ? Math.min(valores.length, 40) : fin
  for (let i = 0; i < hasta; i++) {
    const fila = valores[i] ?? []
    const a = texto(fila[0])
    const c = fila[2]
    for (let j = 0; j < Math.min(fila.length, 12); j++) {
      const s = texto(fila[j])
      if (/^PROYECTO\s*:/i.test(s)) cab.proyecto = s.split(':').slice(1).join(':').trim()
      else if (/^CUI\s*:/i.test(s)) cab.cui = s.split(':').slice(1).join(':').trim().split(/\s/)[0]
    }
    if (/Tasa de Cambio/i.test(a)) {
      cab.tipoCambio = numeroPeru(c)
      cab.celdaTc = direccion(i, 2, origen)
      for (let j = 3; j < Math.min(12, fila.length - 1); j++) {
        const n = numeroPeru(fila[j + 1])
        // Un "TC" con 70 (SMARTBOM) es basura: un tipo de cambio real está por debajo de 10.
        if (texto(fila[j]).toUpperCase() === 'TC' && n !== null && n > 0 && n < 10) {
          cab.tipoCambioFinal = n
          cab.celdaTcFinal = direccion(i, j + 1, origen)
        }
      }
    } else if (/Plazo/i.test(a)) {
      cab.plazoDias = numeroPeru(texto(c).replace(/[^\d.]/g, ''))
    } else if (/Ejecuci/i.test(a) && cab.importeEjecucion === null && numeroPeru(c) !== null) {
      cab.importeEjecucion = numeroPeru(c)
    } else if (/referencial|Total de la Invers|cobro/i.test(a) && numeroPeru(c) !== null) {
      cab.importeReferencial = numeroPeru(c)
    }
  }
  if (!cab.proyecto) cab.proyecto = texto(valores[2]?.[2])
  return cab
}

/**
 * Lee las partidas. `valores` y `formulas` son la misma hoja (Graph devuelve
 * en `formulas` la fórmula si la hay y si no el valor).
 */
export function leerLineasProFor004(
  valores: unknown[][], formulas: unknown[][], cab: CabeceraProFor004, origen: OrigenRango = { fila: 0, col: 0 },
): LineaProFor004[] {
  const iTabla = filaTabla(valores)
  if (iTabla === -1) return []
  const tc = cab.tipoCambio ?? 0
  const tcf = cab.tipoCambioFinal ?? tc
  const lineas: LineaProFor004[] = []
  const vistos = new Map<string, number>()
  let orden = 0

  for (let i = iTabla + 1; i < valores.length; i++) {
    const f = valores[i] ?? []
    const fx = formulas[i] ?? []
    if (f.slice(0, 12).every(c => c === null || c === undefined || c === '')) continue
    const it = itemProFor004(f[0])
    if (!it) continue
    let { item } = it

    const cant = numeroPeru(f[3]); const pu = numeroPeru(f[4]); const tot = numeroPeru(f[5])
    const puF = numeroPeru(f[8]); const totF = numeroPeru(f[9])
    const esHoja = !it.grupo && cant !== null && pu !== null && (pu > 0 || (tot ?? 0) > 0)

    // Códigos repetidos: la segunda hoja con el mismo código pasa a "1.2.3#2"
    // (los ítems enlazan por código y no pueden mezclarse); un grupo repetido sobra.
    const n = vistos.get(item)
    if (n !== undefined) {
      if (!esHoja) continue
      vistos.set(item, n + 1)
      item = `${item}#${n + 1}`
    } else {
      vistos.set(item, 1)
    }

    const usd = tc > 0 && referenciaCelda(fx[4], cab.celdaTc)
    const usdF = tcf > 0 && (referenciaCelda(fx[8], cab.celdaTcFinal) || referenciaCelda(fx[8], cab.celdaTc))
    const redondea4 = (x: number) => Math.round(x * 10000) / 10000

    lineas.push({
      item,
      nivel: item.split('.').length,
      esHoja,
      descripcion: texto(f[1]).slice(0, 300),
      unidad: texto(f[2]),
      cantidad: esHoja ? cant : null,
      precioUnitario: esHoja ? (usd ? redondea4((pu ?? 0) / tc) : pu) : null,
      moneda: esHoja ? (usd ? 'USD' : 'PEN') : '',
      precioUnitarioSoles: esHoja ? pu : null,
      totalConIgv: esHoja ? tot : null,
      totalSinIgv: esHoja && tot !== null ? Math.round(tot / (1 + IGV) * 100) / 100 : null,
      igvTasa: esHoja ? IGV : null,
      proveedorNota: texto(f[6]),
      formaPago: texto(f[7]),
      monedaFinal: esHoja && puF ? (usdF ? 'USD' : 'PEN') : '',
      precioUnitarioFinal: esHoja && puF ? (usdF ? redondea4(puF / tcf) : puF) : null,
      totalFinal: esHoja && totF ? totF : null,
      proveedorFinal: texto(f[10]),
      formaPagoFinal: texto(f[11]),
      orden: orden++,
      filaExcel: i + origen.fila + 1,
    })
  }
  return lineas
}
