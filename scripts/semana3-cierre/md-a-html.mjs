// Convierte un Markdown sencillo (títulos, párrafos, listas, tablas, negritas, código, citas, reglas) a un HTML autónomo
// con estilos embebidos, para entregar guías a gente sin acceso al repo. Uso: node md-a-html.mjs entrada.md salida.html
import { readFileSync, writeFileSync } from 'node:fs';
const [entrada, salida] = process.argv.slice(2);
const md = readFileSync(entrada, 'utf8').replace(/\r\n/g, '\n');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1">$1</a>');
const lineas = md.split('\n'); const out = []; let i = 0; let titulo = '';
const cerrarLista = (pila) => { while (pila.length) out.push(`</${pila.pop()}>`); };
while (i < lineas.length) {
  const l = lineas[i];
  if (/^```/.test(l)) { const buf = []; i++; while (i < lineas.length && !/^```/.test(lineas[i])) buf.push(lineas[i++]); i++; out.push(`<pre>${esc(buf.join('\n'))}</pre>`); continue; }
  const h = l.match(/^(#{1,4})\s+(.*)$/);
  if (h) { const n = h[1].length; if (n === 1 && !titulo) titulo = h[2]; out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
  if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
  if (/^>\s?/.test(l)) { const buf = []; while (i < lineas.length && /^>\s?/.test(lineas[i])) buf.push(lineas[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`); continue; }
  if (/^\|/.test(l)) {
    const filas = []; while (i < lineas.length && /^\|/.test(lineas[i])) filas.push(lineas[i++]);
    const celdas = f => f.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const cab = celdas(filas[0]); const align = filas[1] && /^\|?\s*:?-+/.test(filas[1]) ? celdas(filas[1]).map(a => /^-+:$/.test(a) ? 'right' : /^:-+:$/.test(a) ? 'center' : 'left') : [];
    const cuerpo = filas.slice(align.length ? 2 : 1);
    out.push('<table><thead><tr>' + cab.map((c, k) => `<th style="text-align:${align[k] ?? 'left'}">${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
      + cuerpo.map(f => '<tr>' + celdas(f).map((c, k) => `<td style="text-align:${align[k] ?? 'left'}">${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
    continue;
  }
  const li = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
  if (li) {
    const pila = [];
    while (i < lineas.length) {
      const m = lineas[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
      if (!m) { if (/^\s{2,}\S/.test(lineas[i]) && pila.length) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ' ' + inline(lineas[i].trim()) + '</li>'); i++; continue; } break; }
      const nivel = Math.floor(m[1].length / 2); const tipo = /\d/.test(m[2]) ? 'ol' : 'ul';
      while (pila.length > nivel + 1) out.push(`</${pila.pop()}>`);
      if (pila.length < nivel + 1) { out.push(`<${tipo}>`); pila.push(tipo); }
      out.push(`<li>${inline(m[3])}</li>`); i++;
    }
    cerrarLista(pila); continue;
  }
  if (l.trim() === '') { i++; continue; }
  const buf = [l]; i++; while (i < lineas.length && lineas[i].trim() !== '' && !/^(#|\||>|---|```|\s*[-*]\s|\s*\d+\.\s)/.test(lineas[i])) buf.push(lineas[i++]);
  out.push(`<p>${inline(buf.join(' '))}</p>`);
}
const css = `body{font-family:Inter,Segoe UI,Arial,sans-serif;max-width:1000px;margin:32px auto;padding:0 20px;color:#1f2937;line-height:1.5;font-size:15px}
h1{font-size:28px;border-bottom:3px solid #0A66C2;padding-bottom:8px}h2{font-size:21px;color:#0A66C2;margin-top:36px}h3{font-size:17px;margin-top:24px}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13.5px}th,td{border:1px solid #d1d5db;padding:6px 8px;vertical-align:top}th{background:#eef4fb}
tr:nth-child(even) td{background:#fafafa}code{background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:13px}pre{background:#f3f4f6;padding:12px;border-radius:6px;overflow:auto;font-size:13px}
blockquote{border-left:4px solid #0A66C2;margin:12px 0;padding:8px 14px;background:#f0f6fd}hr{border:0;border-top:1px solid #e5e7eb;margin:28px 0}
@media print{body{margin:0;font-size:12px}h2{page-break-after:avoid}table{page-break-inside:auto}tr{page-break-inside:avoid}}`;
writeFileSync(salida, `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo || 'Documento')}</title><style>${css}</style></head><body>${out.join('\n')}</body></html>`);
console.log('ok', salida);
