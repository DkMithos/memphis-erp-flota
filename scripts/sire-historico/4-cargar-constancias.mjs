// Carga historica del SIRE de compras 2024-2026 (2026-10-09). Secuencia: 1-parsear-sire.mjs <dir_xlsx> <dir_json>  ->  2-cargar-sire.mjs <dir_json> [--dry] [--corte=AAAAMM]
// Corre por el pooler (aws-1-sa-east-1) con un rol temporal BYPASSRLS (PGUSER/PGPASS) y el JWT de un usuario con compras.editar (el "sub" de abajo era un usuario QA ya borrado: cambiarlo).
// Carga las constancias de detracción de SUNAT (CSV 2024-2026 ya convertido a JSON) con la función real detracciones_importar_constancias.
import pg from 'pg';
import fs from 'node:fs';
const [ruta, ...rest] = process.argv.slice(2);
const dry = rest.includes('--dry');
const filas = JSON.parse(fs.readFileSync(ruta, 'utf8'));
const c = new pg.Client({ host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432, user: `${process.env.PGUSER}.icmuqwgrjgjoebnwunnf`, password: process.env.PGPASS, database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query('begin');
  await c.query(`select set_config('request.jwt.claims', '{"sub":"9a1c0000-0000-4000-8000-00000000f0f6","role":"authenticated","app_metadata":{"tenant_id":"e4b16a80-8500-418e-afaa-0e976b7d9b13"}}', true)`);
  const acc = {};
  for (let i = 0; i < filas.length; i += 300) {
    const r = await c.query(`select detracciones_importar_constancias($1::jsonb) v`, [JSON.stringify(filas.slice(i, i + 300))]);
    for (const [k, v] of Object.entries(r.rows[0].v)) acc[k] = (acc[k] ?? 0) + Number(v);
  }
  console.log('constancias', filas.length, '→', JSON.stringify(acc));
  // la factura del SIRE sin marca de detracción pero con constancia: se marca y se guarda el monto depositado
  const u = await c.query(`update comprobantes_pago cp set tiene_detraccion = true, detraccion_monto = coalesce(cp.detraccion_monto, d.monto_detraccion), detraccion_codigo = coalesce(cp.detraccion_codigo, d.codigo_bien_servicio)
                             from detracciones d where d.comprobante_id = cp.id and d.origen = 'sunat' and (cp.tiene_detraccion is distinct from true or cp.detraccion_monto is null)`);
  console.log('facturas marcadas con detracción desde la constancia:', u.rowCount);
  const q = await c.query(`select estado, origen, count(*) n, round(sum(monto_detraccion)) monto, count(comprobante_id) con_factura, min(fecha_deposito) desde, max(fecha_deposito) hasta from detracciones group by 1,2 order by 1,2`);
  console.table(q.rows);
  await c.query(dry ? 'rollback' : 'commit');
  console.log(dry ? 'DRY RUN: rollback' : 'COMMIT');
} catch (e) { await c.query('rollback'); console.error('ERROR, rollback:', e.message); process.exitCode = 1; } finally { await c.end(); }
