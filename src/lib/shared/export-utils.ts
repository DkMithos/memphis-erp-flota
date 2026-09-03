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
 * Exporta datos a un archivo **.xlsx real** (no CSV disfrazado).
 *
 * Antes esto generaba un CSV con separador de coma y extensión .csv aunque el
 * botón dijera "Excel". En un Excel configurado en español (separador de listas
 * `;` y decimal `,`) ese archivo se abre con TODO en una sola columna, y los
 * importes llegan como texto, así que no se pueden sumar. Con .xlsx nativo el
 * problema desaparece: no hay separadores que negociar y los números viajan
 * como números.
 *
 * - Los valores numéricos se escriben como número (sumables en Excel).
 * - Las fechas ISO (`YYYY-MM-DD`) se escriben como fecha real.
 * - El ancho de cada columna se calcula según su contenido.
 *
 * SheetJS se importa de forma diferida para no engordar el bundle principal.
 *
 * @param filename Nombre del archivo (sin extensión; se agrega .xlsx)
 * @param data Array de objetos
 * @param headersMap Mapeo de keys a nombres de columna
 * @param hoja Nombre de la pestaña (por defecto "Datos")
 */
/**
 * ¿Este texto es una cantidad que Excel debe poder sumar, o un código?
 *
 * Un RUC (20604953236), un DNI o un número de cuenta son dígitos, pero NO son
 * cantidades: convertirlos a número les quita los ceros iniciales y Excel los
 * puede mostrar en notación científica. La regla: es número solo si trae
 * decimales o si es un entero corto (hasta 8 dígitos).
 */
export function esNumeroReal(s: string): boolean {
  if (!/^-?\d+(\.\d+)?$/.test(s)) return false;
  if (/^0\d/.test(s)) return false;              // ceros a la izquierda → código
  if (s.includes('.')) return true;               // con decimales → importe
  return s.replace('-', '').length <= 8;          // entero corto → cantidad
}

export async function exportToExcel<T extends Record<string, any>>(
  filename: string,
  data: T[],
  headersMap: Record<keyof T, string>,
  hoja: string = 'Datos'
): Promise<void> {
  const XLSX = await import('xlsx');
  const keys = Object.keys(headersMap) as Array<keyof T>;
  const cabeceras = keys.map(k => headersMap[k]);

  // Un valor que "parece número" se escribe como número; una fecha ISO, como fecha.
  const convertir = (v: unknown): string | number | Date | null => {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (esNumeroReal(s)) return Number(s);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + 'T00:00:00');
      if (!Number.isNaN(d.getTime())) return d;
    }
    return s;
  };

  const filas = data.map(row => keys.map(k => convertir(row[k])));
  const ws = XLSX.utils.aoa_to_sheet([cabeceras, ...filas], { cellDates: true });

  // Ancho por contenido, con tope para que no queden columnas absurdas
  ws['!cols'] = keys.map((k, i) => {
    const largos = data.map(r => String(r[k] ?? '').length);
    const max = Math.max(cabeceras[i].length, ...(largos.length ? largos : [0]));
    return { wch: Math.min(Math.max(max + 2, 10), 55) };
  });
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({
    s: { c: 0, r: 0 }, e: { c: Math.max(keys.length - 1, 0), r: filas.length },
  }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Exporta varias tablas al MISMO archivo, una por pestaña.
 * Sirve para lo que hoy obliga a bajar dos archivos y cruzarlos a mano:
 * una orden con sus ítems, una caja con sus gastos e ingresos, etc.
 */
export async function exportToExcelMultiHoja(
  filename: string,
  hojas: { nombre: string; data: Record<string, any>[]; headersMap: Record<string, string> }[]
): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const h of hojas) {
    const keys = Object.keys(h.headersMap);
    const cabeceras = keys.map(k => h.headersMap[k]);
    const filas = h.data.map(row => keys.map(k => {
      const v = row[k];
      if (v === null || v === undefined || v === '') return null;
      if (typeof v === 'number') return v;
      const s = String(v).trim();
      if (esNumeroReal(s)) return Number(s);
      return s;
    }));
    const ws = XLSX.utils.aoa_to_sheet([cabeceras, ...filas], { cellDates: true });
    ws['!cols'] = keys.map((k, i) => {
      const largos = h.data.map(r => String(r[k] ?? '').length);
      const max = Math.max(cabeceras[i].length, ...(largos.length ? largos : [0]));
      return { wch: Math.min(Math.max(max + 2, 10), 55) };
    });
    XLSX.utils.book_append_sheet(wb, ws, h.nombre.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
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
  /**
   * `condiciones` es un texto plano en la base (columna `condiciones_pago`),
   * pero versiones anteriores lo guardaban como objeto. Se acepta lo que venga
   * para que las órdenes viejas no pierdan el dato.
   */
  const cond = (orden.condiciones && typeof orden.condiciones === 'object') ? orden.condiciones : {};
  const condicionPago = typeof orden.condiciones === 'string'
    ? orden.condiciones
    : (cond.formaPago || cond.condicionPago || '');
  const centroCosto = [orden.centroCostoCodigo, orden.centroCostoNombre]
    .filter(Boolean)
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    .join(' — ') || orden.centroCostoTexto || orden.centroCosto || '';

  const aud = orden.auditoria || {};

  /**
   * Las aprobaciones que REALMENTE ocurrieron, con la firma tal como estaba ese
   * día. Vienen de `orden_aprobaciones`: las del ERP y las rescatadas de
   * oc-system. Si una etapa no tiene aprobación, la línea va en blanco para
   * firma manuscrita: no se estampa la firma de nadie sobre algo que no consta.
   */
  const aprobaciones: Record<string, any> = {};
  for (const a of (orden.aprobaciones ?? [])) aprobaciones[a.etapa] = a;

  const firma = (rol: string, etapa?: string, nombreFallback?: string | null, fechaFallback?: string | null) => {
    const ap = etapa ? aprobaciones[etapa] : null;
    const nombre = ap?.aprobadoPorNombre || ap?.aprobadoPorEmail || nombreFallback || '';
    const fecha = ap?.aprobadoEn || fechaFallback || null;
    const img = ap?.firma;
    return `
    <div class="firma">
      ${img
        ? `<img class="rubrica" src="${esc(img)}" alt="">`
        : '<div class="rubrica"></div>'}
      <div class="linea"></div>
      <div class="rol">${esc(rol)}</div>
      <div class="quien">${esc(nombre)}</div>
      <div class="cuando">${fecha ? esc(fmtFecha(fecha)) : ''}</div>
    </div>`;
  };
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
  /* Firmas: cuatro columnas que no se parten entre páginas al imprimir. */
  .firmas{display:flex;gap:16px;margin-top:34px;page-break-inside:avoid}
  .firma{flex:1;text-align:center}
  .firma .rubrica{display:block;height:34px;margin:0 auto;max-width:100%;object-fit:contain}
  .firma .linea{border-top:1px solid #333;margin-bottom:4px}
  .firma .rol{font-size:9px;font-weight:bold;text-transform:uppercase;color:#333}
  .firma .quien{font-size:9px;color:#444;min-height:11px}
  .firma .cuando{font-size:8px;color:#777;min-height:10px}
  @media print{ body{padding:0} @page{margin:14mm;size:A4} }
</style></head><body>
  <div class="head">
    <div style="display:flex;gap:12px;align-items:flex-start">
      <img src="${window.location.origin}/favicon.svg" alt="Memphis" style="width:52px;height:52px;border-radius:8px" />
      <div>
        <h1>${titulo}</h1>
        <div style="font-size:10px;color:#444"><b>MEMPHIS MAQUINARIAS S.A.C</b> · RUC 20603847424<br>
        AV. Circunvalación el Golf N° 158 Of. 203, Surco, Lima<br>
        (01) 7174012 — www.memphismaquinarias.com</div>
      </div>
    </div>
    <div class="r"><b style="font-size:13px;color:#0A66C2">N° ${esc(orden.id)}</b><br>Estado: ${esc(orden.estado)}</div>
  </div>

  <div class="sec"><h2>DATOS GENERALES</h2>
    <div class="grid">
      <div><b>Fecha de Emisión:</b> ${fmtFecha(orden.fechaEmision)}</div>
      <div><b>N° Requerimiento:</b> ${esc(orden.requerimientoId)}</div>
      <div><b>N° Cotización:</b> ${esc(orden.cotizacionNumero || orden.cotizacionId)}</div>
      <div><b>Centro de Costo:</b> ${esc(centroCosto)}</div>
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
      <div><b>Cuenta:</b> ${esc(cta.cuenta || cta.numeroCuenta)}</div>
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
      <div><b>Lugar de Entrega:</b> ${esc(orden.lugarEntrega || cond.lugarEntrega)}</div>
      <div><b>Fecha máx. de Entrega:</b> ${esc(cond.fechaEntrega || fmtFecha(orden.fechaEntregaEstimada))}</div>
      <div><b>Condición de Pago:</b> ${esc(condicionPago)}</div>
      <div><b>Observaciones:</b> ${esc(orden.observaciones || cond.observaciones)}</div>
    </div>
  </div>

  <div class="sec firmas">
    ${firma('Elaborado por', 'comprador', aud.creadoPor, aud.creadoEn)}
    ${firma('Revisado por', 'operaciones', null, null)}
    ${firma('Gerencia Operaciones', 'gerenciaOperaciones', null, null)}
    ${firma('Aprobado por', 'gerenciaGeneral', orden.aprobadoPor, orden.aprobadoEn)}
    ${firma('Finanzas', 'finanzas', null, null)}
  </div>

  <div class="foot">
    <b>ENVÍO DE SU FACTURA — PORTAL DE PROVEEDORES:</b><br>
    Suba su factura electrónica (XML y PDF) en <b>erp.memphismaquinarias.com/portal</b>,
    ingresando con su RUC y su contraseña del portal.<br>
    Consigne el número de esta orden (<b>${esc(orden.numero ?? orden.id)}</b>) como
    referencia/orden de compra en su facturador (OrderReference) para la asignación automática.
    Si aún no cuenta con acceso al portal, solicítelo a su comprador.<br><br>
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
export async function exportCajaModeloExcel(
  caja: { nombre: string; codigo: string; responsable: string; moneda: string },
  movimientos: MovimientoCajaModelo[],
): Promise<void> {
  const XLSX = await import('xlsx');

  const fmtMoneda = caja.moneda === 'USD' ? '"$" #,##0.00' : '"S/" #,##0.00';
  const fmtFecha = 'dd/mm/yyyy';
  const enLetras = caja.moneda === 'USD' ? 'Dólares' : 'Soles';

  const num = (n?: number | null) => (n === null || n === undefined ? null : Number(n));
  const fecha = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const totIng = movimientos.reduce((t, m) => t + (m.ingreso ?? 0), 0);
  const totEgr = movimientos.reduce((t, m) => t + (m.egreso ?? 0), 0);
  const saldo = Math.round((totIng - totEgr) * 100) / 100;

  // Diseño del Excel de Administración: cabecera + recuadro de saldos a la
  // derecha, la tabla de 9 columnas, la fila de totales y el pie de firma.
  const aoa: (string | number | Date | null)[][] = [
    ['MEMPHIS MAQUINARIAS SAC', null, null, null, null, null, null, null, null],
    ['DETALLE DE CAJA CHICA', null, null, null, null, null, 'Saldo Inicial', null, null],
    [`(Expresado en ${enLetras})`, null, null, null, null, null, 'Ingresos', totIng, null],
    [`N° DE CAJA: ${caja.codigo}`, null, null, null, null, null, 'Gastos', totEgr, null],
    [`RESPONSABLE: ${caja.responsable}`, null, null, null, null, null, 'Saldo Final', saldo, null],
    [null, null, null, null, null, null, null, null, null],
    ['ITEM', 'CENTRO DE COSTO', 'TIPO DOC', 'COMPROBANTE', 'RAZÓN SOCIAL',
     'DESCRIPCIÓN', `INGRESO ${caja.moneda}`, `EGRESO ${caja.moneda}`, 'FECHA DE PAGO'],
  ];

  const FILA_CABECERA = aoa.length - 1;      // 0-based, la fila de títulos
  const PRIMERA_FILA = aoa.length;           // donde arrancan los movimientos

  for (const m of movimientos) {
    aoa.push([
      // El ITEM y el comprobante son códigos: van como texto para no perder
      // ceros a la izquierda ni acabar en notación científica.
      m.item === null || m.item === undefined ? null : String(m.item),
      m.centroCosto ?? null,
      m.tipoDoc ?? null,
      m.comprobante ? String(m.comprobante) : null,
      m.razonSocial ?? null,
      m.descripcion ?? null,
      num(m.ingreso),
      num(m.egreso),
      fecha(m.fecha),
    ]);
  }

  const FILA_TOTAL = aoa.length;
  aoa.push(['Total', null, null, null, null, null, totIng, totEgr, null]);
  aoa.push([null, null, null, null, null, null, null, null, null]);
  aoa.push([null, '______________________________', null, null, null, null, null, null, null]);
  aoa.push([null, 'FIRMA DEL RESPONSABLE', null, null, null, null, null, null, null]);
  aoa.push([null, `NOMBRE: ${caja.responsable}`, null, null, null, null, null, null, null]);

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

  // Formato de importes y fechas. Se aplica a la celda, no al texto, así que
  // el valor sigue siendo un número que Excel puede sumar.
  const marca = (fila: number, col: number, z: string) => {
    const ref = XLSX.utils.encode_cell({ r: fila, c: col });
    const celda = (ws as Record<string, any>)[ref];
    if (celda && celda.v !== null && celda.v !== undefined) celda.z = z;
  };
  for (let r = PRIMERA_FILA; r < FILA_TOTAL; r++) {
    marca(r, 6, fmtMoneda);
    marca(r, 7, fmtMoneda);
    marca(r, 8, fmtFecha);
  }
  for (const r of [2, 3, 4]) marca(r, 7, fmtMoneda);   // recuadro de saldos
  marca(FILA_TOTAL, 6, fmtMoneda);
  marca(FILA_TOTAL, 7, fmtMoneda);

  ws['!cols'] = [
    { wch: 6 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 34 },
    { wch: 46 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { c: 0, r: FILA_CABECERA }, e: { c: 8, r: FILA_TOTAL - 1 },
    }),
  };
  // La cabecera queda fija al desplazarse: son cajas de cientos de movimientos.
  (ws as Record<string, any>)['!freeze'] = { xSplit: 0, ySplit: PRIMERA_FILA };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Caja Chica');
  XLSX.writeFile(wb, `${caja.nombre.replace(/\s+/g, '_')}_${caja.codigo}.xlsx`);
}
