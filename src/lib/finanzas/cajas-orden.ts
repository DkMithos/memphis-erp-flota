/**
 * Orden y filtrado de las cajas chicas.
 *
 * Vive fuera del componente para poder probarlo: el orden es lo que Kevin
 * reportó el 31/08 ("no están ordenadas, tampoco salen las abiertas primero"),
 * y con 39 cajas cuyos nombres terminan en número es fácil que una
 * comparación de texto ponga CAJA 10 antes que CAJA 2.
 */

export type EstadoCaja = 'activo' | 'en_reposicion' | 'cerrada' | string;

export interface CajaOrdenable {
  nombre: string;
  moneda: string;
  estado: EstadoCaja;
  id?: string | null;
  responsable?: string | null;
}

/** Las que se trabajan a diario van arriba; las cerradas al final. */
const PRIORIDAD_ESTADO: Record<string, number> = {
  activo: 0,
  en_reposicion: 1,
  cerrada: 2,
};

/** Orden natural en español: "CAJA 2" antes que "CAJA 10". */
const natural = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

export function ordenarCajas<T extends CajaOrdenable>(cajas: T[]): T[] {
  return [...cajas].sort((a, b) =>
    (PRIORIDAD_ESTADO[a.estado] ?? 9) - (PRIORIDAD_ESTADO[b.estado] ?? 9) ||
    natural.compare(a.nombre, b.nombre) ||
    natural.compare(a.moneda, b.moneda)
  );
}

export interface FiltroCajas {
  busqueda: string;
  moneda: 'todos' | 'PEN' | 'USD';
  estado: 'todos' | 'activo' | 'en_reposicion' | 'cerrada';
}

export function filtrarCajas<T extends CajaOrdenable>(cajas: T[], f: FiltroCajas): T[] {
  const q = f.busqueda.trim().toLowerCase();
  return cajas.filter(c =>
    (f.moneda === 'todos' || c.moneda === f.moneda) &&
    (f.estado === 'todos' || c.estado === f.estado) &&
    (!q ||
      c.nombre.toLowerCase().includes(q) ||
      (c.id ?? '').toLowerCase().includes(q) ||
      (c.responsable ?? '').toLowerCase().includes(q))
  );
}

/** Filtra y ordena en un paso: lo que se muestra en pantalla. */
export function cajasParaMostrar<T extends CajaOrdenable>(cajas: T[], f: FiltroCajas): T[] {
  return ordenarCajas(filtrarCajas(cajas, f));
}
