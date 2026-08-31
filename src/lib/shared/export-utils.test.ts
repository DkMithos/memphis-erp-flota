/**
 * Reglas de conversión al exportar a Excel.
 *
 * Lo que se protege aquí es el caso que rompía el trabajo diario: los importes
 * tienen que llegar como número (para poder sumarlos) y los códigos como RUC o
 * número de cuenta tienen que seguir siendo texto (para no perder ceros ni
 * terminar en notación científica).
 */
import { describe, it, expect } from 'vitest';
import { esNumeroReal } from './export-utils';

describe('esNumeroReal — qué se escribe como número en el Excel', () => {
  it('trata los importes como número', () => {
    expect(esNumeroReal('1234.56')).toBe(true);
    expect(esNumeroReal('0.25')).toBe(true);
    expect(esNumeroReal('-481.75')).toBe(true);
  });

  it('trata las cantidades enteras cortas como número', () => {
    expect(esNumeroReal('59')).toBe(true);
    expect(esNumeroReal('414')).toBe(true);
  });

  it('deja los RUC como texto', () => {
    // 11 dígitos: es un código, no una cantidad
    expect(esNumeroReal('20604953236')).toBe(false);
    expect(esNumeroReal('10734501536')).toBe(false);
  });

  it('deja los números de cuenta y CCI como texto', () => {
    expect(esNumeroReal('1947227826041')).toBe(false);
    expect(esNumeroReal('00219400722782604198')).toBe(false);
  });

  it('conserva los ceros a la izquierda', () => {
    expect(esNumeroReal('0045165')).toBe(false);
    expect(esNumeroReal('001006')).toBe(false);
  });

  it('no toca lo que no es numérico', () => {
    expect(esNumeroReal('MM-001233')).toBe(false);
    expect(esNumeroReal('F001-0034292')).toBe(false);
    expect(esNumeroReal('')).toBe(false);
    expect(esNumeroReal('S/ 1,234.56')).toBe(false);
  });
});
