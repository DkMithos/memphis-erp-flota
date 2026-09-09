/**
 * REPORTE CRUZADO — datos y agregaciones.
 *
 * Reemplaza a `cross-report.ts`, que consultaba columnas inexistentes
 * (`ordenes_trabajo.proyecto_id`, `gastos_caja_chica.centro_costo_id`,
 * `requerimientos_compra.fecha_solicitud`) y por eso devolvía cero filas sin
 * avisar de nada. Y dejaba fuera las órdenes de compra, que son el gasto real
 * de la empresa: 1,261 órdenes vivas.
 *
 * Todo sale de la vista `v_bi_movimientos`, para que la cifra del reporte y la
 * del tablero de Gerencia salgan del mismo sitio.
 *
 * **PEN y USD no se suman.** El gasto de Memphis es mayoritariamente en
 * dólares; consolidar con un tipo de cambio fijo movería el total en millones.
 * El consolidado llega cuando exista la tabla de tipos de cambio por fecha.
 */
import { supabase } from '../supabase/client';

export type Fuente = 'orden_compra' | 'gasto_caja' | 'ingreso_caja';
export type Flujo = 'egreso' | 'ingreso';
export type Moneda = 'PEN' | 'USD';

export const FUENTES: { id: Fuente; label: string; detalle: string }[] = [
  { id: 'orden_compra', label: 'Órdenes de compra', detalle: 'Compromiso con proveedores' },
  { id: 'gasto_caja', label: 'Gastos de caja chica', detalle: 'Salidas de las cajas' },
  { id: 'ingreso_caja', label: 'Ingresos de caja chica', detalle: 'Reposiciones y devoluciones' },
];

export interface Movimiento {
  fuente: Fuente;
  flujo: Flujo;
  id: string;
  numero: string | null;
  fecha: string;
  mes: string;
  estado: string | null;
  moneda: Moneda;
  monto: number;
  proyectoId: string | null;
  proyecto: string | null;
  centroCostoId: string | null;
  centroCosto: string | null;
  enCatalogo: boolean;
  contraparte: string | null;
  descripcion: string | null;
}

export interface Filtros {
  desde: string;
  hasta: string;
  proyectoId: string | null;
  centroCostoId: string | null;
  fuentes: Fuente[];
}

/** Un importe nunca es un número solo: es cuánto en soles y cuánto en dólares. */
export interface Importe {
  pen: number;
  usd: number;
}

export interface Agrupado {
  clave: string;
  etiqueta: string;
  movimientos: number;
  egreso: Importe;
  ingreso: Importe;
  /** Falso cuando la etiqueta no existe en el catálogo de centros de costo. */
  enCatalogo: boolean;
}

export type Dimension = 'proyecto' | 'centroCosto' | 'fuente' | 'mes' | 'contraparte';

const cero = (): Importe => ({ pen: 0, usd: 0 });

/** Suma `monto` en la moneda que corresponda, sin mezclarlas. */
export function acumular(acc: Importe, moneda: Moneda, monto: number): Importe {
  if (moneda === 'USD') return { pen: acc.pen, usd: acc.usd + monto };
  return { pen: acc.pen + monto, usd: acc.usd };
}

const ETIQUETA_FUENTE: Record<Fuente, string> = {
  orden_compra: 'Órdenes de compra',
  gasto_caja: 'Gastos de caja chica',
  ingreso_caja: 'Ingresos de caja chica',
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

/** "2026-09" → "Set 2026". Deja pasar cualquier otra cosa tal cual. */
export function nombreMes(mes: string): string {
  const [anio, m] = mes.split('-');
  const i = Number(m) - 1;
  return MESES[i] ? `${MESES[i]} ${anio}` : mes;
}

function claveDe(m: Movimiento, dim: Dimension): { clave: string; etiqueta: string } {
  switch (dim) {
    case 'proyecto':
      return m.proyectoId
        ? { clave: m.proyectoId, etiqueta: m.proyecto ?? m.proyectoId }
        : { clave: '__sin__', etiqueta: 'Sin proyecto asignado' };
    case 'centroCosto':
      return m.centroCosto
        ? { clave: m.centroCosto, etiqueta: m.centroCosto }
        : { clave: '__sin__', etiqueta: 'Sin centro de costo' };
    case 'fuente':
      return { clave: m.fuente, etiqueta: ETIQUETA_FUENTE[m.fuente] };
    case 'mes':
      return { clave: m.mes, etiqueta: nombreMes(m.mes) };
    case 'contraparte':
      return m.contraparte
        ? { clave: m.contraparte, etiqueta: m.contraparte }
        : { clave: '__sin__', etiqueta: 'Sin identificar' };
  }
}

/**
 * Agrupa por una dimensión. Ordena por egreso descendente (soles + dólares
 * solo para ORDENAR, nunca para mostrar un total mezclado), salvo por mes, que
 * va cronológico.
 */
export function agrupar(movs: Movimiento[], dim: Dimension): Agrupado[] {
  const mapa = new Map<string, Agrupado>();

  for (const m of movs) {
    const { clave, etiqueta } = claveDe(m, dim);
    let fila = mapa.get(clave);
    if (!fila) {
      fila = { clave, etiqueta, movimientos: 0, egreso: cero(), ingreso: cero(), enCatalogo: true };
      mapa.set(clave, fila);
    }
    fila.movimientos++;
    if (m.flujo === 'ingreso') fila.ingreso = acumular(fila.ingreso, m.moneda, m.monto);
    else fila.egreso = acumular(fila.egreso, m.moneda, m.monto);
    // Basta con que un movimiento venga de fuera del catálogo para marcar la fila.
    if (dim === 'centroCosto' && m.centroCosto && !m.enCatalogo) fila.enCatalogo = false;
  }

  const filas = [...mapa.values()];
  if (dim === 'mes') return filas.sort((a, b) => a.clave.localeCompare(b.clave));
  return filas.sort((a, b) => (b.egreso.pen + b.egreso.usd) - (a.egreso.pen + a.egreso.usd));
}

export interface Totales {
  movimientos: number;
  egreso: Importe;
  ingreso: Importe;
  /** Movimientos de egreso que nadie imputó a un proyecto. */
  sinProyecto: number;
  /** Movimientos cuyo centro de costo no está en el catálogo. */
  fueraDeCatalogo: number;
}

export function totales(movs: Movimiento[]): Totales {
  let egreso = cero();
  let ingreso = cero();
  let sinProyecto = 0;
  let fueraDeCatalogo = 0;

  for (const m of movs) {
    if (m.flujo === 'ingreso') ingreso = acumular(ingreso, m.moneda, m.monto);
    else {
      egreso = acumular(egreso, m.moneda, m.monto);
      if (!m.proyectoId) sinProyecto++;
    }
    if (m.centroCosto && !m.enCatalogo) fueraDeCatalogo++;
  }

  return { movimientos: movs.length, egreso, ingreso, sinProyecto, fueraDeCatalogo };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * PostgREST devuelve como mucho 1.000 filas por respuesta, así que hay que
 * pedirlas por tramos. Sin esto el reporte se cortaba en 1.000 movimientos —
 * y el Excel también — sin decir una palabra.
 */
const TRAMO = 1000;
/** Tope de seguridad: el año completo son ~2.400 filas; esto deja margen. */
const TOPE = 20000;

/** Trae los movimientos del rango. RLS y la vista ya filtran por tenant. */
export async function fetchMovimientos(f: Filtros): Promise<Movimiento[]> {
  if (f.fuentes.length === 0) return [];

  const crudas: any[] = [];
  for (let desde = 0; desde < TOPE; desde += TRAMO) {
    let q = supabase
      .from('v_bi_movimientos')
      .select('*')
      .gte('fecha', f.desde)
      .lte('fecha', f.hasta)
      .in('fuente', f.fuentes)
      .order('fecha', { ascending: false })
      .order('id', { ascending: true })  // desempate estable entre tramos
      .range(desde, desde + TRAMO - 1);

    if (f.proyectoId) q = q.eq('proyecto_id', f.proyectoId);
    if (f.centroCostoId) q = q.eq('centro_costo_id', f.centroCostoId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    crudas.push(...(data ?? []));
    if (!data || data.length < TRAMO) break;
  }

  return crudas.map((r: any): Movimiento => ({
    fuente: r.fuente,
    flujo: r.flujo,
    id: r.id,
    numero: r.numero,
    fecha: r.fecha,
    mes: r.mes,
    estado: r.estado,
    moneda: r.moneda === 'USD' ? 'USD' : 'PEN',
    monto: Number(r.monto ?? 0),
    proyectoId: r.proyecto_id,
    proyecto: r.proyecto,
    centroCostoId: r.centro_costo_id,
    centroCosto: r.centro_costo,
    enCatalogo: !!r.en_catalogo,
    contraparte: r.contraparte,
    descripcion: r.descripcion,
  }));
}

/** Filas planas para el Excel, con los importes ya separados por moneda. */
export function paraExportar(movs: Movimiento[]) {
  return movs.map(m => ({
    fecha: m.fecha,
    fuente: ETIQUETA_FUENTE[m.fuente],
    flujo: m.flujo === 'ingreso' ? 'Ingreso' : 'Egreso',
    numero: m.numero ?? '',
    contraparte: m.contraparte ?? '',
    descripcion: m.descripcion ?? '',
    proyecto: m.proyecto ?? 'Sin proyecto',
    centroCosto: m.centroCosto ?? 'Sin centro de costo',
    soles: m.moneda === 'PEN' ? m.monto : '',
    dolares: m.moneda === 'USD' ? m.monto : '',
    estado: m.estado ?? '',
  }));
}

export const CABECERAS_EXPORT: Record<string, string> = {
  fecha: 'Fecha',
  fuente: 'Origen',
  flujo: 'Flujo',
  numero: 'Número',
  contraparte: 'Proveedor / beneficiario',
  descripcion: 'Descripción',
  proyecto: 'Proyecto',
  centroCosto: 'Centro de costo',
  soles: 'Soles',
  dolares: 'Dólares',
  estado: 'Estado',
};

/**
 * Qué módulo hay que poder ver para que una fuente entre en el reporte.
 *
 * El reporte cruza compras con caja chica, así que sin esto un rol de Compras
 * veía los movimientos de la caja: el módulo estaba oculto en el menú pero el
 * dinero salía igual por el reporte. Pasó con Richard.
 */
export const MODULO_DE_FUENTE: Record<Fuente, 'compras' | 'finanzas'> = {
  orden_compra: 'compras',
  gasto_caja: 'finanzas',
  ingreso_caja: 'finanzas',
};

/** Las fuentes que este usuario puede cruzar, en el orden del catálogo. */
export function fuentesPermitidas(
  puedeVer: (modulo: 'compras' | 'finanzas') => boolean,
): Fuente[] {
  return FUENTES.filter(f => puedeVer(MODULO_DE_FUENTE[f.id])).map(f => f.id);
}
