/**
 * Mantenimientos y kilometraje de la flota GORE ICA (50 camionetas L200 + 200 motos) · Excel de Operaciones → ERP.
 *
 * Fuente (carpeta Teams "GOBIERNO REGIONAL ICA OPERACIONES POSTVENTA"):
 *   - CAMIONETA MANTENIMIENTO PREVENTIVO/CONTROL DE MANTENIMIENTO CAMIONETAS ICA.xlsx
 *       hoja `mantenimientos historico` (un servicio por fila) y hoja `PRINCIPAL` (km actual por placa)
 *   - MOTOS MANTENIMIENTO PREVENTIVO/Cumplimiento mantenimientos preventivo Motos - Gore Ica.xlsx
 *       hoja `Cumplimiento` (un servicio por fila, por número de padrón)
 *
 * Es la continuación de scripts/migration-oc/migrar-flota-ica.mjs (2026-07-08): usa las MISMAS claves
 * idempotentes (uuid v5 de `vm:<vin>:<fecha>:<km_servicio>`), así que correrlo de nuevo no duplica nada:
 * lo que ya existe se actualiza (costo, OC, factura, odómetro) y lo nuevo se inserta.
 *
 * Uso:  node scripts/flota-ica/cargar-mantos-ica.mjs <carpeta con camionetas.xlsx y motos.xlsx> [--cargar]
 *       Sin --cargar solo informa (rollback). Variables: PGUSER (rol temporal BYPASSRLS), PGPASS.
 * Primera corrida: 2026-11-05 (206 servicios de camionetas jul-oct y ~475 de motos ene-jul 2026).
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const reqRepo = createRequire('C:/Users/URSULA/Proyectos/memphis-erp-flota/package.json');
const XLSX = reqRepo('xlsx');
const pg = createRequire(process.env.PGTOOL ?? 'C:/Users/URSULA/AppData/Local/Temp/claude/bae2337a37463163/8d33990c-93a6-418b-ae32-d99f46f984d7/scratchpad/pgtool/package.json')('pg');

const [dir, ...rest] = process.argv.slice(2);
const CARGAR = rest.includes('--cargar');
const TENANT = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
const CT_CAM = 'ed847689-d445-56da-a09f-0d9f32e1a283'; // Plan Perumotor L200 (USD)
const CT_MOT = '5f8b957e-2021-5fad-818c-524a78a60f40'; // Plan Promotora motos (PEN)
const FECHA_KM = process.env.FECHA_KM ?? '2026-11-04'; // fecha del último odómetro leído en campo (cabecera de ACTUALIZAR KM)
const NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function uuidv5(name, namespace) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(ns).update(Buffer.from(name, 'utf8')).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const id5 = (k) => uuidv5(k, NS);
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
const iso = (v) => {
  if (v instanceof Date) return isNaN(v) ? null : new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())).toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30 + v)).toISOString().slice(0, 10);
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null;
};
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.\-]/g, '')); return Number.isFinite(n) ? n : null; };

function hoja(wb, nombre, filaCabecera) {
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: null, range: filaCabecera });
  const cab = filas[0].map(norm);
  const col = (...nombres) => { for (const n of nombres) { const i = cab.findIndex((c) => c === norm(n) || c.startsWith(norm(n))); if (i >= 0) return i; } return -1; };
  return { filas: filas.slice(1), col };
}

// ── Camionetas: servicios ──
const wbCam = XLSX.readFile(join(dir, 'camionetas.xlsx'), { cellDates: true });
const hc = hoja(wbCam, 'mantenimientos historico', 1);
const cVin = hc.col('VIN'), cFecha = hc.col('FECHA DE SERVICIO'), cKm = hc.col('TIPO DE SERVICIO'), cDesc = hc.col('TIPO DE MANTENIMIENTO'),
  cConf = hc.col('CONFORMIDAD'), cCosto = hc.col('COSTO'), cOc = hc.col('OC'), cFac = hc.col('FACTURA'), cObs = hc.col('OBSERVACI');
const camSinVin = [];
const mantosCam = hc.filas.filter((r) => r && (r[cVin] || r[cFecha])).map((r) => ({
  vin: norm(r[cVin]), fecha: iso(r[cFecha]), km: num(r[cKm]), descripcion: r[cDesc] ? String(r[cDesc]).trim() : null,
  conformidad: r[cConf] ? String(r[cConf]).trim() : null, costo: num(r[cCosto]) ?? 0, oc: r[cOc] ? String(r[cOc]).trim() : null,
  factura: r[cFac] ? String(r[cFac]).trim() : null, obs: r[cObs] ? String(r[cObs]).trim() : null,
})).filter((m) => { if (!m.vin.startsWith('MMB')) { camSinVin.push(m); return false; } return !!m.fecha && m.km != null; });

// ── Camionetas: km actual (hoja PRINCIPAL, columnas por posición como 19-vehiculos-km-ica.mjs) ──
const principal = XLSX.utils.sheet_to_json(wbCam.Sheets.PRINCIPAL, { header: 1, raw: true, defval: null });
const kmCam = principal.slice(1).filter((r) => r && r[2] && /^[A-Z]{3}-\d{3}$/i.test(String(r[2]).trim()))
  .map((r) => ({ placa: norm(r[2]), km: num(r[7]) })).filter((k) => k.km && k.km > 0);

// ── Motos: servicios ──
const wbMot = XLSX.readFile(join(dir, 'motos.xlsx'), { cellDates: true });
const hm = hoja(wbMot, 'Cumplimiento', 1);
const mPad = hm.col('PADRON'), mSta = hm.col('STA'), mFp = hm.col('FECHA PROGRAMADA'), mRazon = hm.col('RAZON'), mKmR = hm.col('KM RUTINA'),
  mKmO = hm.col('KM ODOMETRO'), mFe = hm.col('FECHA EJECUCI'), mEst = hm.col('ESTADO'), mObs = hm.col('OBSERVACIONES');
const mantosMoto = hm.filas.filter((r) => r && r[mPad] != null).map((r) => ({
  padron: String(r[mPad]).trim(), taller: r[mSta] ? String(r[mSta]).trim() : null, fechaProg: iso(r[mFp]), fechaEjec: iso(r[mFe]),
  km: num(r[mKmR]), kmOdo: num(r[mKmO]), estado: String(r[mEst] ?? '').trim(), razon: r[mRazon] ? String(r[mRazon]).trim() : null,
  obs: r[mObs] ? String(r[mObs]).trim() : null,
})).filter((m) => (m.fechaEjec || m.fechaProg) && m.km != null);
const estadoMap = { EJECUTADO: 'ejecutado', 'NO EJECUTADO': 'no_ejecutado', REPROGRAMADO: 'reprogramado' };

console.log(`Excel: camionetas ${mantosCam.length} servicios (${camSinVin.length} filas sin VIN descartadas), km de ${kmCam.length} placas; motos ${mantosMoto.length} servicios`);

const c = new pg.Client({ host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432, user: `${process.env.PGUSER}.icmuqwgrjgjoebnwunnf`, password: process.env.PGPASS, database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query('begin');
  const { rows: vehs } = await c.query(`select v.id, v.vin, upper(v.placa) placa, v.numero_padron, f.codigo flota from vehiculos v join flotas f on f.id = v.flota_id where v.tenant_id = $1 and f.codigo in ('FL-ICA-CAM','FL-ICA-MOT')`, [TENANT]);
  const porVin = new Map(vehs.filter((v) => v.flota === 'FL-ICA-CAM').map((v) => [v.vin, v]));
  const porPlaca = new Map(vehs.filter((v) => v.flota === 'FL-ICA-CAM' && v.placa).map((v) => [v.placa, v]));
  const porPadron = new Map(vehs.filter((v) => v.flota === 'FL-ICA-MOT').map((v) => [String(v.numero_padron), v]));
  const { rows: tar } = await c.query('select km_servicio, costo from flota_contrato_tarifas where contrato_id = $1', [CT_MOT]);
  const tarifaMoto = new Map(tar.map((t) => [Number(t.km_servicio), Number(t.costo)]));
  const { rows: antes } = await c.query('select contrato_id, count(*)::int n from vehiculo_mantenimientos where contrato_id in ($1,$2) group by 1', [CT_CAM, CT_MOT]);
  const existentes = new Set((await c.query('select id from vehiculo_mantenimientos where contrato_id in ($1,$2)', [CT_CAM, CT_MOT])).rows.map((r) => r.id));

  const res = { camionetas: { nuevos: 0, existentes: 0, sin_vehiculo: 0, costo_nuevos: 0 }, motos: { nuevos: 0, existentes: 0, sin_vehiculo: 0 }, km: { camionetas: 0, motos: 0 } };
  for (const s of mantosCam) {
    const v = porVin.get(s.vin); if (!v) { res.camionetas.sin_vehiculo++; continue; }
    const id = id5(`vm:${s.vin}:${s.fecha}:${s.km}`);
    if (existentes.has(id)) res.camionetas.existentes++; else { res.camionetas.nuevos++; res.camionetas.costo_nuevos += s.costo; }
    await c.query(`insert into vehiculo_mantenimientos (id, tenant_id, vehiculo_id, contrato_id, km_servicio, fecha_ejecucion, estado, costo, moneda, oc_numero, factura, conformidad, observaciones, origen)
      values ($1,$2,$3,$4,$5,$6,'ejecutado',$7,'USD',$8,$9,$10,$11,'migrado-excel')
      on conflict (id) do update set costo = excluded.costo, oc_numero = coalesce(excluded.oc_numero, vehiculo_mantenimientos.oc_numero), factura = coalesce(excluded.factura, vehiculo_mantenimientos.factura), conformidad = coalesce(excluded.conformidad, vehiculo_mantenimientos.conformidad)`,
      [id, TENANT, v.id, CT_CAM, s.km, s.fecha, s.costo, s.oc, s.factura, s.conformidad, [s.descripcion, s.obs].filter(Boolean).join(' | ') || null]);
  }
  for (const s of mantosMoto) {
    const v = porPadron.get(s.padron); if (!v) { res.motos.sin_vehiculo++; continue; }
    const fecha = s.fechaEjec || s.fechaProg;
    const id = id5(`vm:${v.vin}:${fecha}:${s.km}`);
    if (existentes.has(id)) res.motos.existentes++; else res.motos.nuevos++;
    await c.query(`insert into vehiculo_mantenimientos (id, tenant_id, vehiculo_id, contrato_id, km_servicio, km_odometro, fecha_programada, fecha_ejecucion, estado, taller, costo, moneda, observaciones, origen)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PEN',$12,'migrado-excel')
      on conflict (id) do update set km_odometro = coalesce(excluded.km_odometro, vehiculo_mantenimientos.km_odometro), fecha_ejecucion = coalesce(excluded.fecha_ejecucion, vehiculo_mantenimientos.fecha_ejecucion), estado = excluded.estado`,
      [id, TENANT, v.id, CT_MOT, s.km, s.kmOdo, s.fechaProg, s.fechaEjec, estadoMap[norm(s.estado)] ?? 'ejecutado', s.taller, tarifaMoto.get(s.km) ?? null, [s.razon, s.obs].filter(Boolean).join(' | ') || null]);
  }
  // Kilometraje: camionetas desde PRINCIPAL (el odómetro no retrocede); motos desde cada servicio con odómetro.
  for (const k of kmCam) {
    const v = porPlaca.get(k.placa); if (!v) continue;
    await c.query(`insert into vehiculo_km_lecturas (id, tenant_id, vehiculo_id, fecha, km, fuente) values ($1,$2,$3,$4,$5,'masivo') on conflict (vehiculo_id, fecha, fuente) do update set km = greatest(vehiculo_km_lecturas.km, excluded.km)`,
      [id5(`kml:${v.vin}:${FECHA_KM}`), TENANT, v.id, FECHA_KM, Math.round(k.km)]);
    await c.query(`update vehiculos set kilometraje = greatest(coalesce(kilometraje, 0), $2), fuente_km = 'control-excel', modificado_en = now() where id = $1`, [v.id, Math.round(k.km)]);
    res.km.camionetas++;
  }
  const ml = await c.query(`insert into vehiculo_km_lecturas (id, tenant_id, vehiculo_id, fecha, km, fuente)
    select gen_random_uuid(), tenant_id, vehiculo_id, fecha_ejecucion, km_odometro, 'mantenimiento' from vehiculo_mantenimientos
    where tenant_id = $1 and contrato_id = $2 and km_odometro is not null and fecha_ejecucion is not null
    on conflict (vehiculo_id, fecha, fuente) do nothing`, [TENANT, CT_MOT]);
  res.km.motos = ml.rowCount;
  await c.query(`update vehiculos v set kilometraje = greatest(coalesce(v.kilometraje, 0), x.km), fuente_km = 'control-excel' from (select vehiculo_id, max(km_odometro) km from vehiculo_mantenimientos where contrato_id = $1 and km_odometro is not null group by 1) x where x.vehiculo_id = v.id and x.km > coalesce(v.kilometraje, 0)`, [CT_MOT]);
  await c.query(`update vehiculos v set ultimo_mantenimiento = x.f from (select vehiculo_id, max(fecha_ejecucion) f from vehiculo_mantenimientos where contrato_id in ($1,$2) and fecha_ejecucion is not null group by 1) x where x.vehiculo_id = v.id and (v.ultimo_mantenimiento is null or v.ultimo_mantenimiento < x.f)`, [CT_CAM, CT_MOT]);

  const { rows: despues } = await c.query(`select contrato_id, count(*)::int n, max(fecha_ejecucion)::text ultimo, count(*) filter (where fecha_ejecucion >= '2026-07-01')::int desde_jul from vehiculo_mantenimientos where contrato_id in ($1,$2) group by 1`, [CT_CAM, CT_MOT]);
  console.log(JSON.stringify({ antes, resultado: res, despues }, null, 1));
  await c.query(CARGAR ? 'commit' : 'rollback');
  console.log(CARGAR ? 'COMMIT' : 'DRY RUN: rollback');
} catch (e) { await c.query('rollback'); console.error('ERROR, rollback:', e.message); process.exitCode = 1; } finally { await c.end(); }
