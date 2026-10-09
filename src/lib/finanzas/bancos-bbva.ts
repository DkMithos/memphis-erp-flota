/**
 * LECTOR DEL "HISTÓRICO DE MOVIMIENTOS" DE BBVA (lo que Carolina exporta de la
 * banca por internet y guarda en BANCOS2026.xlsx, una hoja por cuenta y mes).
 *
 * Cada hoja trae:
 *   A1  "Histórico de Movimientos"
 *   A2  "Periodo: de 01-09-2026 a 30-09-2026"
 *   A7  "Cuenta Actual: 00110178160100101806 PE"   ← la cuenta se lee de AQUÍ,
 *   A8  "Importes en: PEN"                            no del nombre de la hoja
 *       (hay hojas tituladas "806 … PEN" que son de la 830 en dólares)
 *   Fila de cabecera: F. Operación | F. Valor | Código | Nº. Doc. | Concepto | Importe | Oficina
 *   Filas de movimiento, con "Saldo Inicial: dd-mm-aaaa" y "Saldo Final: dd-mm-aaaa"
 *   intercalados en la columna E con el importe en F.
 *
 * Sin dependencias de UI: se prueba contra el archivo real.
 */

export interface MovimientoBbva {
  fecha_operacion: string;   // YYYY-MM-DD
  fecha_valor: string | null;
  codigo: string | null;
  numero_doc: string | null;
  concepto: string | null;
  importe: number;           // firmado
  oficina: string | null;
  fila: number;
}

export interface HojaBbva {
  hoja: string;
  numeroCuenta: string | null;   // solo dígitos
  moneda: 'PEN' | 'USD' | null;
  periodo: string | null;
  movimientos: MovimientoBbva[];
  saldos: { fecha: string; saldo: number }[];   // "Saldo Final" por día
  saldoInicial: { fecha: string; saldo: number } | null;
  avisos: string[];
}

type Celda = string | number | boolean | Date | null | undefined;

const texto = (v: Celda): string => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

/** "02-09-2026", "2026-09-02 00:00:00", Date o serial de Excel → YYYY-MM-DD. */
export function fechaISO(v: Celda): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') {
    // serial de Excel (días desde 1899-12-30)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export function numero(v: Celda): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^0-9,.\-]/g, '');
  if (!s) return null;
  // "1.614.937,50" → 1614937.50 ; "-1614937.5" → -1614937.5
  const limpio = s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Interpreta una hoja ya convertida a matriz de celdas (fila 0 = primera fila de Excel). */
export function leerHojaBbva(nombre: string, filas: Celda[][]): HojaBbva {
  const out: HojaBbva = { hoja: nombre, numeroCuenta: null, moneda: null, periodo: null, movimientos: [], saldos: [], saldoInicial: null, avisos: [] };
  let cabecera = -1;
  for (let i = 0; i < Math.min(filas.length, 40); i++) {
    const a = texto(filas[i]?.[0]);
    const mc = a.match(/Cuenta Actual:\s*([0-9 -]+)/i);
    if (mc) out.numeroCuenta = mc[1].replace(/\D/g, '');
    const mm = a.match(/Importes en:\s*([A-Z]{3})/i);
    if (mm) out.moneda = mm[1].toUpperCase() === 'USD' ? 'USD' : 'PEN';
    const mp = a.match(/Periodo:\s*(.+)$/i);
    if (mp) out.periodo = mp[1].trim();
    if (/^F\.?\s*Operaci/i.test(a)) { cabecera = i; break; }
  }
  if (cabecera < 0) { out.avisos.push('No se encontró la fila de cabecera "F. Operación".'); return out; }
  // Posiciones por nombre de columna (por si BBVA las mueve)
  const h = filas[cabecera].map(c => texto(c).toLowerCase());
  const col = (re: RegExp, def: number) => { const i = h.findIndex(x => re.test(x)); return i >= 0 ? i : def; };
  const cFop = col(/operaci/, 0), cFval = col(/valor/, 1), cCod = col(/c[oó]digo/, 2), cDoc = col(/doc/, 3), cCon = col(/concepto/, 4), cImp = col(/importe/, 5), cOf = col(/oficina/, 6);

  for (let i = cabecera + 1; i < filas.length; i++) {
    const r = filas[i] ?? [];
    const concepto = texto(r[cCon]);
    const msal = concepto.match(/^Saldo (Inicial|Final):\s*(\d{2}-\d{2}-\d{4})/i);
    if (msal) {
      const f = fechaISO(msal[2]); const s = numero(r[cImp]);
      if (f != null && s != null) {
        if (/inicial/i.test(msal[1])) out.saldoInicial = out.saldoInicial ?? { fecha: f, saldo: s };
        else out.saldos.push({ fecha: f, saldo: s });
      }
      continue;
    }
    const fop = fechaISO(r[cFop]);
    const imp = numero(r[cImp]);
    if (!fop || imp == null) continue;          // filas vacías o totales
    out.movimientos.push({
      fecha_operacion: fop,
      fecha_valor: fechaISO(r[cFval]),
      codigo: texto(r[cCod]) || null,
      numero_doc: texto(r[cDoc]) || null,
      concepto: concepto || null,
      importe: imp,
      oficina: texto(r[cOf]) || null,
      fila: i + 1,
    });
  }
  if (!out.numeroCuenta) out.avisos.push('La hoja no indica "Cuenta Actual".');
  if (out.movimientos.length === 0) out.avisos.push('La hoja no tiene movimientos.');
  // Control: saldo inicial + Σ importes = último saldo final
  if (out.saldoInicial && out.saldos.length) {
    const suma = out.movimientos.reduce((s, m) => s + m.importe, 0);
    const esperado = out.saldoInicial.saldo + suma;
    const ultimo = out.saldos[out.saldos.length - 1].saldo;
    if (Math.abs(esperado - ultimo) > 0.05) out.avisos.push(`El saldo no cuadra: inicial ${out.saldoInicial.saldo} + movimientos ${suma.toFixed(2)} = ${esperado.toFixed(2)}, el banco dice ${ultimo}.`);
  }
  return out;
}

/** Lee todas las hojas de un libro BBVA (xlsx o xls) usando SheetJS. */
export async function leerLibroBbva(archivo: File): Promise<HojaBbva[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true });
  return wb.SheetNames.map(nombre => {
    const ws = wb.Sheets[nombre];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as Celda[][];
    return leerHojaBbva(nombre, filas);
  });
}
