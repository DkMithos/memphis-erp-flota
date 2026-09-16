/**
 * TARIFARIOS: LA COTIZACIÓN QUE NO SE GASTA.
 *
 * El mantenimiento de una flota es siempre lo mismo y al mismo precio. Pedir un
 * requerimiento y una cotización nuevos por cada camioneta y cada mes es
 * papeleo que no decide nada: las cifras ya estaban acordadas con el taller.
 *
 * Un tarifario es una cotización que se negocia y se aprueba UNA VEZ, y de la
 * que salen tantas órdenes como haga falta. El control no se relaja: el
 * tarifario se aprueba como cualquier cotización, y cada orden que sale de él
 * sigue pasando por el flujo de montos.
 *
 * Lo único que hay que vigilar es la vigencia. Un precio de hace un año no es
 * un precio: por eso el tarifario lleva fecha hasta la que vale, y vencido deja
 * de ofrecerse (sin desaparecer: las órdenes viejas tienen que poder mirarlo).
 */

export interface CotizacionTarifario {
  id: string;
  estado: string;
  esTarifario?: boolean;
  /** ISO 'YYYY-MM-DD' o null si no se le puso fecha. */
  tarifarioVigencia?: string | null;
}

/** Hoy en 'YYYY-MM-DD', hora de Lima, para comparar con una fecha sin hora. */
export function hoyISO(ahora: Date = new Date()): string {
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * ¿Sigue valiendo el precio?
 *
 * Sin fecha de vigencia se considera vigente: hay acuerdos abiertos, y es mejor
 * que Compras decida cuándo caducan a que el sistema los tire por su cuenta.
 * Se compara como texto porque ambas son 'YYYY-MM-DD' y así no hay husos de por
 * medio — con `new Date('2026-09-16')` un tarifario que vence hoy se daba por
 * vencido en Lima, que va cinco horas por detrás de UTC.
 */
export function tarifarioVigente(c: CotizacionTarifario, hoy: string = hoyISO()): boolean {
  if (!c.tarifarioVigencia) return true;
  return c.tarifarioVigencia >= hoy;
}

/** Un tarifario sirve para generar órdenes si está aprobado y no ha vencido. */
export function tarifarioUtilizable(c: CotizacionTarifario, hoy: string = hoyISO()): boolean {
  return c.esTarifario === true && c.estado === 'aprobada' && tarifarioVigente(c, hoy);
}

/**
 * Lo que se le ofrece a quien genera una orden, en dos grupos.
 *
 * Los tarifarios van primero y separados: son los que se usan a diario y los
 * que uno viene buscando. Las cotizaciones normales, debajo, y solo las que no
 * tienen ya una orden — una cotización corriente se usa una vez, y volver a
 * verla en la lista después de haberla convertido solo invita a duplicar.
 */
export function opcionesParaOrden<T extends CotizacionTarifario>(
  cotizaciones: T[],
  cotizacionesYaUsadas: Set<string>,
  hoy: string = hoyISO(),
): { tarifarios: T[]; sueltas: T[] } {
  const tarifarios = cotizaciones.filter(c => tarifarioUtilizable(c, hoy));
  const sueltas = cotizaciones.filter(
    c => !c.esTarifario && c.estado === 'aprobada' && !cotizacionesYaUsadas.has(c.id),
  );
  return { tarifarios, sueltas };
}

/** "vence el 31/12/2026" · "sin fecha de vencimiento" · "VENCIDO el 01/01/2026" */
export function etiquetaVigencia(c: CotizacionTarifario, hoy: string = hoyISO()): string {
  if (!c.tarifarioVigencia) return 'sin fecha de vencimiento';
  const [y, m, d] = c.tarifarioVigencia.split('-');
  const legible = `${d}/${m}/${y}`;
  return tarifarioVigente(c, hoy) ? `vence el ${legible}` : `VENCIDO el ${legible}`;
}
