/**
 * ACTA DE ENTREGA / DEVOLUCIÓN POR NÚMERO DE SERIE.
 *
 * Lo que hoy Operaciones arma a mano para el GORE (entrega) y para SUMTEC
 * (devolución con guía): una hoja con las series elegidas, agrupadas por
 * artículo, y espacio para firmas. Misma mecánica que `exportToPDF`: una
 * ventana con el HTML y `window.print()` (el usuario elige "Guardar como PDF").
 */
import type { Unidad } from './unidades';

export interface ActaOpciones {
  tipo: 'entrega' | 'devolucion' | 'inventario';
  titulo?: string;
  destinatario?: string;        // entidad / proveedor que recibe
  documento?: string;           // n.º de acta o guía
  fecha?: string;               // YYYY-MM-DD
  proyecto?: string;
  observaciones?: string;
}

const esc = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

const fechaLarga = (iso?: string) => {
  const d = iso ? new Date(iso.slice(0, 10) + 'T00:00:00') : new Date();
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
};

export function htmlActaUnidades(unidades: Unidad[], o: ActaOpciones): string {
  const titulo = o.titulo ?? (o.tipo === 'entrega' ? 'ACTA DE ENTREGA DE EQUIPAMIENTO' : o.tipo === 'devolucion' ? 'ACTA DE DEVOLUCIÓN DE EQUIPAMIENTO' : 'INVENTARIO DE EQUIPAMIENTO POR SERIE');
  const grupos = new Map<string, Unidad[]>();
  for (const u of unidades) {
    const k = `${u.articulo}|${u.marca ?? ''}|${u.modelo ?? ''}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(u);
  }
  const bloques = [...grupos.entries()].map(([k, us]) => {
    const [articulo, marca, modelo] = k.split('|');
    const filas = us.map((u, i) =>
      `<tr><td class="n">${i + 1}</td><td>${esc(u.serie ?? 'SIN SERIE')}</td><td>${esc(u.vehiculo_placa ?? u.vehiculo_codigo)}</td><td>${esc(u.factura)}</td><td>${esc(u.observaciones)}</td></tr>`).join('');
    return `
      <h2>${esc(articulo)} <span class="sub">${esc([marca, modelo].filter(Boolean).join(' · '))}</span> <span class="cnt">${us.length} unidad${us.length === 1 ? '' : 'es'}</span></h2>
      <table><thead><tr><th class="n">#</th><th>N.º de serie</th><th>Vehículo</th><th>Factura</th><th>Observaciones</th></tr></thead><tbody>${filas}</tbody></table>`;
  }).join('');

  const quien = o.tipo === 'entrega' ? 'Recibe (entidad)' : o.tipo === 'devolucion' ? 'Recibe (proveedor)' : 'Verificó';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
  .cab { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0A66C2; padding-bottom: 8px; margin-bottom: 12px; }
  .cab h1 { font-size: 15px; color: #0A66C2; }
  .cab .emp { font-size: 10px; color: #444; margin-top: 2px; }
  .cab .doc { text-align: right; font-size: 10px; color: #444; }
  .cab .doc b { font-size: 12px; color: #1a1a1a; }
  .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 12px; font-size: 11px; }
  .datos span { color: #666; }
  h2 { font-size: 12px; margin: 12px 0 4px; }
  h2 .sub { font-weight: normal; color: #555; font-size: 10px; }
  h2 .cnt { float: right; font-weight: normal; color: #0A66C2; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th { background: #0A66C2; color: #fff; padding: 4px 6px; text-align: left; font-size: 10px; }
  td { padding: 3px 6px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
  td.n, th.n { width: 28px; text-align: right; }
  tr:nth-child(even) td { background: #f9fafb; }
  .total { text-align: right; font-weight: bold; margin: 8px 0 16px; }
  .obs { margin: 8px 0 24px; font-size: 10px; color: #333; white-space: pre-wrap; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
  .firma { border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 10px; color: #444; }
  @media print { body { padding: 0; } @page { margin: 15mm; size: A4 portrait; } }
</style></head><body>
  <div class="cab">
    <div><h1>${esc(titulo)}</h1><div class="emp">MEMPHIS MAQUINARIAS S.A.C. · RUC 20603847424</div></div>
    <div class="doc">${o.documento ? `<b>${esc(o.documento)}</b><br>` : ''}${fechaLarga(o.fecha)}</div>
  </div>
  <div class="datos">
    ${o.destinatario ? `<div><span>${o.tipo === 'devolucion' ? 'Proveedor' : 'Entidad / destinatario'}:</span> ${esc(o.destinatario)}</div>` : ''}
    ${o.proyecto ? `<div><span>Proyecto:</span> ${esc(o.proyecto)}</div>` : ''}
    <div><span>Unidades:</span> ${unidades.length}</div>
  </div>
  ${bloques}
  <div class="total">Total: ${unidades.length} unidad${unidades.length === 1 ? '' : 'es'}</div>
  ${o.observaciones ? `<div class="obs">${esc(o.observaciones)}</div>` : ''}
  <div class="firmas">
    <div class="firma">Entrega · Memphis Maquinarias S.A.C.<br>Nombre / DNI / Firma</div>
    <div class="firma">${quien}<br>Nombre / DNI / Firma</div>
  </div>
</body></html>`;
}

export function imprimirActaUnidades(unidades: Unidad[], o: ActaOpciones): boolean {
  if (unidades.length === 0) return false;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return false;
  win.document.write(htmlActaUnidades(unidades, o));
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
  return true;
}
