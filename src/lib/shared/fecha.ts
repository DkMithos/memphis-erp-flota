/**
 * Fechas del ERP, sin el salto de un día.
 *
 * `new Date('2026-09-09')` interpreta la cadena como medianoche UTC. Al
 * mostrarla en Lima (UTC−5) el navegador retrocede cinco horas y sale
 * 08/09/2026. Por eso una orden emitida hoy aparecía como de ayer, y lo mismo
 * la recepción, la cotización y el requerimiento.
 *
 * Una fecha sin hora (`YYYY-MM-DD`) es un DÍA, no un instante: se formatea tal
 * cual viene, sin pasarla por ninguna zona horaria. Las marcas de tiempo
 * completas sí se convierten a la hora local, que es lo correcto para ellas.
 */

/** ¿Es una fecha suelta `YYYY-MM-DD`, sin hora? */
const esDiaSuelto = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

/** `2026-09-09` → `09/09/2026`. Acepta también marcas de tiempo completas. */
export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return '—';
  const s = String(valor).trim();

  if (esDiaSuelto(s)) {
    const [a, m, d] = s.split('-');
    return `${d}/${m}/${a}`;
  }

  const fecha = new Date(s);
  if (Number.isNaN(fecha.getTime())) return s;
  return fecha.toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** Fecha y hora locales, para marcas de tiempo (`creado_en`, `aprobado_en`…). */
export function formatearFechaHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const s = String(valor).trim();
  // Un día suelto no tiene hora que mostrar.
  if (esDiaSuelto(s)) return formatearFecha(s);
  const fecha = new Date(s);
  if (Number.isNaN(fecha.getTime())) return s;
  return fecha.toLocaleString('es-PE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
