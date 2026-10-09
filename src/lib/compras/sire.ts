/**
 * LECTOR DEL SIRE DE COMPRAS (el Excel que Contabilidad descarga de SUNAT cada mes).
 *
 * Columnas por nombre, no por posición: "Periodo", "Fecha de emisión",
 * "Fecha Vcto/Pago", "Tipo CP/Doc.", "Serie del CDP", "Nro CP o Doc. Nro Inicial
 * (Rango)", "Nro Doc Identidad", "Apellidos Nombres/ Razón Social", "BI Gravado DG",
 * "IGV / IPM DG", "Valor Adq. NG", "Total CP", "M", "Tipo de Cambio", "Detracción",
 * "Est. Comp.". La cabecera puede no estar en la fila 1.
 */
import { supabase } from '../supabase/client';
import { fechaISO, numero } from '../finanzas/bancos-bbva';

export interface FilaSire {
  periodo: string; fecha_emision: string; fecha_vencimiento: string | null; tipo: string; serie: string; numero: string;
  ruc: string; razon_social: string; bi_gravada: number; igv: number; no_gravada: number; total: number;
  moneda: string; tc: number | null; detraccion: string; estado: string;
}

type Celda = string | number | boolean | Date | null | undefined;
const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export function leerHojaSire(filas: Celda[][]): { filas: FilaSire[]; avisos: string[] } {
  const avisos: string[] = [];
  let hi = -1;
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const h = (filas[i] ?? []).map(norm);
    if (h.some(x => x === 'periodo') && h.some(x => x.includes('nrodocidentidad'))) { hi = i; break; }
  }
  if (hi < 0) return { filas: [], avisos: ['No encontré la cabecera del SIRE (columnas "Periodo" y "Nro Doc Identidad").'] };
  const h = filas[hi].map(norm);
  const col = (...nombres: string[]) => { for (const n of nombres) { const i = h.findIndex(x => x.includes(norm(n))); if (i >= 0) return i; } return -1; };
  const c = {
    periodo: col('periodo'), fe: col('fechadeemision'), fv: col('fechavcto'), tipo: col('tipocpdoc'), serie: col('seriedelcdp'),
    num: col('nrocpodocnroinicial', 'nrocp'), ruc: col('nrodocidentidad'), razon: col('apellidosnombres', 'razonsocial'),
    bi: col('bigravadodg'), igv: col('igvipmdg'), ng: col('valoradqng'), total: col('totalcp'), m: col('m'), tc: col('tipodecambio'),
    det: col('detraccion'), est: col('estcomp'),
  };
  // "m" es una columna de una letra: buscarla exacta para no confundirla con otras
  c.m = h.findIndex(x => x === 'm');
  if (c.ruc < 0 || c.total < 0 || c.serie < 0) avisos.push('Faltan columnas clave (RUC, serie o total).');
  const g = (r: Celda[], i: number) => (i >= 0 ? r[i] : null);
  const out: FilaSire[] = [];
  for (let i = hi + 1; i < filas.length; i++) {
    const r = filas[i] ?? [];
    const ruc = String(g(r, c.ruc) ?? '').replace(/\D/g, '');
    const fe = fechaISO(g(r, c.fe));
    if (!ruc || !fe) continue;
    out.push({
      periodo: String(g(r, c.periodo) ?? '').replace(/\D/g, ''), fecha_emision: fe, fecha_vencimiento: fechaISO(g(r, c.fv)),
      tipo: String(g(r, c.tipo) ?? '01').replace(/\D/g, '').padStart(2, '0'), serie: String(g(r, c.serie) ?? '').trim().toUpperCase(),
      numero: String(g(r, c.num) ?? '').replace(/\D/g, ''), ruc, razon_social: String(g(r, c.razon) ?? '').trim(),
      bi_gravada: numero(g(r, c.bi)) ?? 0, igv: numero(g(r, c.igv)) ?? 0, no_gravada: numero(g(r, c.ng)) ?? 0, total: numero(g(r, c.total)) ?? 0,
      moneda: String(g(r, c.m) ?? 'PEN').trim().toUpperCase() || 'PEN', tc: numero(g(r, c.tc)), detraccion: String(g(r, c.det) ?? '').trim(),
      estado: String(g(r, c.est) ?? '').trim(),
    });
  }
  if (out.length === 0) avisos.push('La hoja no tiene filas con RUC y fecha.');
  return { filas: out, avisos };
}

export async function leerLibroSire(archivo: File): Promise<{ hoja: string; filas: FilaSire[]; avisos: string[] }[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true });
  return wb.SheetNames.map(hoja => {
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: true, defval: null }) as Celda[][];
    return { hoja, ...leerHojaSire(filas) };
  });
}

export interface ResultadoSire { nuevas: number; yaExistian: number; enlazadas: number; notasCredito: number; saltadas: number; sinProveedor: number }

export async function importarSire(filas: FilaSire[], archivo: string): Promise<ResultadoSire> {
  const acc: ResultadoSire = { nuevas: 0, yaExistian: 0, enlazadas: 0, notasCredito: 0, saltadas: 0, sinProveedor: 0 };
  for (let i = 0; i < filas.length; i += 150) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const { data, error } = await (supabase as any).rpc('sire_importar_compras', { p_filas: filas.slice(i, i + 150), p_archivo: archivo });
    if (error) throw new Error(error.message);
    acc.nuevas += Number(data?.nuevas ?? 0); acc.yaExistian += Number(data?.ya_existian ?? 0); acc.enlazadas += Number(data?.enlazadas_a_pago_historico ?? 0);
    acc.notasCredito += Number(data?.notas_credito_omitidas ?? 0); acc.saltadas += Number(data?.saltadas ?? 0); acc.sinProveedor += Number(data?.sin_proveedor_en_directorio ?? 0);
  }
  return acc;
}
