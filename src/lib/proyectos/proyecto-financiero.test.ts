import { describe, it, expect } from 'vitest';
import { formatMonto, colorEjecucion, colorMargen } from './proyecto-financiero';

describe('formatMonto', () => {
  it('formatea soles con símbolo S/ y 2 decimales', () => {
    expect(formatMonto(1234.5, 'PEN')).toBe('S/ 1,234.50');
  });
  it('formatea dólares con símbolo US$', () => {
    expect(formatMonto(1000, 'USD')).toBe('US$ 1,000.00');
  });
  it('usa PEN por defecto', () => {
    expect(formatMonto(50)).toBe('S/ 50.00');
  });
  it('maneja cero', () => {
    expect(formatMonto(0)).toBe('S/ 0.00');
  });
});

describe('colorEjecucion (semáforo de ejecución presupuestal)', () => {
  it('verde por debajo del 70%', () => {
    expect(colorEjecucion(0)).toBe('green');
    expect(colorEjecucion(69.9)).toBe('green');
  });
  it('amarillo entre 70% y 90%', () => {
    expect(colorEjecucion(70)).toBe('yellow');
    expect(colorEjecucion(89.9)).toBe('yellow');
  });
  it('rojo a partir del 90%', () => {
    expect(colorEjecucion(90)).toBe('red');
    expect(colorEjecucion(150)).toBe('red');
  });
});

describe('colorMargen (semáforo de margen de ganancia)', () => {
  it('verde con margen mayor a 20%', () => {
    expect(colorMargen(21)).toBe('green');
    expect(colorMargen(50)).toBe('green');
  });
  it('amarillo entre 10% y 20%', () => {
    expect(colorMargen(20)).toBe('yellow');
    expect(colorMargen(11)).toBe('yellow');
  });
  it('rojo con margen de 10% o menos (incluye negativo)', () => {
    expect(colorMargen(10)).toBe('red');
    expect(colorMargen(0)).toBe('red');
    expect(colorMargen(-5)).toBe('red');
  });
});
