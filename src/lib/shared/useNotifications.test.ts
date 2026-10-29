import { describe, it, expect } from 'vitest';
import { puedeVerNotificacion } from './useNotifications';
import type { Modulo, Accion } from '../rbac/usePermissions';

const soloVe = (...modulos: Modulo[]) =>
  (m: Modulo, a: Accion) => a === 'ver' && modulos.includes(m);

const compras = soloVe('compras', 'proveedores');

describe('cada quien ve los avisos de sus módulos', () => {
  it('un rol de Compras recibe los de órdenes de compra', () => {
    expect(puedeVerNotificacion('orden_compra', compras)).toBe(true);
  });

  it('pero no los de caja chica', () => {
    // "Aprobacion requerida: GCC-2026-001" le llegaba a todo el tenant.
    expect(puedeVerNotificacion('caja_chica', compras)).toBe(false);
  });

  it('ni el resumen de vencimientos de flota', () => {
    expect(puedeVerNotificacion('vencimientos', compras)).toBe(false);
  });

  it('ni las calibraciones de biomédico', () => {
    expect(puedeVerNotificacion('calibracion', compras)).toBe(false);
  });

  it('un aviso sin tipo se muestra: no se calla lo que no se puede clasificar', () => {
    expect(puedeVerNotificacion(undefined, compras)).toBe(true);
    expect(puedeVerNotificacion('mensaje_del_sistema', compras)).toBe(true);
  });

  it('quien ve finanzas sí recibe los de caja chica', () => {
    expect(puedeVerNotificacion('caja_chica', soloVe('finanzas'))).toBe(true);
  });
});

import { esSolicitudDeAprobacion, puedeAprobarNotificacion } from './useNotifications';

/** El rol Gerencia: ve cuatro módulos y solo aprueba en Compras. */
const gerencia = (m: Modulo, a: Accion) =>
  (a === 'ver' || a === 'exportar') && ['compras', 'fianzas', 'proyectos', 'flota'].includes(m)
  || (a === 'aprobar' && m === 'compras');

describe('a quien solo le toca aprobar, solo le llega lo que aprueba', () => {
  it('reconoce la solicitud de aprobación', () => {
    expect(esSolicitudDeAprobacion('Aprobación requerida: MM-001253')).toBe(true);
  });

  it('y también las guardadas sin tilde', () => {
    // Los avisos viejos dicen "Aprobacion"; la función los escribe con tilde.
    expect(esSolicitudDeAprobacion('Aprobacion requerida: MM-001253')).toBe(true);
  });

  it('un aviso que no pide aprobación no lo es', () => {
    expect(esSolicitudDeAprobacion('Nueva OT: OT-ICA-0141')).toBe(false);
    expect(esSolicitudDeAprobacion('Resumen de vencimientos')).toBe(false);
    expect(esSolicitudDeAprobacion(undefined)).toBe(false);
  });

  it('aprueba en Compras, así que la orden le llega', () => {
    expect(puedeAprobarNotificacion('orden_compra', gerencia)).toBe(true);
  });

  it('ve Flota pero no aprueba ahí: la OT no le llega', () => {
    // Ver el módulo no basta — si no firma, el aviso es ruido.
    expect(puedeAprobarNotificacion('orden_trabajo', gerencia)).toBe(false);
  });

  it('un aviso general tampoco pasa el filtro', () => {
    expect(puedeAprobarNotificacion(undefined, gerencia)).toBe(false);
    expect(puedeAprobarNotificacion('vencimientos', gerencia)).toBe(false);
  });

  it('caja chica no le llega: no tiene Finanzas', () => {
    expect(puedeVerNotificacion('caja_chica', gerencia)).toBe(false);
  });
});

import { esVisibleParaMi } from './useNotifications';

describe('un aviso dirigido a mí se ve siempre; uno general, según mis módulos', () => {
  const personal = soloVe('viajes');

  it('el resultado de mi viaje me llega aunque no vea Finanzas ni Compras', () => {
    expect(esVisibleParaMi({ dirigida: true, titulo: 'Viaje VJ-2026-010 aprobado', entidadTipo: 'viaje' }, personal, false)).toBe(true);
  });

  it('la solicitud de firma dirigida a Gerencia pasa su filtro de "solo aprobaciones"', () => {
    expect(esVisibleParaMi({ dirigida: true, titulo: 'Aprobación requerida: MM-001253', entidadTipo: 'orden_compra' }, gerencia, true)).toBe(true);
  });

  it('a Gerencia no le llega un aviso general que no pide aprobación', () => {
    expect(esVisibleParaMi({ dirigida: false, titulo: 'Edición autorizada: MM-001291', entidadTipo: 'orden_compra' }, gerencia, true)).toBe(false);
  });

  it('un aviso general de caja chica no le llega a quien no ve Finanzas', () => {
    expect(esVisibleParaMi({ dirigida: false, titulo: 'Aprobación requerida: GCC-2026-001', entidadTipo: 'caja_chica' }, compras, false)).toBe(false);
  });

  it('un aviso general de su módulo sí le llega', () => {
    expect(esVisibleParaMi({ dirigida: false, titulo: 'Edición autorizada: MM-001291', entidadTipo: 'orden_compra' }, compras, false)).toBe(true);
  });
});
