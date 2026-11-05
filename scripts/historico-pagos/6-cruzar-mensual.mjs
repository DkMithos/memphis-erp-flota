/**
 * Cruce de los PAGOS 2026MM.xlsx de Contabilidad (hojas `806 SOLES` / `830 DOLARES`, un comprobante por fila con su OPE)
 * contra el ERP: factura (comprobantes_pago), compromiso (Cuentas por pagar) y cargo del banco (movimientos_bancarios).
 * Sin --cargar solo informa y deja plan.json. Con --cargar registra el pago de cada factura (una transacción por fila,
 * como lo haría bancos_pagar_facturas), concilia el cargo y deja la factura pagada; todo en una transacción.
 *
 * Entrada: JSON de egresos (ver docs/CONTEXTO-SESION.md 2026-11-05: egresos_ago_sep.json con mes, cuenta, moneda, fecha, ope,
 * monto, tipo, comprobante, razon, cc, categoria, descripcion). Uso:
 *   PGUSER=<rol temporal> PGPASS=<clave> node scripts/historico-pagos/6-cruzar-mensual.mjs <egresos.json> <plan.json> [--cargar]
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const pg = createRequire(process.env.PGTOOL ?? 'C:/Users/URSULA/AppData/Local/Temp/claude/bae2337a37463163/8d33990c-93a6-418b-ae32-d99f46f984d7/scratchpad/pgtool/package.json')('pg');
const [entrada, salida, ...rest] = process.argv.slice(2);
const CARGAR = rest.includes('--cargar');
const TENANT = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';
const KEVIN = 'f75a09b6-9825-48e7-a5d7-28a01a1e832b';
const CUENTAS = { '806': 'BBVA Soles 806', '830': 'BBVA Dólares 830' };
const TIPOS_DOC = new Set(['FACTURA', 'RECIBO', 'BOLETA', 'RECIBO POR HONORARIO', 'NOTA DE DEBITO']);

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const clave = (comp) => {
  const m = String(comp ?? '').trim().toUpperCase().match(/^([A-Z0-9]{1,4})\s*-\s*0*(\d{1,8})$/);
  return m ? { serie: m[1], numero: m[2] } : null;
};
const ope10 = (o) => { const s = String(o ?? '').trim(); return /^\d+$/.test(s) ? s.padStart(10, '0') : s; };

const filas = JSON.parse(fs.readFileSync(entrada, 'utf8'));
const c = new pg.Client({ host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432, user: `${process.env.PGUSER}.icmuqwgrjgjoebnwunnf`, password: process.env.PGPASS, database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query('begin');
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: KEVIN, role: 'authenticated', app_metadata: { tenant_id: TENANT } })]);
  const cuentas = Object.fromEntries((await c.query(`select nombre, id, moneda from cuentas_bancarias where tenant_id = $1`, [TENANT])).rows.map((r) => [r.nombre, r]));
  const ctaId = { '806': cuentas[CUENTAS['806']].id, '830': cuentas[CUENTAS['830']].id };

  // Facturas recibidas vivas, con su compromiso y lo pendiente
  const { rows: facts } = await c.query(`
    select c.id, upper(c.serie) serie, ltrim(regexp_replace(c.numero, '[^0-9]', '', 'g'), '0') numero, c.numero_completo, c.ruc_emisor, c.razon_social_emisor, c.moneda, c.total::float total,
           c.estado_flujo, c.tiene_detraccion, c.fecha_emision::text fe, fc.id compromiso_id, fc.centro_costo_id, fc.proyecto_id, fc.orden_compra_id, fc.categoria, fc.estado_pago,
           greatest(coalesce(fc.monto_presupuestado, fc.monto_ejecutado, c.total) - coalesce(fc.monto_pagado, 0), 0)::float pendiente
      from comprobantes_pago c left join flujo_compromisos fc on fc.comprobante_id = c.id
     where c.tenant_id = $1 and c.direccion = 'recibido' and c.estado = 'activo' and coalesce(c.estado_flujo, '') <> 'anulada'`, [TENANT]);
  const porClave = new Map();
  for (const f of facts) { const k = `${f.serie}-${f.numero}`; if (!porClave.has(k)) porClave.set(k, []); porClave.get(k).push(f); }

  // Cargos del banco ago-set con su estado de conciliación
  const { rows: movs } = await c.query(`
    select m.id, m.cuenta_bancaria_id, m.fecha_operacion::text fecha, m.numero_doc ope, m.importe::float importe, m.transaccion_id, m.clasificacion, m.concepto,
           t.numero trx_numero, t.comprobante_id trx_comprobante, t.categoria trx_categoria
      from movimientos_bancarios m left join transacciones t on t.id = m.transaccion_id
     where m.tenant_id = $1 and m.importe < 0 and m.fecha_operacion between '2026-08-01' and '2026-09-30'`, [TENANT]);
  const movPor = new Map();
  for (const m of movs) { const k = `${m.cuenta_bancaria_id}|${m.ope}`; if (!movPor.has(k)) movPor.set(k, []); movPor.get(k).push(m); }

  // Cruce fila a fila
  const plan = []; const res = { filas: filas.length, con_doc: 0, factura_ok: 0, factura_varias: 0, factura_no: 0, ya_pagada: 0, sin_compromiso: 0, moneda_distinta: 0, mov_ok: 0, mov_no: 0, mov_con_trx: 0, mov_con_trx_factura: 0, sin_doc: 0 };
  const porOpe = new Map();
  for (const r of filas) {
    const k = clave(r.comprobante);
    if (!TIPOS_DOC.has(r.tipo) || !k) { res.sin_doc++; continue; }
    res.con_doc++;
    let cands = porClave.get(`${k.serie}-${k.numero}`) ?? [];
    if (cands.length > 1) {
      const n = norm(r.razon).slice(0, 10);
      const porNombre = cands.filter((f) => norm(f.razon_social_emisor).slice(0, 10) === n || norm(f.razon_social_emisor).includes(n));
      if (porNombre.length >= 1) cands = porNombre;
      if (cands.length > 1) { const porMon = cands.filter((f) => f.moneda === r.moneda); if (porMon.length >= 1) cands = porMon; }
    }
    if (cands.length > 1) { // desempate por importe: la factura cuyo total está más cerca de lo pagado (sin pasarse del 15 %)
      const cerca = cands.filter((f) => f.total >= r.monto - 0.5 && r.monto >= f.total * 0.85);
      if (cerca.length === 1) cands = cerca;
    }
    if (cands.length === 0) { res.factura_no++; plan.push({ ...r, estado: 'sin_factura' }); continue; }
    if (cands.length > 1) { res.factura_varias++; plan.push({ ...r, estado: 'factura_ambigua', candidatos: cands.map((f) => `${f.numero_completo} ${f.ruc_emisor} ${f.moneda} ${f.total}`) }); continue; }
    const f = cands[0];
    if (f.moneda !== r.moneda) res.moneda_distinta++; // se paga igual: el banco pagó en la moneda de la cuenta; recalc convierte con el TC del compromiso
    if (f.estado_flujo === 'pagada' || (f.compromiso_id && f.pendiente <= 0.01)) { res.ya_pagada++; plan.push({ ...r, estado: 'ya_pagada', factura: f.numero_completo }); continue; }
    if (!f.compromiso_id && f.estado_flujo !== 'historica') { res.sin_compromiso++; plan.push({ ...r, estado: 'sin_compromiso', factura: f.numero_completo, factura_estado: f.estado_flujo }); continue; }
    if (f.estado_flujo === 'historica') res.historica = (res.historica ?? 0) + 1;
    res.factura_ok++;
    const ms = movPor.get(`${ctaId[r.cuenta]}|${ope10(r.ope)}`) ?? [];
    const m = ms.find((x) => x.fecha === r.fecha) ?? ms[0];
    if (!m) { res.mov_no++; plan.push({ ...r, estado: 'factura_ok_sin_movimiento', factura: f.numero_completo, comprobante_id: f.id, compromiso_id: f.compromiso_id, pendiente: f.pendiente }); continue; }
    if (m.transaccion_id) { if (m.trx_comprobante) res.mov_con_trx_factura++; else res.mov_con_trx++; }
    else res.mov_ok++;
    const filasOpe = filas.filter((x) => x.cuenta === r.cuenta && ope10(x.ope) === ope10(r.ope)).length;
    const item = { ...r, estado: m.transaccion_id ? (m.trx_comprobante ? 'movimiento_ya_paga_factura' : (filasOpe === 1 ? 'reusar_trx_generica' : 'revisar_trx_generica_multiple')) : 'listo', filas_ope: filasOpe, factura_estado: f.estado_flujo, factura: f.numero_completo, comprobante_id: f.id, compromiso_id: f.compromiso_id,
      pendiente: f.pendiente, total: f.total, tiene_detraccion: f.tiene_detraccion, centro_costo_id: f.centro_costo_id, proyecto_id: f.proyecto_id, orden_compra_id: f.orden_compra_id, categoria: f.categoria, razon_erp: f.razon_social_emisor,
      mov_id: m.id, mov_importe: m.importe, mov_fecha: m.fecha, mov_trx: m.trx_numero, mov_trx_categoria: m.trx_categoria };
    plan.push(item);
    const ko = `${r.cuenta}|${ope10(r.ope)}`; if (!porOpe.has(ko)) porOpe.set(ko, []); porOpe.get(ko).push(item);
  }
  // Por OPE: ¿la suma de las filas cuadra con el cargo?
  let opeCuadra = 0, opeNoCuadra = 0; const detalleOpe = [];
  for (const [ko, items] of porOpe) {
    const sumaExcel = filas.filter((r) => `${r.cuenta}|${ope10(r.ope)}` === ko).reduce((s, r) => s + r.monto, 0);
    const imp = Math.abs(items[0].mov_importe);
    const ok = Math.abs(sumaExcel - imp) <= Math.max(imp * 0.01, 1);
    if (ok) opeCuadra++; else { opeNoCuadra++; detalleOpe.push({ ope: ko, suma_excel: Math.round(sumaExcel * 100) / 100, cargo: imp, filas: items.length }); }
    for (const it of items) it.ope_cuadra = ok;
  }
  console.log(JSON.stringify({ ...res, ope_cuadra: opeCuadra, ope_no_cuadra: opeNoCuadra }, null, 1));
  console.log('OPE que no cuadran (primeros 15):', JSON.stringify(detalleOpe.slice(0, 15)));
  const listos = plan.filter((p) => p.estado === 'listo'); // las filas cuyo cargo ya tiene transacción (depósitos de detracción en bloque, cambio de moneda) no se tocan: la detracción la cubre la regla del 85 %
  console.log('por estado:', JSON.stringify(Object.fromEntries([...new Set(plan.map((p) => p.estado))].map((e) => [e, plan.filter((p) => p.estado === e).length]))));
  console.log('históricas que pasarían a pagadas:', [...new Set(listos.filter((p) => p.factura_estado === 'historica').map((p) => p.factura))].length, '· conformes:', [...new Set(listos.filter((p) => p.factura_estado !== 'historica').map((p) => p.factura))].length);
  console.log('a pagar:', listos.length, 'filas ·', [...new Set(listos.map((p) => p.factura))].length, 'facturas · PEN', Math.round(listos.filter((p) => p.moneda === 'PEN').reduce((s, p) => s + p.monto, 0)), '· USD', Math.round(listos.filter((p) => p.moneda === 'USD').reduce((s, p) => s + p.monto, 0)),
    '· con detracción', listos.filter((p) => p.tiene_detraccion).length, '· monto fila < pendiente', listos.filter((p) => p.monto < p.pendiente - 0.5).length, '· monto fila > pendiente', listos.filter((p) => p.monto > p.pendiente + 0.5).length);
  fs.writeFileSync(salida, JSON.stringify(plan, null, 1));

  if (!CARGAR) { await c.query('rollback'); console.log('DRY RUN: rollback · plan en', salida); }
  else {
    // Carga: una transacción por fila como pago histórico de Contabilidad (referencia_tipo 'historico_contabilidad', sin factura),
    // conciliada con el cargo; después sire_enlazar_pago_historico(factura) la amarra por serie-número + proveedor y aplica las
    // reglas de siempre (histórica → conforme con compromiso, recalc, 85 % por detracción/retención → PAGADO, factura pagada).
    let n = 0, reusadas = 0; const trxPorMov = new Map();
    for (const p of listos) {
      const desc = `${p.tipo} ${p.comprobante} · ${p.descripcion || 'pago'} · PAGOS ${p.mes.replace('-', '')} ${p.cuenta} OPE ${ope10(p.ope)} (cruce Contabilidad 2026-11-05)`.slice(0, 500);
      if (p.estado === 'reusar_trx_generica') {
        const { rows: [{ trx }] } = await c.query(`select transaccion_id trx from movimientos_bancarios where id = $1`, [p.mov_id]);
        await c.query(`update transacciones set referencia_tipo = 'historico_contabilidad', referencia_numero = $2, descripcion = $3, proveedor_nombre = $4, categoria = 'Pago a proveedores', subcategoria = coalesce($5, subcategoria),
                         centro_costo_id = coalesce(centro_costo_id, $6), proyecto_id = coalesce(proyecto_id, $7) where id = $1 and comprobante_id is null`, [trx, ope10(p.ope), desc, p.razon_erp, p.categoria, p.centro_costo_id, p.proyecto_id]);
        reusadas++; continue;
      }
      const { rows: [{ v_num }] } = await c.query(`select trx_siguiente_numero($1, $2::date) v_num`, [TENANT, p.mov_fecha]);
      const { rows: [{ id }] } = await c.query(`
        insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, fecha, fecha_pago, descripcion,
                                   cuenta_bancaria_id, centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, proveedor_nombre,
                                   movimiento_bancario_id, conciliado_en, creado_por, aprobado_por, aprobado_en)
        values ($1,$2,'egreso','Pago a proveedores',$3,'pagada',$4,$5,$6::date,$6::date,$7,$8,$9,$10,$11,'historico_contabilidad',$12,$13,now(),$14,$14,now()) returning id`,
        [TENANT, v_num, p.categoria, p.monto, p.moneda, p.mov_fecha, desc, ctaId[p.cuenta], p.centro_costo_id, p.proyecto_id, ope10(p.ope), p.razon_erp, p.mov_id, KEVIN]);
      if (!trxPorMov.has(p.mov_id)) trxPorMov.set(p.mov_id, id);
      n++;
    }
    let conciliados = 0;
    for (const [mov, trx] of trxPorMov) {
      const r = await c.query(`update movimientos_bancarios set transaccion_id = $2, conciliado_en = now(), conciliado_por = 'cruce-contabilidad', clasificacion = 'pago_proveedor',
                                 notas = concat_ws(' · ', nullif(notas, ''), 'Paga facturas según PAGOS 2026MM de Contabilidad (cruce 2026-11-05)')
                               where id = $1 and transaccion_id is null`, [mov, trx]);
      conciliados += r.rowCount;
    }
    const comprobantes = [...new Set(listos.map((p) => p.comprobante_id))];
    let enlazadas = 0;
    for (const id of comprobantes) { const { rows: [{ v }] } = await c.query(`select sire_enlazar_pago_historico($1) v`, [id]); if (v) enlazadas++; }
    const { rows: est } = await c.query(`select c.estado_flujo, count(*) n from comprobantes_pago c where c.id = any($1) group by 1`, [comprobantes]);
    const { rows: comp } = await c.query(`select fc.estado_pago, count(*) n from flujo_compromisos fc where fc.comprobante_id = any($1) group by 1`, [comprobantes]);
    console.log('transacciones creadas', n, '· reutilizadas', reusadas, '· movimientos conciliados', conciliados, '· facturas enlazadas', enlazadas, 'de', comprobantes.length);
    console.log('estado de las facturas:', JSON.stringify(est), '· compromisos:', JSON.stringify(comp));
    await c.query('commit'); console.log('COMMIT');
  }
} catch (e) { await c.query('rollback'); console.error('ERROR, rollback:', e.message); process.exitCode = 1; } finally { await c.end(); }
