import { describe, it, expect } from 'vitest';
import {
  determinarNivelAprobacion,
  nivelAprobacionColor,
  formatearUmbral,
  FLUJO_APROBACION_DEFAULT,
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

  it('el nivel asignado siempre exige al menos 1 aprobador', () => {
    const n = determinarNivelAprobacion(5000, 'PEN', cfg);
    expect(n.aprobadoresRequeridos).toBeGreaterThanOrEqual(1);
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
