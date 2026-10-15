import { describe, it, expect } from 'vitest';
import { parsearSeries } from './unidades';

describe('parsearSeries: lo que Logística pega desde el Excel', () => {
  it('una serie por línea, limpias y en mayúsculas', () => {
    expect(parsearSeries(' az9627549 \nAZ9627550\r\n\n az9627551')).toEqual(['AZ9627549', 'AZ9627550', 'AZ9627551']);
  });
  it('también separadas por coma, punto y coma o tabulador', () => {
    expect(parsearSeries('A1, A2;A3\tA4')).toEqual(['A1', 'A2', 'A3', 'A4']);
  });
  it('quita repetidas y los NA del Excel de La Sirena', () => {
    expect(parsearSeries('A1\nNA\nn/a\nS/N\nA1\na1')).toEqual(['A1']);
  });
  it('vacío devuelve vacío', () => {
    expect(parsearSeries('')).toEqual([]);
    expect(parsearSeries('\n\n')).toEqual([]);
  });
});
