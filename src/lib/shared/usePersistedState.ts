/**
 * usePersistedState — useState que sobrevive a entrar y salir de un detalle.
 *
 * Las listas de Compras (órdenes, requerimientos, cotizaciones, recepciones,
 * facturas) guardan sus filtros en estado local; al abrir una OC y volver, el
 * componente se vuelve a montar y el usuario pierde lo que había filtrado.
 * Aquí el valor se guarda en sessionStorage por clave: dura lo que dura la
 * pestaña y no se comparte entre usuarios ni entre pestañas.
 *
 * Solo para valores serializables en JSON (strings, números, booleanos,
 * objetos planos). Si el almacenamiento no está disponible (modo privado,
 * cuota), se comporta como useState normal.
 */
import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';

const PREFIJO = 'memphis-erp:filtros:';

function leer<T>(clave: string, inicial: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIJO + clave);
    if (raw === null) return inicial;
    return JSON.parse(raw) as T;
  } catch {
    return inicial;
  }
}

export function usePersistedState<T>(clave: string, inicial: T): [T, Dispatch<SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(() => leer(clave, inicial));

  useEffect(() => {
    try {
      sessionStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
    } catch {
      /* sin almacenamiento: el estado sigue viviendo en memoria */
    }
  }, [clave, valor]);

  return [valor, setValor];
}

/** Borra los filtros guardados de una lista (por ejemplo, botón "Limpiar filtros"). */
export function limpiarFiltrosGuardados(prefijoClave: string): void {
  try {
    const borrar: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIJO + prefijoClave)) borrar.push(k);
    }
    borrar.forEach(k => sessionStorage.removeItem(k));
  } catch {
    /* nada que limpiar */
  }
}
