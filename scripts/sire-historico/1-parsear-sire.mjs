// Replica leerHojaSire (src/lib/compras/sire.ts) fuera del bundle: lee cada SIRE y deja un JSON por archivo.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const XLSX = createRequire('C:/Users/URSULA/Proyectos/memphis-erp-flota/package.json')('xlsx');
const [dir, out] = process.argv.slice(2);
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const fechaISO = v => { if (v == null || v === '') return null; if (v instanceof Date) return isNaN(v) ? null : `${v.getUTCFullYear()}-${String(v.getUTCMonth()+1).padStart(2,'0')}-${String(v.getUTCDate()).padStart(2,'0')}`;
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; }
  const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; return null; };
const numero = v => { if (v == null || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null; const s = String(v).replace(/[^0-9,.\-]/g, ''); if (!s) return null;
  const l = s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); const n = Number(l); return isFinite(n) ? n : null; };
function leerHoja(filas) {
  let hi = -1;
  for (let i = 0; i < Math.min(filas.length, 30); i++) { const h = (filas[i] ?? []).map(norm); if (h.some(x => x === 'periodo') && h.some(x => x.includes('nrodocidentidad'))) { hi = i; break; } }
  if (hi < 0) return { filas: [], avisos: ['sin cabecera'] };
  const h = filas[hi].map(norm);
  const col = (...ns) => { for (const n of ns) { const i = h.findIndex(x => x.includes(norm(n))); if (i >= 0) return i; } return -1; };
  const c = { periodo: col('periodo'), fe: col('fechadeemision'), fv: col('fechavcto'), tipo: col('tipocpdoc'), serie: col('seriedelcdp'), num: col('nrocpodocnroinicial', 'nrocp'), ruc: col('nrodocidentidad'), razon: col('apellidosnombres', 'razonsocial'),
    bi: col('bigravadodg'), igv: col('igvipmdg'), ng: col('valoradqng'), total: col('totalcp'), m: h.findIndex(x => x === 'moneda') >= 0 ? h.findIndex(x => x === 'moneda') : h.findIndex(x => x === 'm'), tc: col('tipodecambio') >= 0 ? col('tipodecambio') : h.findIndex(x => x === 'tc'), det: col('detraccion') >= 0 ? col('detraccion') : h.findIndex(x => x === 'd'), est: col('estcomp') };
  const avisos = []; if (c.ruc < 0 || c.total < 0 || c.serie < 0) avisos.push('faltan columnas clave');
  const g = (r, i) => (i >= 0 ? r[i] : null); const out = [];
  for (let i = hi + 1; i < filas.length; i++) { const r = filas[i] ?? []; const ruc = String(g(r, c.ruc) ?? '').replace(/\D/g, ''); const fe = fechaISO(g(r, c.fe)); if (!ruc || !fe) continue;
    out.push({ periodo: String(g(r, c.periodo) ?? '').replace(/\D/g, ''), fecha_emision: fe, fecha_vencimiento: fechaISO(g(r, c.fv)), tipo: String(g(r, c.tipo) ?? '01').replace(/\D/g, '').padStart(2, '0'), serie: String(g(r, c.serie) ?? '').trim().toUpperCase(),
      numero: String(g(r, c.num) ?? '').replace(/\D/g, ''), ruc, razon_social: String(g(r, c.razon) ?? '').trim(), bi_gravada: numero(g(r, c.bi)) ?? 0, igv: numero(g(r, c.igv)) ?? 0, no_gravada: numero(g(r, c.ng)) ?? 0, total: numero(g(r, c.total)) ?? 0,
      moneda: String(g(r, c.m) ?? 'PEN').trim().toUpperCase() || 'PEN', tc: numero(g(r, c.tc)), detraccion: String(g(r, c.det) ?? '').trim(), estado: String(g(r, c.est) ?? '').trim() }); }
  return { filas: out, avisos, cols: c };
}
for (const f of readdirSync(dir).filter(x => x.endsWith('.xlsx')).sort()) {
  const wb = XLSX.read(readFileSync(`${dir}/${f}`), { type: 'buffer', cellDates: true });
  // la hoja principal: la que más filas SIRE tiene (las "COMPRAS A DECLARAR"/"BIENES Y DET" son recortes)
  const hojas = wb.SheetNames.map(h => ({ h, ...leerHoja(XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, raw: true, defval: null })) }));
  const conDatos = hojas.filter(x => x.filas.length).sort((a, b) => b.filas.length - a.filas.length);
  if (!conDatos.length) { console.log(f, 'SIN DATOS'); continue; }
  const vistas = new Map(); let extra = 0;
  for (const hj of conDatos) for (const r of hj.filas) { const k = `${r.tipo}|${r.serie}|${r.numero.replace(/^0+/, '')}|${r.ruc}`; if (!vistas.has(k)) { vistas.set(k, r); if (hj !== conDatos[0]) extra++; } }
  const mejor = { h: conDatos.map(x => x.h).join(' + '), filas: [...vistas.values()], avisos: conDatos[0].avisos, cols: conDatos[0].cols };
  console.log(f, 'hojas', conDatos.map(x => x.h + '=' + x.filas.length).join(', '), '| extra fuera de la principal', extra);
  const por = {}; for (const r of mejor.filas) por[r.tipo] = (por[r.tipo] || 0) + 1;
  const monedas = {}; for (const r of mejor.filas) monedas[r.moneda] = (monedas[r.moneda] || 0) + 1;
  const sinTc = mejor.filas.filter(r => r.moneda === 'USD' && !(r.tc > 1)).length;
  console.log(f, '|', mejor.h, '|', mejor.filas.length, 'filas | tipos', JSON.stringify(por), '| monedas', JSON.stringify(monedas), '| USD sin TC', sinTc, '| det D', mejor.filas.filter(r => r.detraccion === 'D').length, '| col m', mejor.cols.m, 'tc', mejor.cols.tc, 'det', mejor.cols.det, mejor.avisos.join(';'));
  writeFileSync(`${out}/${f.replace('.xlsx', '')}.json`, JSON.stringify({ archivo: `${f} · ${mejor.h}`, filas: mejor.filas }));
}
