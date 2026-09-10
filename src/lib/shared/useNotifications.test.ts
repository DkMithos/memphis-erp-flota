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

/** El rol de William: ve cuatro módulos y solo aprueba en Compras. */
const gerenciaOperativa = (m: Modulo, a: Accion) =>
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
    expect(puedeAprobarNotificacion('orden_compra', gerenciaOperativa)).toBe(true);
  });

  it('ve Flota pero no aprueba ahí: la OT no le llega', () => {
    // Ver el módulo no basta — si no firma, el aviso es ruido.
    expect(puedeAprobarNotificacion('orden_trabajo', gerenciaOperativa)).toBe(false);
  });

  it('un aviso general tampoco pasa el filtro', () => {
    expect(puedeAprobarNotificacion(undefined, gerenciaOperativa)).toBe(false);
    expect(puedeAprobarNotificacion('vencimientos', gerenciaOperativa)).toBe(false);
  });

  it('caja chica no le llega: no tiene Finanzas', () => {
    expect(puedeVerNotificacion('caja_chica', gerenciaOperativa)).toBe(false);
  });
});
