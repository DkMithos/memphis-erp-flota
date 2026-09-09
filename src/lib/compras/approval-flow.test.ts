import { describe, it, expect } from 'vitest';
import {
  determinarNivelAprobacion,
  nivelAprobacionColor,
  formatearUmbral,
  FLUJO_APROBACION_DEFAULT,
  etapasRequeridas,
  puedeFirmarEtapa,
  firmasCompletas,
} from './approval-flow';

describe('determinarNivelAprobacion', () => {
  const cfg = FLUJO_APROBACION_DEFAULT;

  it('asigna nivel 1 a montos bajo el umbral 1 (< S/ 10,000)', () => {
    expect(determinarNivelAprobacion(5000, 'PEN', cfg).nivel).toBe(1);
    expect(determinarNivelAprobacion(0, 'PEN', cfg).nivel).toBe(1);
    expect(determinarNivelAprobacion(9999, 'PEN', cfg).nivel).toBe(1);
  });

  it('asigna nivel 2 a montos intermedios (10k–30k)', () => {
    expect(determinarNivelAprobacion(10000, 'PEN', cfg).nivel).toBe(2);
    expect(determinarNivelAprobacion(25000, 'PEN', cfg).nivel).toBe(2);
    expect(determinarNivelAprobacion(29999, 'PEN', cfg).nivel).toBe(2);
  });

  it('asigna nivel 3 a montos altos (>= 30k)', () => {
    expect(determinarNivelAprobacion(30000, 'PEN', cfg).nivel).toBe(3);
    expect(determinarNivelAprobacion(1_000_000, 'PEN', cfg).nivel).toBe(3);
  });

  it('convierte USD a PEN con el tipo de cambio antes de decidir el nivel', () => {
    // 5,000 USD * 3.75 = 18,750 PEN → nivel 2
    expect(determinarNivelAprobacion(5000, 'USD', cfg).nivel).toBe(2);
    // 1,000 USD * 3.75 = 3,750 PEN → nivel 1
    expect(determinarNivelAprobacion(1000, 'USD', cfg).nivel).toBe(1);
    // 10,000 USD * 3.75 = 37,500 PEN → nivel 3
    expect(determinarNivelAprobacion(10000, 'USD', cfg).nivel).toBe(3);
  });

  it('todo nivel exige al menos una firma', () => {
    // Antes se medía con `aprobadoresRequeridos`, un número. Ahora el nivel
    // declara QUÉ etapas firman, que es lo que decide si la orden se aprueba.
    const n = determinarNivelAprobacion(5000, 'PEN', cfg);
    expect(n.etapas.length).toBeGreaterThanOrEqual(1);
  });
});

describe('nivelAprobacionColor', () => {
  it('mapea cada nivel a un color de semáforo', () => {
    expect(nivelAprobacionColor(1)).toContain('green');
    expect(nivelAprobacionColor(2)).toContain('yellow');
    expect(nivelAprobacionColor(3)).toContain('red');
  });
});

describe('formatearUmbral', () => {
  it('formatea montos con separador de miles', () => {
    expect(formatearUmbral(10000)).toBe('S/ 10,000');
  });
  it('muestra "Sin límite" cuando el umbral es null', () => {
    expect(formatearUmbral(null)).toBe('Sin límite');
  });
});

describe('circuito por etapas', () => {
  const config = FLUJO_APROBACION_DEFAULT;

  it('una orden pequeña la firman comprador y operaciones', () => {
    expect(etapasRequeridas(5000, 'PEN', config)).toEqual(['comprador', 'operaciones']);
  });

  it('a partir del umbral entra Gerencia', () => {
    expect(etapasRequeridas(15000, 'PEN', config)).toEqual(['comprador', 'operaciones', 'gerencia']);
    expect(etapasRequeridas(50000, 'PEN', config)).toEqual(['comprador', 'operaciones', 'gerencia']);
  });

  it('una orden en dólares se convierte antes de decidir el nivel', () => {
    // 4,000 USD × 3.40 = 13,600 PEN → ya necesita Gerencia.
    expect(etapasRequeridas(4000, 'USD', config)).toContain('gerencia');
  });

  it('cada rol firma solo su etapa', () => {
    expect(puedeFirmarEtapa(['Compras'], 'comprador', config)).toBe(true);
    expect(puedeFirmarEtapa(['Compras'], 'gerencia', config)).toBe(false);
    expect(puedeFirmarEtapa(['Proyectos'], 'operaciones', config)).toBe(true);
    expect(puedeFirmarEtapa(['Gerencia'], 'gerencia', config)).toBe(true);
    // Richard tiene Compras y Administración: Administración no firma etapas.
    expect(puedeFirmarEtapa(['Compras', 'Administración'], 'operaciones', config)).toBe(false);
  });

  it('la orden solo queda aprobada con TODAS las firmas requeridas', () => {
    const req = etapasRequeridas(15000, 'PEN', config);
    expect(firmasCompletas(['comprador'], req)).toBe(false);
    expect(firmasCompletas(['comprador', 'operaciones'], req)).toBe(false);
    expect(firmasCompletas(['comprador', 'operaciones', 'gerencia'], req)).toBe(true);
  });

  it('una firma de más no estorba', () => {
    const req = etapasRequeridas(5000, 'PEN', config);
    expect(firmasCompletas(['comprador', 'operaciones', 'gerencia'], req)).toBe(true);
  });
});
