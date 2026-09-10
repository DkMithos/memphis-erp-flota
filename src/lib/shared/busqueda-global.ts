/**
 * BUSCADOR DE LA BARRA SUPERIOR — qué se consulta y para quién.
 *
 * Antes consultaba las siete tablas para todo el mundo: órdenes de trabajo,
 * vehículos, proyectos, clientes, artículos, proveedores y órdenes de compra.
 * A quien solo tiene Compras eso le devolvía placas de vehículos, nombres de
 * clientes y códigos de artículos — datos de módulos que ni aparecen en su
 * menú — y enlaces que al pulsarlos le contestaban "no tienes acceso".
 *
 * Cada fuente declara a qué pantalla lleva. Si el usuario no puede abrir esa
 * pantalla, la fuente ni se consulta: no se filtra el resultado después, no se
 * llega a pedir. De paso, un rol acotado hace dos consultas en vez de siete.
 */
import { supabase } from '../supabase/client';
import { puedeVerRuta } from '../rbac/rutas';
import type { Modulo, Accion } from '../rbac/usePermissions';

export interface ResultadoBusqueda {
  tipo: string;
  label: string;
  route: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, string>;

export interface FuenteBusqueda {
  id: string;
  /** Pantalla a la que llevan sus resultados. Decide quién puede consultarla. */
  ruta: string;
  buscar: (termino: string) => PromiseLike<{ data: any[] | null }>;
  mapear: (filas: Fila[]) => ResultadoBusqueda[];
}

export const FUENTES: FuenteBusqueda[] = [
  {
    id: 'proyectos',
    ruta: '/proyectos',
    buscar: t => supabase.from('proyectos').select('id,codigo,nombre')
      .or(`nombre.ilike.${t},codigo.ilike.${t}`).limit(4),
    mapear: filas => filas.map(r => ({
      tipo: 'Proyecto', label: `${r.codigo} — ${r.nombre}`, route: `/proyectos/360/${r.id}`,
    })),
  },
  {
    id: 'ordenes_compra',
    ruta: '/compras',
    buscar: t => supabase.from('ordenes_compra').select('numero,estado').ilike('numero', t).limit(3),
    mapear: filas => filas.map(r => ({
      tipo: 'OC', label: `${r.numero} (${r.estado})`, route: `/compras/ordenes/${r.numero}`,
    })),
  },
  {
    id: 'proveedores',
    ruta: '/proveedores',
    buscar: t => supabase.from('proveedores').select('codigo,razon_social,ruc')
      .or(`razon_social.ilike.${t},ruc.ilike.${t}`).limit(3),
    mapear: filas => filas.map(r => ({
      tipo: 'Proveedor', label: `${r.razon_social} — ${r.ruc}`, route: `/proveedores/directorio/${r.codigo}`,
    })),
  },
  {
    id: 'ordenes_trabajo',
    ruta: '/flota',
    buscar: t => supabase.from('ordenes_trabajo').select('numero_ot,titulo')
      .or(`titulo.ilike.${t},numero_ot.ilike.${t}`).limit(3),
    mapear: filas => filas.map(r => ({
      tipo: 'OT', label: `${r.numero_ot} — ${r.titulo}`, route: `/flota/mantenimientos/${r.numero_ot}`,
    })),
  },
  {
    id: 'vehiculos',
    ruta: '/flota',
    buscar: t => supabase.from('vehiculos').select('codigo,placa,marca,modelo')
      .or(`placa.ilike.${t},codigo.ilike.${t}`).limit(3),
    mapear: filas => filas.map(r => ({
      tipo: 'Vehículo', label: `${r.placa} — ${r.marca} ${r.modelo}`, route: `/flota/vehiculos/${r.codigo}`,
    })),
  },
  {
    id: 'clientes',
    ruta: '/crm',
    buscar: t => supabase.from('clientes').select('codigo,razon_social').ilike('razon_social', t).limit(3),
    mapear: filas => filas.map(r => ({
      tipo: 'Cliente', label: `${r.codigo} — ${r.razon_social}`, route: `/crm/clientes/${r.codigo}`,
    })),
  },
  {
    id: 'articulos',
    ruta: '/inventario',
    buscar: t => supabase.from('articulos').select('codigo,nombre').ilike('nombre', t).limit(3),
    mapear: filas => filas.map(r => ({
      tipo: 'Artículo', label: `${r.codigo} — ${r.nombre}`, route: `/inventario/articulos/${r.codigo}`,
    })),
  },
];

/** Las fuentes que este usuario puede consultar, en el orden del catálogo. */
export function fuentesPermitidas(
  can: (modulo: Modulo, accion: Accion) => boolean,
): FuenteBusqueda[] {
  return FUENTES.filter(f => puedeVerRuta(f.ruta, can));
}

/**
 * Coma, paréntesis y comillas alteran la sintaxis de los filtros `.or()` de
 * PostgREST — es una inyección de filtro. Se eliminan antes de interpolar.
 * Devuelve null cuando no queda término suficiente para buscar.
 */
export function terminoSeguro(entrada: string): string | null {
  const limpio = entrada.replace(/[,()"'\\%]/g, ' ').trim();
  return limpio.length < 2 ? null : `%${limpio}%`;
}

/** Lanza en paralelo solo las fuentes permitidas y junta los resultados. */
export async function buscar(
  entrada: string,
  can: (modulo: Modulo, accion: Accion) => boolean,
): Promise<ResultadoBusqueda[]> {
  const termino = terminoSeguro(entrada);
  if (!termino) return [];

  const fuentes = fuentesPermitidas(can);
  if (fuentes.length === 0) return [];

  const respuestas = await Promise.all(
    fuentes.map(f => Promise.resolve(f.buscar(termino)).catch(() => ({ data: null }))),
  );

  return fuentes.flatMap((f, i) => f.mapear((respuestas[i].data ?? []) as Fila[]));
}
