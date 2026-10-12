// Semana 2 del plan de carga (2026-10-12) · carga el JSON de 2-parsear-sire-ventas.mjs con la función real `sire_importar_ventas`
// (corte 202601: 2025 entra como `historica`, 2026 como `emitida`) y después resuelve las notas de crédito: NC por el total de
// la factura → factura `anulada` (su asiento se revierte por trigger); NC parcial de 2026 → se contabiliza la nota.
// Uso: PGUSER=<rol_tmp> PGPASS=<clave> node 3-cargar-sire-ventas.mjs ventas.json [--commit]
import pg from 'pg';
import fs from 'node:fs';
const [ruta, flag] = process.argv.slice(2);
const commit = flag === '--commit';
const filas = JSON.parse(fs.readFileSync(ruta, 'utf8'));
const ADMIN = 'de040564-3d98-45cf-8fb5-6383e1c95df6';            // Administrador del tenant: solo atribución del permiso
const TENANT = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
const c = new pg.Client({ host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432, user: `${process.env.PGUSER}.icmuqwgrjgjoebnwunnf`, password: process.env.PGPASS, database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query('begin');
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ADMIN, role: 'authenticated', app_metadata: { tenant_id: TENANT } })]);
  const acc = {};
  for (let i = 0; i < filas.length; i += 150) {
    const lote = filas.slice(i, i + 150);
    const r = await c.query(`select sire_importar_ventas($1::jsonb, $2, '202601') v`, [JSON.stringify(lote), lote[0].archivo.split(' · ')[0]]);
    for (const [k, v] of Object.entries(r.rows[0].v)) acc[k] = (acc[k] ?? 0) + Number(v);
  }
  console.log('importar_ventas', filas.length, '→', JSON.stringify(acc));

  // Notas de crédito: anulan o ajustan la factura que modifican.
  let anuladas = 0, parciales = 0, sinFactura = 0, contabilizadasNC = 0, ncCruzadas = 0;
  for (const nc of filas.filter(x => x.tipo === '07' && x.mod_serie && x.mod_numero)) {
    const f = await c.query(
      `select id, total, periodo_sire, estado_flujo from comprobantes_pago where tenant_id = $1 and direccion = 'emitido' and tipo = $2 and upper(serie) = $3 and ltrim(numero, '0') = $4 limit 1`,
      [TENANT, nc.mod_tipo || '01', nc.mod_serie, nc.mod_numero.replace(/^0+/, '')]);
    const ncRow = await c.query(`select id, periodo_sire from comprobantes_pago where tenant_id = $1 and direccion = 'emitido' and tipo = '07' and upper(serie) = $2 and ltrim(numero, '0') = $3 limit 1`,
      [TENANT, nc.serie, nc.numero.replace(/^0+/, '')]);
    if (!f.rows[0] || !ncRow.rows[0]) { sinFactura++; continue; }
    const fac = f.rows[0];
    const etiqueta = `NC ${nc.serie}-${nc.numero.replace(/^0+/, '')} (${nc.fecha_emision}, tipo ${nc.tipo_nota || '?'})`;
    if (Math.abs(Number(fac.total) - Math.abs(Number(nc.total))) <= 0.05) {
      if (fac.estado_flujo !== 'anulada') {
        await c.query(`update comprobantes_pago set estado_flujo = 'anulada', observaciones = concat_ws(' · ', nullif(observaciones, ''), $2::text) where id = $1`,
          [fac.id, `Anulada por ${etiqueta} por el total`]);
        anuladas++;
        // Factura de un ejercicio cerrado anulada por una NC de 2026: la NC es el hecho contable de 2026 (la factura no tiene asiento).
        if (ncRow.rows[0].periodo_sire >= '202601' && fac.periodo_sire < '202601') {
          await c.query(`select set_config('app.sin_asiento', '0', true)`);
          await c.query(`select contabilizar_comprobante($1)`, [ncRow.rows[0].id]).catch(async e => {
            await c.query(`update comprobantes_pago set contabilizacion_error = left($2::text, 500) where id = $1`, [ncRow.rows[0].id, e.message]);
          });
          ncCruzadas++;
        }
      }
    } else {
      await c.query(`update comprobantes_pago set observaciones = concat_ws(' · ', nullif(observaciones, ''), $2::text) where id = $1`,
        [fac.id, `${etiqueta} ajusta ${nc.moneda} ${Math.abs(nc.total)} (parcial)`]);
      parciales++;
      if (ncRow.rows[0].periodo_sire >= '202601') {
        await c.query(`select set_config('app.sin_asiento', '0', true)`);
        await c.query(`select contabilizar_comprobante($1)`, [ncRow.rows[0].id]).catch(async e => {
          await c.query(`update comprobantes_pago set contabilizacion_error = left($2::text, 500) where id = $1`, [ncRow.rows[0].id, e.message]);
        });
        contabilizadasNC++;
      }
    }
  }
  console.log('notas de crédito →', JSON.stringify({ facturas_anuladas_por_nc: anuladas, nc_parciales: parciales, nc_parciales_2026_contabilizadas: contabilizadasNC, nc_2026_sobre_factura_2025_contabilizadas: ncCruzadas, nc_sin_factura_en_base: sinFactura }));

  const ver = await c.query(`
    select estado_flujo, tipo, count(*) n, round(sum(case when moneda = 'USD' then total * tipo_cambio else total end)) soles, count(cliente_id) con_cliente, count(asiento_id) con_asiento, count(contabilizacion_error) con_error
      from comprobantes_pago where tenant_id = $1 and direccion = 'emitido' group by 1, 2 order by 1, 2`, [TENANT]);
  console.table(ver.rows);
  const err = await c.query(`select numero_completo, left(contabilizacion_error, 90) e from comprobantes_pago where direccion = 'emitido' and contabilizacion_error is not null limit 5`);
  if (err.rows.length) console.table(err.rows);
  await c.query(commit ? 'commit' : 'rollback');
  console.log(commit ? '== COMMIT ==' : '== ROLLBACK (dry-run) ==');
} catch (e) {
  await c.query('rollback').catch(() => {});
  console.error('ERROR', e.message, e.detail ?? '', e.where ?? '');
  process.exitCode = 1;
} finally { await c.end(); }
