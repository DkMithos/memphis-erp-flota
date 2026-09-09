/**
 * QUÉ HEREDA LA COTIZACIÓN DEL REQUERIMIENTO.
 *
 * Los items son el motivo de existir de la pantalla de cotización: quien cotiza
 * ajusta precios y condiciones, no vuelve a teclear qué se está pidiendo. Antes
 * no se heredaba nada — se abría la cotización en blanco y había que repetir
 * todo a mano, con el riesgo de pedir algo distinto a lo que se solicitó.
 *
 * El precio estimado entra como precio inicial: es una referencia, el proveedor
 * la cambiará.
 *
 * Los comentarios de cada item NO se meten en la descripción: esa línea acaba
 * en el PDF que ve el proveedor, y un "urge para el lunes" no tiene por qué
 * viajar ahí. Van a observaciones, que es interna.
 */
import type { Requerimiento } from './requerimientos-store';

export interface HerenciaCotizacion {
  items: { descripcion: string; cantidad: number; unidad: string; precioUnitario: number }[];
  moneda: 'PEN' | 'USD';
  observaciones: string;
}

export function heredarDelRequerimiento(req: Requerimiento): HerenciaCotizacion {
  const comentarios = req.items
    .filter(i => i.comentario?.trim())
    .map(i => `${i.descripcion}: ${i.comentario!.trim()}`);

  return {
    items: req.items.map(i => ({
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      unidad: i.unidad,
      precioUnitario: i.precioEstimado,
    })),
    moneda: req.moneda,
    observaciones: comentarios.join('\n'),
  };
}
