/**
 * KESA ERP - Shared Export Utilities
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
