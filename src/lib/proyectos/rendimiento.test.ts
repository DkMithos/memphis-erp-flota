import { describe, it, expect } from 'vitest';
import {
  calcularMargen, aSoles, margenLegible, PARAMETROS_DEFECTO, IGV,
} from './rendimiento';

describe('margen de proyecto (reglas de Antonio)', () => {
  it('los ingresos son el convenio SIN IGV', () => {
    const r = calcularMargen({ convenio: 1180, costo: 0 });
    expect(r.ingresosSinIgv).toBe(1000); // 1180 / 1,18
  });

  it('las tres contraprestaciones salen del convenio CON IGV', () => {
    const r = calcularMargen({ convenio: 1000, costo: 0 });
    expect(r.consultoria).toBe(100);      // 10 %
    expect(r.contraprestacion).toBe(50);  // 5 %
    expect(r.ventaCiprl).toBe(40);        // 4 %
  });

  it('NO incluye ganancia por integración: no aparece en la cuenta', () => {
    // La ganancia neta es ingresos − costo − las tres contraprestaciones, nada más.
    const r = calcularMargen({ convenio: 1180, costo: 500 });
    // ingresos 1000 − costo 500 − 118 − 59 − 47,2 = 275,8
    expect(r.gananciaNeta).toBe(275.8);
  });

  it('un proyecto que se pasa de costo da margen NEGATIVO', () => {
    const r = calcularMargen({ convenio: 1180, costo: 1000 });
    expect(r.gananciaNeta).toBeLessThan(0);
    expect(r.margen).toBeLessThan(0);
  });

  it('el margen es la ganancia sobre los ingresos sin IGV', () => {
    const r = calcularMargen({ convenio: 1180, costo: 500 });
    expect(r.margen).toBeCloseTo(275.8 / 1000, 6);
  });

  it('los parámetros se pueden cambiar sin tocar la cuenta', () => {
    const r = calcularMargen({
      convenio: 1000, costo: 0,
      parametros: { consultoria: 0.10, contraprestacion: 0, ventaCiprl: 0 },
    });
    expect(r.contraprestacion).toBe(0);
    expect(r.ventaCiprl).toBe(0);
    expect(r.consultoria).toBe(100);
  });

  it('los valores por defecto son 10 / 5 / 4 y el IGV 18 %', () => {
    expect(PARAMETROS_DEFECTO).toEqual({ consultoria: 0.10, contraprestacion: 0.05, ventaCiprl: 0.04 });
    expect(IGV).toBe(0.18);
  });
});

describe('conversión a soles con TC fijo', () => {
  it('los dólares se pasan a soles', () => {
    expect(aSoles(100, 'USD', 3.7)).toBe(370);
    expect(aSoles(100, 'US$', 3.7)).toBe(370);
  });
  it('los soles quedan igual', () => {
    expect(aSoles(100, 'Soles', 3.7)).toBe(100);
    expect(aSoles(100, 'PEN', 3.7)).toBe(100);
  });
});

describe('cómo se lee un margen', () => {
  it('una cifra decimal, con coma', () => {
    expect(margenLegible(0.1875)).toBe('18,8 %');
    expect(margenLegible(-0.1309)).toBe('-13,1 %');
  });
});
