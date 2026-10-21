// 2026-10-21 · Aplica al ERP las correcciones del Excel "Pagos acumulados 2026 con CC (1).xlsx" (Contabilidad) sobre HIST-2026,
// con el plan.json de 4-cruzar-2026.py. NO recarga: de HIST-2026 cuelgan 370 facturas, 370 compromisos y 429 asientos, así que
// solo toca lo que cambió, en UNA transacción:
//   1) updates de OPE (referencia_numero) y centro de costo, dejando nota en la descripción;
//   2) borra las filas que Contabilidad partió por operación (sin asiento ni movimiento conciliado; se verifica);
//   3) inserta las filas nuevas numeradas a continuación (HIST-2026-1195…), heredando factura/compromiso de la fila partida;
//   4) vuelve a conciliar por OPE con bancos_conciliar_auto (claims de Kevin) en BBVA 806 y 830;
//   5) verifica totales por moneda (deben quedar iguales) y conciliación. Rollback salvo --commit.
// Uso: PGUSER=<rol temporal> PGPASS=<clave> node 5-corregir-2026.mjs <plan.json> [--commit]   (pg se resuelve desde PGTOOL)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const PGTOOL = process.env.PGTOOL ?? 'C:/Users/URSULA/AppData/Local/Temp/claude/C--Users-URSULA-Proyectos-memphis-erp-flota/8d33990c-93a6-418b-ae32-d99f46f984d7/scratchpad/pgtool';
const pg = createRequire(PGTOOL + '/package.json')('pg');
const TENANT = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
const KEVIN = 'de040564-3d98-45cf-8fb5-6383e1c95df6';
const NOTA = '· corregido 21/10/2026 (Pagos acumulados 2026 con CC, Contabilidad)';
const [,, ruta, flag] = process.argv;
const plan = JSON.parse(fs.readFileSync(ruta, 'utf8'));
const c = new pg.Client({ host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432, user: `${process.env.PGUSER}.icmuqwgrjgjoebnwunnf`, password: process.env.PGPASS, database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
const resumen = async (etiqueta) => {
  const r = (await c.query(`select count(*)::int n, count(movimiento_bancario_id)::int con_mov, count(comprobante_id)::int con_fact, count(asiento_id)::int con_asiento,
      round(sum(monto) filter (where moneda='PEN'),2) pen, round(sum(monto) filter (where moneda='USD'),2) usd,
      (select count(*)::int from movimientos_bancarios m where m.tenant_id = $1 and m.fecha_operacion between '2026-01-01' and '2026-07-31' and m.importe < 0 and m.transaccion_id is not null) cargos_conciliados_ene_jul
    from transacciones where tenant_id = $1 and numero like 'HIST-2026-%'`, [TENANT])).rows[0];
  console.log(etiqueta, r); return r;
};
try {
  const cuentas = Object.fromEntries((await c.query(`select nombre, id from cuentas_bancarias where tenant_id = $1`, [TENANT])).rows.map(r => [r.nombre, r.id]));
  const ctaPor = { '806': cuentas['BBVA Soles 806'], '830': cuentas['BBVA Dólares 830'] };
  for (const k of Object.keys(ctaPor)) if (!ctaPor[k]) throw new Error('Falta cuenta ' + k);
  const ccs = Object.fromEntries((await c.query(`select codigo, id from centros_costo where tenant_id = $1`, [TENANT])).rows.map(r => [r.codigo, r.id]));

  await c.query('begin');
  // Sin asientos: las facturas de 2025 pagadas con HIST no se contabilizan en el ERP (año cerrado); sin esta marca, recalc_pago_compromiso
  // dispararía trg_comprobante_contabilizar (AST-2025-…) y luego el asiento de pago de cada parte. Igual que en 2-cargar.mjs.
  await c.query(`select set_config('app.sin_asiento', '1', true)`);
  const antes = await resumen('antes:');

  // 1) updates OPE / CC
  let nUpd = 0, nDesv = 0;
  for (const u of plan.upd) {
    const sets = [], params = [u.id];
    if (u.ope) { params.push(u.ope[1]); sets.push(`referencia_numero = $${params.length}`); }
    if (u.cc) { if (!ccs[u.cc[1]]) throw new Error('CC desconocido ' + u.cc[1]); params.push(ccs[u.cc[1]]); sets.push(`centro_costo_id = $${params.length}`); }
    const nota = `${NOTA}${u.ope ? ` OPE ${u.ope[0] ?? '—'}→${u.ope[1]}` : ''}${u.cc ? ` CC ${u.cc[0] ?? '—'}→${u.cc[1]}` : ''}`;
    params.push(nota); sets.push(`descripcion = left(concat_ws(' ', descripcion, $${params.length}::text), 500)`);
    if (u.ope && u.mov) { // conciliado con el OPE viejo: soltar ambos lados para que se vuelva a conciliar
      await c.query(`update movimientos_bancarios set transaccion_id = null, conciliado_en = null, conciliado_por = null where transaccion_id = $1`, [u.id]);
      sets.push(`movimiento_bancario_id = null`, `conciliado_en = null`); nDesv++;
    }
    nUpd += (await c.query(`update transacciones set ${sets.join(', ')} where id = $1 and tenant_id = '${TENANT}'`, params)).rowCount;
  }
  console.log('updates aplicados:', nUpd, 'de', plan.upd.length, '· desvinculados del banco:', nDesv);

  // estado previo de los compromisos que heredan (recalc_pago_compromiso los recalcula al borrar/insertar)
  const comprIds = [...new Set(plan.hereda.map(h => h.compr).filter(Boolean))];
  const fcAntes = (await c.query(`select id, estado_pago, fecha_pagado, monto_pagado from flujo_compromisos where id = any($1::uuid[])`, [comprIds])).rows;
  const cpAntes = (await c.query(`select id, estado, estado_flujo, asiento_id from comprobantes_pago where id = any($1::uuid[])`, [[...new Set(plan.hereda.map(h => h.comp).filter(Boolean))]])).rows;

  // 2) borrar filas partidas (verificando que nada cuelgue de ellas)
  const chk = (await c.query(`select numero, movimiento_bancario_id mov, asiento_id asi,
      (select count(*) from movimientos_bancarios m where m.transaccion_id = t.id) movs,
      (select count(*) from lotes_pago_items l where l.transaccion_id = t.id) + (select count(*) from detracciones d where d.transaccion_id = t.id) + (select count(*) from retenciones_percepciones r where r.transaccion_id = t.id) otros
    from transacciones t where id = any($1::uuid[])`, [plan.borrar])).rows;
  const sucias = chk.filter(r => r.mov || r.asi || Number(r.movs) || Number(r.otros));
  if (sucias.length) throw new Error('Filas a borrar con enlaces: ' + JSON.stringify(sucias));
  if (chk.length !== plan.borrar.length) throw new Error(`Se esperaban ${plan.borrar.length} filas a borrar, hay ${chk.length}`);
  const del = await c.query(`delete from transacciones where tenant_id = $1 and id = any($2::uuid[]) and referencia_tipo = 'historico_contabilidad'`, [TENANT, plan.borrar]);
  console.log('borradas:', del.rowCount, plan.borrar_num.join(' '));

  // 3) insertar filas nuevas a continuación del último número
  const max = (await c.query(`select coalesce(max(substring(numero from 11)::int), 0) n from transacciones where tenant_id = $1 and numero like 'HIST-2026-%'`, [TENANT])).rows[0].n;
  const hereda = Object.fromEntries(plan.hereda.map(h => [h.fila, h]));
  const cols = ['tenant_id','numero','tipo','categoria','subcategoria','estado','monto','moneda','tipo_cambio','fecha','fecha_pago','descripcion','cuenta_bancaria_id','centro_costo_id','referencia_numero','referencia_tipo','proveedor_nombre','creado_por','aprobado_por','aprobado_en','comprobante_id','compromiso_id'];
  let n = Number(max), ins = 0, sinCc = 0, conFact = 0;
  const vals = [], params = [];
  for (const f of plan.insertar) {
    n++;
    const numero = `HIST-2026-${String(n).padStart(4, '0')}`;
    const cc = f.cc ? ccs[f.cc] ?? null : null; if (!cc) sinCc++;
    const h = hereda[f.fila]; if (h) conFact++;
    const desc = [f.descripcion, f.comprobante ? `· ${f.tipo_doc ? f.tipo_doc + ' ' : ''}${f.comprobante}` : (f.tipo_doc ? `· ${f.tipo_doc}` : ''),
      f.cc_excel && !f.cc ? `· [CC Excel: ${f.cc_excel}]` : '', f.cambio_moneda ? '· cambio de moneda' : '', `· ${f.origen} fila ${f.fila} (Contabilidad 21/10/2026)`, h ? `· parte de ${h.de}` : ''].filter(Boolean).join(' ');
    const row = [TENANT, numero, f.tipo, f.categoria, f.tipo_doc, 'pagada', f.monto, f.moneda, null, f.fecha, f.fecha, desc.slice(0, 500), ctaPor[f.cuenta], cc, f.ope, 'historico_contabilidad', f.proveedor, 'migracion:acumulado-contabilidad', 'migracion:acumulado-contabilidad', new Date(), h?.comp ?? null, h?.compr ?? null];
    const base = params.length; params.push(...row); vals.push('(' + row.map((_, j) => `$${base + j + 1}`).join(',') + ')');
  }
  if (vals.length) ins = (await c.query(`insert into transacciones (${cols.join(',')}) values ${vals.join(',')}`, params)).rowCount;
  console.log('insertadas:', ins, `(HIST-2026-${String(Number(max) + 1).padStart(4, '0')} … HIST-2026-${String(n).padStart(4, '0')})`, '· sin CC:', sinCc, '· con factura heredada:', conFact);

  // 3b) el compromiso partido sigue pagado como estaba (la diferencia es detracción/retención, ya anotada en observaciones)
  for (const f of fcAntes) {
    const r = (await c.query(`update flujo_compromisos set estado_pago = $2, fecha_pagado = $3 where id = $1 and monto_pagado = $4 and (estado_pago is distinct from $2 or fecha_pagado is distinct from $3) returning estado_pago`, [f.id, f.estado_pago, f.fecha_pagado, f.monto_pagado])).rowCount;
    console.log('compromiso', f.id, 'restaurado a', f.estado_pago, r ? '(sí)' : '(sin cambio)');
  }
  for (const f of cpAntes) {
    const r = (await c.query(`update comprobantes_pago set estado_flujo = $2 where id = $1 and estado_flujo is distinct from $2 returning estado_flujo`, [f.id, f.estado_flujo])).rowCount;
    console.log('factura', f.id, 'estado_flujo', f.estado_flujo, 'asiento previo', f.asiento_id, r ? '(restaurado)' : '(sin cambio)');
  }
  // control: con app.sin_asiento no debe haber asientos nuevos en esta transacción
  const asientosNuevos = (await c.query(`select a.numero, a.fecha, a.glosa, a.estado, a.total_debe, a.origen_modulo, (select string_agg(l.cuenta_codigo || ' D' || l.debe || ' H' || l.haber, ' | ' order by l.numero_linea) from asientos_lineas l where l.asiento_id = a.id) lineas
      from asientos_contables a where a.tenant_id = $1 and a.creado_en >= transaction_timestamp() order by a.numero`, [TENANT])).rows;
  console.log('asientos nuevos:', asientosNuevos.length); for (const a of asientosNuevos) console.log('  ', a.numero, a.fecha, a.estado, a.total_debe, a.glosa, '::', a.lineas);
  if (asientosNuevos.length) throw new Error('Se generaron asientos; revisar app.sin_asiento');

  // 4) conciliar por OPE con los claims de Kevin
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: KEVIN, role: 'authenticated', app_metadata: { tenant_id: TENANT } })]);
  await c.query(`set local role authenticated`);
  for (const k of ['806', '830']) console.log('conciliación', k, (await c.query(`select bancos_conciliar_auto($1) as r`, [ctaPor[k]])).rows[0].r);
  await c.query(`reset role`);
  console.log('conciliados en esta corrida por importe (revisar):', (await c.query(`select m.numero_doc, m.fecha_operacion::text f, m.importe, m.concepto, t.numero, t.referencia_numero ope_trx, t.proveedor_nombre
      from movimientos_bancarios m join transacciones t on t.id = m.transaccion_id where m.tenant_id = $1 and m.conciliado_en >= transaction_timestamp() and m.conciliado_por = 'auto:importe'`, [TENANT])).rows);

  // 5) verificación
  const despues = await resumen('después:');
  if (despues.pen !== antes.pen || despues.usd !== antes.usd) throw new Error(`Totales cambiaron: PEN ${antes.pen}→${despues.pen} USD ${antes.usd}→${despues.usd}`);
  const feb = (await c.query(`select t.moneda, count(*)::int n, count(t.movimiento_bancario_id)::int con_mov, round(sum(t.monto),2) monto
      from transacciones t where t.tenant_id = $1 and t.numero like 'HIST-2026-%' and t.fecha = '2026-02-27' and t.moneda = 'USD' and t.proveedor_nombre in ('KPN PERU SAC', 'PERUANA DE MOTORES H.G.') group by 1`, [TENANT])).rows;
  console.log('KPN + PERUANA DE MOTORES 27/02 USD:', feb);
  const facturas = (await c.query(`select cp.numero_completo, cp.estado, fc.estado_pago, fc.monto_pagado, (select round(sum(monto),2) from transacciones x where x.comprobante_id = cp.id) pagado_trx
      from comprobantes_pago cp join flujo_compromisos fc on fc.comprobante_id = cp.id where cp.id = any($1::uuid[])`, [[...new Set(plan.hereda.map(h => h.comp))]])).rows;
  console.log('facturas heredadas:', facturas);
  console.log('facturas heredadas, asiento_id después:', (await c.query(`select numero_completo, asiento_id, estado_flujo from comprobantes_pago where id = any($1::uuid[])`, [cpAntes.map(f => f.id)])).rows);
  if (flag === '--commit') { await c.query('commit'); console.log('== COMMIT =='); } else { await c.query('rollback'); console.log('== ROLLBACK (dry-run) =='); }
} catch (e) {
  await c.query('rollback').catch(() => {});
  console.error('ERROR', e.message, e.detail ?? ''); process.exitCode = 1;
} finally { await c.end(); }
