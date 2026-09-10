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
