/**
 * FORMATO ÚNICO DE REEMBOLSO Y LIQUIDACIÓN (Anexo 2 de la política) y PLANILLA POR
 * GASTOS DE MOVILIDAD, impresos desde lo que el viajero cargó en la app.
 *
 * Carolina (16/10/2026) quiere seguir recibiendo la rendición EN PAPEL: este
 * formato impreso, firmado, con todas las facturas y boletas adjuntas. Reproduce
 * el Excel "FORMATO ÚNICO DE REEMBOLSO Y LIQUIDACIÓN.xlsx" de Administración
 * (cabecera, 20 filas de detalle, totales, declaración, notas y firmas).
 */
import { TIPO_COMPROBANTE, fechaCorta, type Pasajero, type Rendicion, type RendicionItem, type Viaje } from './viajes';

const esc = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
const n2 = (v: number) => v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #111; padding: 18px; }
  .hoja { page-break-after: always; }
  .hoja:last-child { page-break-after: auto; }
  h1 { text-align: center; font-size: 13px; line-height: 1.3; margin-bottom: 10px; }
  h1 small { display: block; font-size: 10px; font-weight: normal; color: #444; }
  .cab { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .cab td { padding: 3px 4px; border-bottom: 1px solid #bbb; }
  .cab td.l { width: 42%; font-weight: bold; }
  .sec { background: #e8e8e8; font-weight: bold; text-align: center; padding: 4px; border: 1px solid #999; margin-top: 8px; }
  table.det { width: 100%; border-collapse: collapse; }
  table.det th, table.det td { border: 1px solid #999; padding: 3px 4px; font-size: 9.5px; }
  table.det th { background: #f2f2f2; text-align: center; }
  table.det td.n { text-align: right; white-space: nowrap; }
  table.det td.c { text-align: center; }
  table.det tr.tot td { font-weight: bold; background: #f7f7f7; }
  .res { width: 60%; margin: 8px 0 0 auto; border-collapse: collapse; }
  .res td { border: 1px solid #999; padding: 3px 4px; }
  .res td.n { text-align: right; font-weight: bold; }
  .dec { margin-top: 12px; font-size: 10px; }
  .dec b { display: block; margin-bottom: 2px; }
  .notas { margin-top: 8px; font-size: 9px; color: #333; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 44px; }
  .firma { border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 9.5px; }
  .pie { margin-top: 10px; font-size: 8.5px; color: #666; text-align: right; }
  @media print { body { padding: 0; } @page { margin: 12mm; size: A4 portrait; } }
`;

function filasVacias(desde: number, hasta: number, cols: number) {
  let s = '';
  for (let i = desde; i <= hasta; i++) s += `<tr><td class="c">${i}</td>${'<td>&nbsp;</td>'.repeat(cols - 1)}</tr>`;
  return s;
}

export function htmlFormatoUnico(viaje: Viaje, pasajero: Pasajero, r: Rendicion, items: RendicionItem[]): string {
  const generales = items.filter(i => i.tipo_gasto !== 'movilidad' && i.tipo_gasto !== 'peaje');
  const movilidad = items.filter(i => i.tipo_gasto === 'movilidad' || i.tipo_gasto === 'peaje');
  const totSoles = items.filter(i => i.moneda !== 'USD').reduce((s, i) => s + Number(i.monto), 0);
  const totUsd = items.filter(i => i.moneda === 'USD').reduce((s, i) => s + Number(i.monto), 0);
  const gastado = Number(r.gastado), entregado = Number(r.entregado), saldo = gastado - entregado;
  const filas = generales.slice(0, 200).map((i, k) =>
    `<tr><td class="c">${k + 1}</td><td class="c">${fechaCorta(i.fecha)}</td><td>${esc(TIPO_COMPROBANTE[i.comprobante_tipo] ?? i.comprobante_tipo)}</td><td>${esc(i.comprobante_numero)}</td><td>${esc(i.ruc)}</td><td>${esc(i.proveedor_nombre)}</td><td>${esc(i.descripcion || '')}</td><td class="n">${i.moneda !== 'USD' ? n2(Number(i.monto)) : ''}</td><td class="n">${i.moneda === 'USD' ? n2(Number(i.monto)) : ''}</td></tr>`).join('')
    + (generales.length < 20 ? filasVacias(generales.length + 1, 20, 9) : '');
  const movFilas = movilidad.map((i, k) =>
    `<tr><td class="c">${k + 1}</td><td class="c">${fechaCorta(i.fecha)}</td><td>${esc(i.descripcion || '')}</td><td>${esc(i.lugar_origen)}</td><td>${esc(i.lugar_destino)}</td><td class="n">${n2(Number(i.monto_soles ?? i.monto))}</td></tr>`).join('')
    + (movilidad.length < 20 ? filasVacias(movilidad.length + 1, 20, 6) : '');
  const movTotal = movilidad.reduce((s, i) => s + Number(i.monto_soles ?? i.monto), 0);
  const cab = (fecha: string) => `
    <table class="cab">
      <tr><td class="l">NÚMERO:</td><td>${esc(viaje.numero)} · ${esc(r.numero)}</td></tr>
      <tr><td class="l">NOMBRES Y APELLIDOS:</td><td>${esc(pasajero.nombre)}</td></tr>
      <tr><td class="l">DNI / CE:</td><td>${esc(pasajero.dni)}</td></tr>
      <tr><td class="l">PROYECTO:</td><td>${esc(viaje.proyecto_codigo ? `${viaje.proyecto_codigo} · ${viaje.proyecto_nombre ?? ''}` : 'Oficina central')} · ${esc(viaje.destino)} (${fechaCorta(viaje.fecha_salida)}${viaje.fecha_retorno ? ' al ' + fechaCorta(viaje.fecha_retorno) : ''})</td></tr>
      <tr><td class="l">FECHA DE PRESENTACIÓN:</td><td>${fecha}</td></tr>
    </table>`;
  const firmas = `
    <div class="firmas">
      <div class="firma">FIRMA DEL TRABAJADOR<br>${esc(pasajero.nombre)}</div>
      <div class="firma">JEFE INMEDIATO / GERENCIA GENERAL<br>Nombre y firma</div>
      <div class="firma">ADMINISTRACIÓN<br>Recibido · fecha y firma</div>
    </div>`;
  const hoja1 = `
  <div class="hoja">
    <h1>ANEXO N° 2<br>FORMATO ÚNICO DE REEMBOLSO Y LIQUIDACIÓN<small>MEMPHIS MAQUINARIAS S.A.C. · RUC 20603847424</small></h1>
    ${cab(fechaCorta(r.fecha))}
    <table class="cab">
      <tr><td class="l">BANCO A REEMBOLSAR:</td><td>${esc(r.banco)}</td></tr>
      <tr><td class="l">N° DE CUENTA BANCARIA:</td><td>${esc(r.cuenta)}</td></tr>
      <tr><td class="l">CCI - CÓDIGO DE CUENTA INTERBANCARIA:</td><td>${esc(r.cci)}</td></tr>
      <tr><td class="l">MONEDA A REEMBOLSAR:</td><td>${r.moneda_reembolso === 'USD' ? 'Dólares' : 'Soles'}</td></tr>
    </table>
    <div class="sec">DETALLE DE GASTOS</div>
    <table class="det">
      <thead><tr><th>ÍTEM</th><th>FECHA</th><th>TIPO DE COMPROBANTE O DOCUMENTO</th><th>N° DE COMPROBANTE O DOCUMENTO</th><th>RUC / DNI</th><th>PROVEEDOR</th><th>CONCEPTO</th><th>SOLES</th><th>DÓLARES</th></tr></thead>
      <tbody>${filas}
        <tr class="tot"><td colspan="7">IMPORTE TOTAL GASTADO</td><td class="n">${n2(totSoles)}</td><td class="n">${n2(totUsd)}</td></tr>
      </tbody>
    </table>
    <table class="res">
      <tr><td>TOTAL GASTADO (en soles, al TC de cada comprobante)</td><td class="n">S/ ${n2(gastado)}</td></tr>
      <tr><td>DEPOSITADO POR EL EMPLEADOR (adelanto de viáticos)</td><td class="n">S/ ${n2(entregado)}</td></tr>
      <tr><td>${saldo >= 0 ? 'TOTAL A DEVOLVER AL TRABAJADOR' : 'TOTAL A DEVOLVER POR EL TRABAJADOR'}</td><td class="n">S/ ${n2(Math.abs(saldo))}</td></tr>
    </table>
    ${r.tope_excedido ? `<div class="dec"><b>Gastos que exceden los topes de la política / sin sustento (requieren aprobación del jefe inmediato o Gerencia):</b>${esc(r.justificacion ?? '')}</div>` : ''}
    <div class="dec"><b>DECLARACIÓN DEL TRABAJADOR:</b>Declaro que los gastos consignados fueron realizados únicamente por motivos laborales y conforme a la política vigente.</div>
    <div class="notas"><b>NOTAS IMPORTANTES:</b><br>El trabajador deberá presentar un Formato Único independiente por cada proyecto respecto del cual solicite reembolso.<br>La firma del área de Administración no debe interpretarse como aceptación o conformidad inmediata, puesto que dicha área dispone de un plazo máximo de 3 días contados desde la recepción del Formato Único para efectuar observaciones y solicitar las aclaraciones o sustentos adicionales que considere pertinentes.</div>
    ${firmas}
    <div class="pie">Impreso desde Memphis ERP · ${new Date().toLocaleString('es-PE')} · adjuntar ${items.filter(i => i.sustentado).length} comprobante(s) en el orden del detalle</div>
  </div>`;
  const hoja2 = movilidad.length === 0 ? '' : `
  <div class="hoja">
    <h1>PLANILLA POR GASTOS DE MOVILIDAD<small>MEMPHIS MAQUINARIAS S.A.C. · RUC 20603847424 · ${esc(viaje.numero)} · ${esc(r.numero)}</small></h1>
    ${cab(fechaCorta(r.fecha))}
    <div class="sec">DETALLE DEL DESPLAZAMIENTO</div>
    <table class="det">
      <thead><tr><th>ÍTEM</th><th>FECHA</th><th>MOTIVO</th><th>LUGAR DE ORIGEN</th><th>LUGAR DE DESTINO</th><th>MONTO S/</th></tr></thead>
      <tbody>${movFilas}<tr class="tot"><td colspan="5">IMPORTE TOTAL GASTADO</td><td class="n">${n2(movTotal)}</td></tr></tbody>
    </table>
    <div class="dec"><b>DECLARACIÓN DEL TRABAJADOR:</b>Declaro que los gastos consignados fueron realizados únicamente por motivos laborales y conforme a la política vigente.</div>
    <div class="notas"><b>NOTA IMPORTANTE:</b><br>En caso el trabajador desconozca la dirección exacta del lugar de origen y/o destino, deberá consignar el punto de referencia correspondiente (por ejemplo: Gobierno Regional, hotel, aeropuerto, etc).</div>
    <div class="firmas" style="grid-template-columns:1fr"><div class="firma" style="max-width:260px;margin:0 auto">FIRMA DEL TRABAJADOR<br>${esc(pasajero.nombre)}</div></div>
  </div>`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Formato Único ${esc(r.numero)}</title><style>${CSS}</style></head><body>${hoja1}${hoja2}</body></html>`;
}

export function imprimirFormatoUnico(viaje: Viaje, pasajero: Pasajero, r: Rendicion, items: RendicionItem[]): boolean {
  const win = window.open('', '_blank', 'width=900,height=800');
  if (!win) return false;
  win.document.write(htmlFormatoUnico(viaje, pasajero, r, items));
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
  return true;
}
