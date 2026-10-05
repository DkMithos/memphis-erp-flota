/**
 * Hoja de asistencia imprimible: la lista de participantes con su firma, tal
 * como se adjunta al expediente de entrega del proyecto. Se abre en una
 * ventana y se imprime (o se guarda como PDF), igual que las órdenes.
 */
import type { Capacitacion, Participante, Plantilla, PlantillaSnapshot } from './types';
import { fechaCorta, horasCortas, nombreCompleto, rangoFechas } from './datos';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function imprimirHojaAsistencia(cap: Capacitacion, participantes: Participante[], plantilla?: Plantilla | PlantillaSnapshot | null): void {
  const lista = participantes.filter(p => p.asistio !== false);
  const consorcio = plantilla?.consorcio_nombre ?? '';
  const logo = plantilla?.logo_url ?? '';
  const temario = (cap.temario ?? []).map(t => `<li>${esc(t.tema)} — ${esc(horasCortas(Number(t.horas) || 0))}</li>`).join('');

  const filas = lista.map((p, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="c mono">${esc(p.dni)}</td>
      <td>${esc(nombreCompleto(p))}</td>
      <td>${esc([p.cargo, p.institucion].filter(Boolean).join(' · '))}</td>
      <td class="firma">${p.firma_data_url ? `<img src="${p.firma_data_url}" alt="">` : ''}</td>
      <td class="c peq">${p.firmado_en ? esc(new Date(p.firmado_en).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })) : '—'}</td>
    </tr>`).join('');

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Asistencia ${esc(cap.codigo)} — ${esc(cap.titulo)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.35 Inter, "Segoe UI", Arial, sans-serif; color: #17364c; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #b28b45; padding-bottom: 8px; margin-bottom: 10px; }
  header img { max-height: 54px; max-width: 200px; object-fit: contain; }
  h1 { font: 600 15pt/1.2 Georgia, serif; margin: 0 0 2px; text-transform: uppercase; letter-spacing: .03em; }
  .sub { font-size: 9.5pt; color: #526b7b; }
  .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; font-size: 9.5pt; margin: 6px 0 10px; }
  .datos b { color: #17364c; }
  ul { margin: 2px 0 0 16px; padding: 0; font-size: 9.5pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { background: #17364c; color: #fff; font-weight: 600; padding: 5px 6px; text-align: left; font-size: 9pt; }
  td { border: 1px solid #c9d3da; padding: 4px 6px; vertical-align: middle; height: 34px; }
  td.c, th.c { text-align: center; }
  td.mono { font-family: Consolas, monospace; letter-spacing: .04em; }
  td.firma { width: 34mm; text-align: center; padding: 2px; }
  td.firma img { max-height: 30px; max-width: 32mm; }
  td.peq { font-size: 8pt; color: #526b7b; width: 24mm; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  footer { margin-top: 18px; display: flex; justify-content: space-between; gap: 30px; font-size: 9pt; }
  .linea { flex: 1; text-align: center; padding-top: 34px; }
  .linea div { border-top: 1px solid #637e8b; padding-top: 4px; }
  .pie { margin-top: 10px; font-size: 8pt; color: #7a8d99; text-align: right; }
  @media print { button { display: none; } }
</style></head><body>
<header>
  <div>
    <h1>Registro de asistencia</h1>
    <div class="sub">${esc(consorcio || 'Memphis Maquinarias')}${cap.proyecto ? ` · Proyecto ${esc(cap.proyecto.codigo)} — ${esc(cap.proyecto.nombre)}` : ''}</div>
  </div>
  ${logo ? `<img src="${esc(logo)}" alt="">` : ''}
</header>
<div class="datos">
  <div><b>Capacitación:</b> ${esc(cap.titulo)} (${esc(cap.codigo)})</div>
  <div><b>Fecha:</b> ${esc(rangoFechas(cap.fecha_inicio, cap.fecha_fin))}</div>
  <div><b>Lugar:</b> ${esc([cap.lugar, cap.ciudad].filter(Boolean).join(', ') || '—')}</div>
  <div><b>Duración:</b> ${esc(horasCortas(Number(cap.horas_total) || 0))}</div>
  <div><b>Instructor:</b> ${esc(cap.instructor_nombre || '—')}${cap.instructor_cargo ? ` — ${esc(cap.instructor_cargo)}` : ''}</div>
  <div><b>Entidad beneficiaria:</b> ${esc(cap.entidad_beneficiaria || cap.proyecto?.entidad_cliente || '—')}</div>
</div>
${temario ? `<div style="font-size:9.5pt"><b>Temario:</b><ul>${temario}</ul></div>` : ''}
<table style="margin-top:10px">
  <thead><tr><th class="c" style="width:8mm">N.°</th><th class="c" style="width:22mm">DNI</th><th>Apellidos y nombres</th><th>Cargo / Institución</th><th class="c">Firma</th><th class="c">Fecha y hora</th></tr></thead>
  <tbody>${filas || '<tr><td colspan="6" class="c">Sin participantes registrados</td></tr>'}</tbody>
</table>
<footer>
  <div class="linea"><div>${esc(cap.instructor_nombre || 'Instructor')}<br><span style="color:#526b7b">Instructor</span></div></div>
  <div class="linea"><div>${esc(plantilla?.firmante_nombre || 'Representante')}<br><span style="color:#526b7b">${esc(plantilla?.firmante_cargo || 'Por el consorcio')}</span></div></div>
  <div class="linea"><div>Por la entidad<br><span style="color:#526b7b">Nombre, cargo y sello</span></div></div>
</footer>
<div class="pie">Total de asistentes: ${lista.length} · Firmados: ${lista.filter(p => p.firma_data_url).length} · Generado el ${esc(fechaCorta(new Date().toISOString().slice(0, 10)))} desde el ERP Memphis</div>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}
