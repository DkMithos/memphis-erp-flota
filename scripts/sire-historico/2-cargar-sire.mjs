// Carga historica del SIRE de compras 2024-2026 (2026-10-09). Secuencia: 1-parsear-sire.mjs <dir_xlsx> <dir_json>  ->  2-cargar-sire.mjs <dir_json> [--dry] [--corte=AAAAMM]
// Corre por el pooler (aws-1-sa-east-1) con un rol temporal BYPASSRLS (PGUSER/PGPASS) y el JWT de un usuario con compras.editar (el "sub" de abajo era un usuario QA ya borrado: cambiarlo).
// Carga los SIRE (JSON ya parseados) llamando a la función real sire_importar_compras con el JWT del usuario QA.
// Uso: node cargar_sire.mjs <dir_json> [--dry] [archivos...]
import pg from 'pg';
import fs from 'node:fs';
const [dir, ...rest] = process.argv.slice(2);
const dry = rest.includes('--dry');
const corte = (rest.find(x => x.startsWith('--corte=')) ?? '').split('=')[1] || null;
const solo = rest.filter(x => !x.startsWith('--'));
const c = new pg.Client({ host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432, user: `${process.env.PGUSER}.icmuqwgrjgjoebnwunnf`, password: process.env.PGPASS, database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query('begin');
  await c.query(`select set_config('request.jwt.claims', '{"sub":"9a1c0000-0000-4000-8000-00000000f0f6","role":"authenticated","app_metadata":{"tenant_id":"e4b16a80-8500-418e-afaa-0e976b7d9b13"}}', true)`);
  const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.json') && (!solo.length || solo.includes(f.replace('.json', '')))).sort();
  const total = {};
  for (const f of archivos) {
    const { archivo, filas } = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
    const acc = {};
    for (let i = 0; i < filas.length; i += 200) {
      const r = await c.query(`select sire_importar_compras($1::jsonb, $2, $3) v`, [JSON.stringify(filas.slice(i, i + 200)), archivo, corte]);
      for (const [k, v] of Object.entries(r.rows[0].v)) { acc[k] = (acc[k] ?? 0) + Number(v); total[k] = (total[k] ?? 0) + Number(v); }
    }
    console.log(f.padEnd(10), String(filas.length).padStart(5), 'filas →', JSON.stringify(acc)); console.log('   corte', corte);
  }
  console.log('TOTAL', JSON.stringify(total));
  const q = await c.query(`select origen, estado_flujo, count(*) n, sum(total) filter (where moneda='PEN') pen, sum(total) filter (where moneda='USD') usd from comprobantes_pago where tenant_id='e4b16a80-8500-418e-afaa-0e976b7d9b13' group by 1,2 order by 1,2`);
  console.table(q.rows);
  const q2 = await c.query(`select left(periodo_sire,4) anio, estado_flujo, count(*) n, round(sum(total) filter (where moneda='PEN')) pen, round(sum(total) filter (where moneda='USD')) usd from comprobantes_pago where origen='sire' group by 1,2 order by 1,2`);
  console.table(q2.rows);
  const q3 = await c.query(`select numero_completo, periodo_sire, moneda, total, estado_flujo, left(observaciones, 90) obs from comprobantes_pago where origen='sire' and estado_flujo='conforme' and periodo_sire < '202609' order by total desc limit 8`);
  console.table(q3.rows);
  const q4 = await c.query(`select count(*) compromisos_pendientes_sire, round(sum(coalesce(monto_presupuestado,0) - coalesce(monto_pagado,0))) pendiente from flujo_compromisos fc join comprobantes_pago cp on cp.id = fc.comprobante_id where cp.origen='sire' and fc.estado_pago <> 'PAGADO'`);
  console.table(q4.rows);
  await c.query(dry ? 'rollback' : 'commit');
  console.log(dry ? 'DRY RUN: rollback' : 'COMMIT');
} catch (e) { await c.query('rollback'); console.error('ERROR, rollback:', e.message); process.exitCode = 1; } finally { await c.end(); }
