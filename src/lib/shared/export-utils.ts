/**
 * Memphis ERP - Shared Export Utilities
 * Utilidades para exportación de reportes (CSV, Excel)
 * 
 * v1.0.0
 */

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Escapa un valor para CSV (agrega comillas si necesario)
 */
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  
  const str = String(value);
  
  // Si contiene coma, comillas, o salto de línea, envolver en comillas
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    // Escapar comillas duplicándolas
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  
  return str;
}

/**
 * Convierte un array de objetos a CSV
 * 
 * @param data Array de objetos
 * @param headersMap Mapeo de keys a nombres de columna
 * @returns String CSV
 * 
 * @example
 * const data = [{ id: 1, name: "John" }, { id: 2, name: "Jane" }];
 * const headersMap = { id: "ID", name: "Nombre" };
 * const csv = arrayToCSV(data, headersMap);
 */
export function arrayToCSV<T extends Record<string, any>>(
  data: T[],
  headersMap: Record<keyof T, string>
): string {
  if (data.length === 0) return '';

  const keys = Object.keys(headersMap) as Array<keyof T>;
  const headers = keys.map(key => headersMap[key]);

  // Crear línea de headers
  const headerLine = headers.map(h => escapeCsvValue(h)).join(',');

  // Crear líneas de datos
  const dataLines = data.map(row => {
    return keys.map(key => escapeCsvValue(row[key])).join(',');
  });

  return [headerLine, ...dataLines].join('\n');
}

/**
 * Descarga un string CSV como archivo
 * 
 * @param filename Nombre del archivo (sin extensión)
 * @param csvContent Contenido CSV
 * @param withBOM Si true, agrega BOM UTF-8 para Excel (recomendado)
 */
export function downloadCSV(
  filename: string,
  csvContent: string,
  withBOM: boolean = true
): void {
  // BOM UTF-8 para que Excel reconozca caracteres especiales
  const BOM = '\uFEFF';
  const content = withBOM ? BOM + csvContent : csvContent;

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Exporta datos a CSV
 * 
 * @param filename Nombre del archivo (sin extensión)
 * @param data Array de objetos
 * @param headersMap Mapeo de keys a nombres de columna
 * 
 * @example
 * exportToCSV('reporte-vehiculos', vehicles, {
 *   placa: 'Placa',
 *   marca: 'Marca',
 *   modelo: 'Modelo'
 * });
 */
export function exportToCSV<T extends Record<string, any>>(
  filename: string,
  data: T[],
  headersMap: Record<keyof T, string>
): void {
  const csv = arrayToCSV(data, headersMap);
  downloadCSV(filename, csv, true);
}

// ============================================================================
// EXCEL EXPORT (CSV con BOM para Excel)
// ============================================================================

/**
 * Exporta datos a "Excel" (CSV con BOM UTF-8)
 * 
 * NOTA: Exporta CSV con BOM para que Excel lo abra correctamente.
 * Si en el futuro se agrega librería xlsx, esta función puede actualizarse.
 * 
 * @param filename Nombre del archivo (sin extensión, se agregará .csv)
 * @param data Array de objetos
 * @param headersMap Mapeo de keys a nombres de columna
 */
export function exportToExcel<T extends Record<string, any>>(
  filename: string,
  data: T[],
  headersMap: Record<keyof T, string>
): void {
  // Por ahora, Excel = CSV con BOM
  // En el futuro, si se agrega librería xlsx, implementar aquí
  const csv = arrayToCSV(data, headersMap);
  downloadCSV(filename, csv, true); // BOM = true para Excel
}

// ============================================================================
// HELPER: Formatear fecha para export
// ============================================================================

/**
 * Formatea fecha ISO a DD/MM/YYYY para reportes
 */
export function formatDateForExport(isoDate?: string): string {
  if (!isoDate) return 'N/A';
  
  try {
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return 'N/A';
  }
}

/**
 * Formatea número a string con decimales para reportes
 */
export function formatNumberForExport(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

// ============================================================================
// PDF EXPORT (via window.print())
// ============================================================================

/**
 * Exporta datos a PDF usando una ventana de impresión estilizada.
 * No requiere dependencias externas.
 *
 * @param filename   Nombre sugerido del PDF (visible en el diálogo de impresión)
 * @param title      Título que aparece en el encabezado del documento
 * @param data       Array de objetos con los datos
 * @param headersMap Mapeo de keys a etiquetas de columna
 */
export function exportToPDF<T extends Record<string, any>>(
  filename: string,
  title: string,
  data: T[],
  headersMap: Partial<Record<keyof T, string>>
): void {
  if (data.length === 0) return;

  const keys = Object.keys(headersMap) as Array<keyof T>;
  const headers = keys.map(k => headersMap[k] as string);

  const rows = data.map(row =>
    keys.map(k => {
      const v = row[k];
      return v === null || v === undefined ? '' : String(v);
    })
  );

  const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const tbody = rows.map(r =>
    `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`
  ).join('');

  const dateStr = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; padding: 20px; }
    h1 { font-size: 16px; margin-bottom: 4px; color: #0A66C2; }
    .meta { font-size: 10px; color: #666; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #0A66C2; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 600; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Generado el ${dateStr} · Memphis ERP</p>
  <table>
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ============================================================================
// PDF DE UNA ORDEN DE COMPRA / SERVICIO (formato Memphis, vía window.print())
// ============================================================================

const esc = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

/**
 * Exporta UNA orden de compra/servicio a PDF con el formato estándar de Memphis.
 * @param orden     Objeto de la orden (id, tipo, estado, items, totales, condiciones…)
 * @param proveedor Registro del proveedor (ruc, direccion, telefono, email, cuentasBancarias…) — opcional
 */
export function exportOrdenPDF(orden: any, proveedor?: any): void {
  if (!orden) return;
  const money = (n: any) => `${orden.moneda === 'USD' ? 'USD' : 'S/'} ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const titulo = orden.tipo === 'os' ? 'ORDEN DE SERVICIO' : 'ORDEN DE COMPRA';
  const cond = orden.condiciones || {};
  // Cuenta bancaria: la que coincida con la moneda de la orden, o la primera
  const cuentas: any[] = proveedor?.cuentasBancarias ?? proveedor?.cuentas_bancarias ?? [];
  const cta = cuentas.find((c: any) => /d[oó]lar|usd/i.test(c?.moneda || '') === (orden.moneda === 'USD')) ?? cuentas[0] ?? {};

  const filas = (orden.items ?? []).map((it: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(it.descripcion)}</td>
      <td style="text-align:right">${esc(it.cantidad)}</td>
      <td>${esc(it.unidad || 'UND')}</td>
      <td style="text-align:right">${money(it.precioUnitario)}</td>
      <td style="text-align:right">${money(it.descuento ?? 0)}</td>
      <td style="text-align:right">${money(it.subtotal ?? it.total)}</td>
    </tr>`).join('');

  const fmtFecha = (f: any) => f ? new Date(f).toLocaleDateString('es-PE') : '—';

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>OC ${esc(orden.id)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;padding:24px}
  .head{display:flex;justify-content:space-between;border-bottom:2px solid #0A66C2;padding-bottom:8px;margin-bottom:10px}
  .head h1{font-size:18px;color:#0A66C2}
  .head .r{text-align:right;font-size:10px;color:#444}
  .sec{margin-top:12px}
  .sec h2{font-size:11px;background:#0A66C2;color:#fff;padding:4px 8px;letter-spacing:.5px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;padding:6px 4px}
  .grid div{font-size:10.5px} .grid b{color:#333}
  table{width:100%;border-collapse:collapse;margin-top:4px}
  th{background:#0A66C2;color:#fff;padding:5px 6px;text-align:left;font-size:10px}
  td{padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:10px}
  .res{margin-top:8px;width:240px;margin-left:auto}
  .res div{display:flex;justify-content:space-between;padding:2px 4px}
  .res .tot{font-weight:bold;border-top:1px solid #ccc;color:#0A66C2}
  .foot{margin-top:18px;font-size:9px;color:#555;border-top:1px solid #e5e7eb;padding-top:8px}
  @media print{ body{padding:0} @page{margin:14mm;size:A4} }
</style></head><body>
  <div class="head">
    <div>
      <h1>${titulo}</h1>
      <div style="font-size:10px;color:#444">Memphis Maquinarias S.A.C · RUC 20603847424<br>
      AV. Circunvalación el Golf N° 158 Of. 203, Surco, Lima<br>
      (01) 7174012 — www.memphismaquinarias.com</div>
    </div>
    <div class="r"><b style="font-size:13px;color:#0A66C2">N° ${esc(orden.id)}</b><br>Estado: ${esc(orden.estado)}</div>
  </div>

  <div class="sec"><h2>DATOS GENERALES</h2>
    <div class="grid">
      <div><b>Fecha de Emisión:</b> ${fmtFecha(orden.fechaEmision)}</div>
      <div><b>N° Requerimiento:</b> ${esc(orden.requerimientoId)}</div>
      <div><b>N° Cotización:</b> ${esc(orden.cotizacionId)}</div>
      <div><b>Centro de Costo:</b> ${esc(orden.centroCostoTexto || orden.centroCosto)}</div>
    </div>
  </div>

  <div class="sec"><h2>PROVEEDOR</h2>
    <div class="grid">
      <div><b>Proveedor:</b> ${esc(orden.proveedorNombre || proveedor?.razonSocial)}</div>
      <div><b>RUC:</b> ${esc(proveedor?.ruc)}</div>
      <div><b>Dirección:</b> ${esc(proveedor?.direccion)}</div>
      <div><b>Contacto:</b> ${esc(proveedor?.contacto)}</div>
      <div><b>Teléfono:</b> ${esc(proveedor?.telefono)}</div>
      <div><b>Correo:</b> ${esc(proveedor?.email)}</div>
      <div><b>Banco:</b> ${esc(cta.nombre || cta.banco)}</div>
      <div><b>Moneda:</b> ${orden.moneda === 'USD' ? 'Dólares' : 'Soles'}</div>
      <div><b>Cuenta:</b> ${esc(cta.cuenta)}</div>
      <div><b>CCI:</b> ${esc(cta.cci)}</div>
    </div>
  </div>

  <div class="sec"><h2>DETALLE</h2>
    <table>
      <thead><tr><th>#</th><th>Descripción</th><th>Cant.</th><th>U.M.</th><th>P. Unit</th><th>Dscto</th><th>Total</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="res">
      <div><span>Subtotal:</span><span>${money(orden.subtotal)}</span></div>
      <div><span>IGV (18%):</span><span>${money(orden.impuestos ?? orden.igv)}</span></div>
      <div class="tot"><span>Total:</span><span>${money(orden.total)}</span></div>
    </div>
  </div>

  <div class="sec"><h2>CONDICIONES</h2>
    <div class="grid">
      <div><b>Lugar de Entrega:</b> ${esc(cond.lugarEntrega || orden.lugarEntrega)}</div>
      <div><b>Fecha máx. de Entrega:</b> ${esc(cond.fechaEntrega || fmtFecha(orden.fechaEntregaEstimada))}</div>
      <div><b>Condición de Pago:</b> ${esc(cond.formaPago || cond.condicionPago)}</div>
      <div><b>Observaciones:</b> ${esc(cond.observaciones || orden.observaciones)}</div>
    </div>
  </div>

  <div class="foot">
    <b>ENVIAR SU COMPROBANTE CON COPIA A:</b><br>
    FACTURAS ELECTRÓNICAS: facturacion@memphis.pe | dmendez@memphis.pe | mcastaneda@memphis.pe<br>
    CONSULTA DE PAGOS: sbujaico@memphis.pe | dmendez@memphis.pe<br><br>
    El presente servicio o producto cumple con los lineamientos de nuestro Sistema de Gestión Antisoborno.
  </div>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ============================================================================
// EXPORT CAJA CHICA EN FORMATO MODELO (mismo layout que el Excel de Administración)
// ============================================================================

export interface MovimientoCajaModelo {
  item: string | number;
  centroCosto?: string | null;
  tipoDoc?: string | null;
  comprobante?: string | null;
  razonSocial?: string | null;
  descripcion?: string | null;
  ingreso?: number | null;
  egreso?: number | null;
  fecha?: string | null; // ISO yyyy-mm-dd
}

/**
 * Exporta UNA caja chica en el formato modelo del Excel de Administración:
 * cabecera Memphis + bloque Saldo Inicial/Ingresos/Gastos/Saldo Final +
 * tabla ITEM/CENTRO DE COSTO/TIPO DOC/COMPROBANTE/RAZÓN SOCIAL/DESCRIPCIÓN/
 * INGRESO/EGRESO/FECHA DE PAGO + fila Total + bloque de firma.
 * Se descarga como .xls (HTML compatible con Excel, conserva el layout).
 */
export function exportCajaModeloExcel(
  caja: { nombre: string; codigo: string; responsable: string; moneda: string },
  movimientos: MovimientoCajaModelo[],
): void {
  const sym = caja.moneda === 'USD' ? '$' : 'S/';
  const money = (n?: number | null) =>
    n === null || n === undefined ? '' : `${sym} ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dmy = (iso?: string | null) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  };
  const totIng = movimientos.reduce((s, m) => s + (m.ingreso ?? 0), 0);
  const totEgr = movimientos.reduce((s, m) => s + (m.egreso ?? 0), 0);
  const saldo = Math.round((totIng - totEgr) * 100) / 100;

  const filas = movimientos.map(m => `
    <tr>
      <td style="text-align:center">${esc(m.item)}</td>
      <td>${esc(m.centroCosto)}</td>
      <td>${esc(m.tipoDoc)}</td>
      <td>${esc(m.comprobante)}</td>
      <td>${esc(m.razonSocial)}</td>
      <td>${esc(m.descripcion)}</td>
      <td style="text-align:right">${money(m.ingreso)}</td>
      <td style="text-align:right">${money(m.egreso)}</td>
      <td style="text-align:center">${dmy(m.fecha)}</td>
    </tr>`).join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8">
<style>
  table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  .titulo { font-weight: bold; font-size: 13pt; }
  .sub { font-weight: bold; }
  .resumenlbl { font-weight: bold; background: #f2f2f2; border: 1px solid #999; }
  .resumenval { border: 1px solid #999; text-align: right; }
  th { background: #d9d9d9; border: 1px solid #666; font-weight: bold; padding: 3px 6px; }
  td { border: 1px solid #bbb; padding: 2px 6px; vertical-align: top; }
  .nb td { border: none; }
  .totrow td { font-weight: bold; background: #f2f2f2; border: 1px solid #666; }
</style></head>
<body>
<table>
  <tr class="nb"><td colspan="6" class="titulo">MEMPHIS MAQUINARIAS SAC</td><td></td><td></td><td></td></tr>
  <tr class="nb"><td colspan="6" class="sub">DETALLE DE CAJA CHICA</td><td class="resumenlbl">Saldo Inicial</td><td class="resumenval"></td><td></td></tr>
  <tr class="nb"><td colspan="6">(Expresado en ${caja.moneda === 'USD' ? 'Dólares' : 'Soles'})</td><td class="resumenlbl">Ingresos</td><td class="resumenval">${money(totIng)}</td><td></td></tr>
  <tr class="nb"><td colspan="6" class="sub">N° DE CAJA: ${esc(caja.codigo)}</td><td class="resumenlbl">Gastos</td><td class="resumenval">${money(totEgr)}</td><td></td></tr>
  <tr class="nb"><td colspan="6" class="sub">RESPONSABLE: ${esc(caja.responsable)}</td><td class="resumenlbl">Saldo Final</td><td class="resumenval">${money(saldo)}</td><td></td></tr>
  <tr class="nb"><td colspan="9"></td></tr>
  <tr>
    <th>ITEM</th><th>CENTRO DE COSTO</th><th>TIPO DOC</th><th>COMPROBANTE</th>
    <th>RAZÓN SOCIAL</th><th>DESCRIPCIÓN</th><th>INGRESO ${caja.moneda}</th><th>EGRESO ${caja.moneda}</th><th>FECHA DE PAGO</th>
  </tr>
  ${filas}
  <tr class="totrow">
    <td>Total</td><td></td><td></td><td></td><td></td><td></td>
    <td style="text-align:right">${money(totIng)}</td>
    <td style="text-align:right">${money(totEgr)}</td><td></td>
  </tr>
  <tr class="nb"><td colspan="9"></td></tr>
  <tr class="nb"><td></td><td colspan="2">______________________________</td></tr>
  <tr class="nb"><td></td><td colspan="2">FIRMA DEL RESPONSABLE</td></tr>
  <tr class="nb"><td></td><td colspan="2">NOMBRE: ${esc(caja.responsable)}</td></tr>
</table>
</body></html>`;

  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${caja.nombre.replace(/\s+/g, '_')}_${caja.codigo}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
