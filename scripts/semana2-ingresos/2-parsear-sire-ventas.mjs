// Semana 2 del plan de carga (2026-10-12) · SIRE de ventas 2025-01 → 2026-09.
// Lee todos los "MM-AAAA SIRE VENTAS ...xlsx" de una carpeta (copias de 01. Contabilidad/<año>/<mes>/3. Ventas (PDF)),
// ubica la cabecera por nombre ("Periodo" + "Nro Doc Identidad"), une hojas y archivos y deduplica por tipo|serie|número
// (el mismo mes viene repetido en "Hoja1"/"Hoja2" y en copias "(1)"). Deja un único JSON para 3-cargar-sire-ventas.mjs.
// Uso: node 2-parsear-sire-ventas.mjs <carpeta_xlsx> <salida.json>
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const XLSX = createRequire('C:/Users/URSULA/Proyectos/memphis-erp-flota/package.json')('xlsx');
const [dir, out] = process.argv.slice(2);
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const pad2 = n => String(n).padStart(2, '0');
const fechaISO = v => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`;
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
  const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${pad2(m[2])}-${pad2(m[1])}` : null;
};
const numero = v => { if (v == null || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).replace(/[^0-9,.\-]/g, ''); const l = s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = Number(l); return isFinite(n) ? n : null; };

function leerHoja(filas, archivo, hoja) {
  let hi = -1;
  for (let i = 0; i < Math.min(filas.length, 30); i++) { const h = (filas[i] ?? []).map(norm); if (h.some(x => x === 'periodo') && h.some(x => x.includes('nrodocidentidad'))) { hi = i; break; } }
  if (hi < 0) return [];
  const h = filas[hi].map(norm);
  const col = (...ns) => { for (const n of ns) { const i = h.findIndex(x => x.startsWith(norm(n))); if (i >= 0) return i; } return -1; };
  const exacta = (...ns) => { for (const n of ns) { const i = h.findIndex(x => x === norm(n)); if (i >= 0) return i; } return -1; };
  const c = { per: col('periodo'), fe: col('fechadeemision'), fv: col('fechavcto'), tipo: col('tipocpdoc'), serie: col('seriedelcdp'), num: col('nrocpodoc'),
    ruc: col('nrodocidentidad'), rs: col('apellidosnombres'), bi: col('bigravada'), igv: col('igvipm'), ex: col('mtoexonerado'), inaf: col('mtoinafecto'),
    otros: col('otrostributos'), total: col('totalcp'), m: exacta('m', 'moneda'), tc: col('tipocambio', 'tipodecambio'), est: col('estcomp'),
    tn: col('tipodenota'), mt: col('tipocpmodificado'), ms: col('seriecpmodificado'), mn: col('nrocpmodificado'), mf: col('fechaemisiondocmodificado') };
  // En los SIRE de 2025 la cabecera del número modificado viene recortada ("Modif"): es la columna que sigue a la serie modificada.
  if (c.mn < 0 && c.ms >= 0) c.mn = c.ms + 1;
  const g = (r, i) => (i >= 0 ? r[i] : null);
  const out = [];
  for (let i = hi + 1; i < filas.length; i++) {
    const r = filas[i] ?? [];
    const ruc = String(g(r, c.ruc) ?? '').replace(/\D/g, ''); const fe = fechaISO(g(r, c.fe));
    if (!ruc || !fe) continue;
    out.push({
      periodo: String(g(r, c.per) ?? '').replace(/\D/g, '') || fe.slice(0, 7).replace('-', ''), fecha_emision: fe, fecha_vencimiento: fechaISO(g(r, c.fv)),
      tipo: String(g(r, c.tipo) ?? '01').replace(/\D/g, '').padStart(2, '0'), serie: String(g(r, c.serie) ?? '').trim().toUpperCase(),
      numero: String(g(r, c.num) ?? '').replace(/\D/g, ''), ruc, razon_social: String(g(r, c.rs) ?? '').trim(),
      bi_gravada: numero(g(r, c.bi)) ?? 0, igv: numero(g(r, c.igv)) ?? 0, exonerado: numero(g(r, c.ex)) ?? 0, inafecto: numero(g(r, c.inaf)) ?? 0,
      otros_tributos: numero(g(r, c.otros)) ?? 0, total: numero(g(r, c.total)) ?? 0,
      moneda: String(g(r, c.m) ?? 'PEN').trim().toUpperCase() || 'PEN', tc: numero(g(r, c.tc)), estado: String(g(r, c.est) ?? '').trim(),
      tipo_nota: String(g(r, c.tn) ?? '').replace(/\D/g, ''), mod_tipo: String(g(r, c.mt) ?? '').replace(/\D/g, '').padStart(2, '0').replace(/^00$/, ''),
      mod_serie: String(g(r, c.ms) ?? '').trim().toUpperCase(), mod_numero: String(g(r, c.mn) ?? '').replace(/\D/g, ''), mod_fecha: fechaISO(g(r, c.mf)),
      archivo: `${archivo} · ${hoja}`,
    });
  }
  return out;
}

const docs = new Map(); let leidas = 0; const porArchivo = {};
for (const f of readdirSync(dir).filter(x => /\.xlsx$/i.test(x) && !/SMART/i.test(x)).sort()) {
  const wb = XLSX.read(readFileSync(`${dir}/${f}`), { type: 'buffer', cellDates: true });
  let n = 0;
  for (const nombre of wb.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: null });
    for (const d of leerHoja(filas, f.replace(/^\d{4}__/, ''), nombre)) {
      leidas++; n++;
      const k = `${d.tipo}|${d.serie}|${d.numero.replace(/^0+/, '')}`;
      const prev = docs.get(k);
      if (prev && Math.abs(prev.total - d.total) > 0.01) console.warn('CONFLICTO', k, prev.total, d.total, prev.archivo, d.archivo);
      if (!prev) docs.set(k, d);
    }
  }
  porArchivo[f] = n;
}
const lista = [...docs.values()].sort((a, b) => a.fecha_emision.localeCompare(b.fecha_emision) || a.serie.localeCompare(b.serie) || Number(a.numero) - Number(b.numero));
writeFileSync(out, JSON.stringify(lista));
const porTipo = {}; const porPer = {}; let neto = 0;
for (const d of lista) { porTipo[d.tipo] = (porTipo[d.tipo] ?? 0) + 1; porPer[d.periodo] = (porPer[d.periodo] ?? 0) + 1; neto += d.tipo === '07' ? -d.total : d.total; }
console.log(JSON.stringify({ filas_leidas: leidas, documentos_unicos: lista.length, por_tipo: porTipo, neto_pen_y_usd_mezclados: Math.round(neto * 100) / 100, por_periodo: porPer }, null, 1));
