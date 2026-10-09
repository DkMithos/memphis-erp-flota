// Carga los pagos históricos 2024-2026 (historico_pagos.json) en transacciones, por el pooler con el rol temporal.
import pg from 'pg';
import fs from 'node:fs';

const TENANT = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
const RUTA = 'C:/Users/URSULA/AppData/Local/Temp/claude/C--Users-URSULA-Proyectos-memphis-erp-flota/8d33990c-93a6-418b-ae32-d99f46f984d7/scratchpad/gg/fin/historico_pagos.json';
const filas = JSON.parse(fs.readFileSync(RUTA, 'utf8'));

const c = new pg.Client({
  host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432,
  user: `${process.env.PGUSER}.icmuqwgrjgjoebnwunnf`, password: process.env.PGPASS, database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
try {
  const cuentas = Object.fromEntries((await c.query(`select nombre, id from cuentas_bancarias where tenant_id = $1`, [TENANT])).rows.map(r => [r.nombre, r.id]));
  const ctaPor = { '806': cuentas['BBVA Soles 806'], '830': cuentas['BBVA Dólares 830'], '545': cuentas['BBVA Soles 545 (hasta 2025)'], '553': cuentas['BBVA Dólares 553 (hasta 2025)'] };
  const ccs = Object.fromEntries((await c.query(`select codigo, id from centros_costo where tenant_id = $1`, [TENANT])).rows.map(r => [r.codigo, r.id]));
  for (const k of Object.keys(ctaPor)) if (!ctaPor[k]) throw new Error('Falta cuenta ' + k);

  await c.query('begin');
  const prev = await c.query(`delete from transacciones where tenant_id = $1 and referencia_tipo = 'historico_contabilidad'`, [TENANT]);
  console.log('borradas de una carga anterior:', prev.rowCount);

  const porAnio = {};
  const cols = ['tenant_id','numero','tipo','categoria','subcategoria','estado','monto','moneda','tipo_cambio','fecha','fecha_pago','descripcion','cuenta_bancaria_id','centro_costo_id','referencia_numero','referencia_tipo','proveedor_nombre','creado_por','aprobado_por','aprobado_en'];
  let insertadas = 0, sinCc = 0;
  for (let i = 0; i < filas.length; i += 400) {
    const lote = filas.slice(i, i + 400);
    const vals = []; const params = [];
    for (const f of lote) {
      const anio = f.fecha.slice(0, 4);
      porAnio[anio] = (porAnio[anio] ?? 0) + 1;
      const numero = `HIST-${anio}-${String(porAnio[anio]).padStart(4, '0')}`;
      const cc = f.cc ? ccs[f.cc] ?? null : null;
      if (!cc) sinCc++;
      const desc = [f.descripcion, f.comprobante ? `· ${f.tipo_doc ? f.tipo_doc + ' ' : ''}${f.comprobante}` : (f.tipo_doc ? `· ${f.tipo_doc}` : ''),
        f.cc_excel && !f.cc ? `· [CC Excel: ${f.cc_excel}]` : '', f.detraccion ? `· detracción ${f.detraccion}` : '', f.retencion ? `· retención ${f.retencion}` : '',
        f.cambio_moneda ? '· cambio de moneda' : '', `· ${f.origen} fila ${f.fila ?? '?'}`].filter(Boolean).join(' ');
      const row = [TENANT, numero, f.tipo, f.categoria, f.tipo_doc, 'pagada', f.monto, f.moneda, f.tc && f.tc > 1 ? f.tc : null, f.fecha, f.fecha,
        desc.slice(0, 500), ctaPor[f.cuenta], cc, f.ope, 'historico_contabilidad', f.proveedor, 'migracion:acumulado-contabilidad', 'migracion:acumulado-contabilidad', new Date()];
      const base = params.length;
      params.push(...row);
      vals.push('(' + row.map((_, j) => `$${base + j + 1}`).join(',') + ')');
    }
    const r = await c.query(`insert into transacciones (${cols.join(',')}) values ${vals.join(',')}`, params);
    insertadas += r.rowCount;
  }
  await c.query('commit');
  console.log('insertadas:', insertadas, 'sin centro de costo:', sinCc, 'por año:', porAnio);
} catch (e) {
  await c.query('rollback').catch(() => {});
  console.error('ERROR', e.message);
  process.exitCode = 1;
} finally { await c.end(); }
