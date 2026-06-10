import { describe, it, expect } from 'vitest';
import { generarNumeroOT, validarNumeroOT, extraerNumeroSecuencial } from './ot-config';

describe('generarNumeroOT', () => {
  it('genera formato OT-AÑO-NNN con padding a 3 dígitos', () => {
    const year = new Date().getFullYear();
    expect(generarNumeroOT(0)).toBe(`OT-${year}-001`);
    expect(generarNumeroOT(41)).toBe(`OT-${year}-042`);
  });
  it('arranca en 001 cuando no se pasa último número', () => {
    const year = new Date().getFullYear();
    expect(generarNumeroOT()).toBe(`OT-${year}-001`);
  });
});

describe('validarNumeroOT', () => {
  it('acepta formatos válidos', () => {
    expect(validarNumeroOT('OT-2026-001')).toBe(true);
    expect(validarNumeroOT('OT-2024-999')).toBe(true);
  });
  it('rechaza formatos inválidos', () => {
    expect(validarNumeroOT('OT-2026-1')).toBe(false);
    expect(validarNumeroOT('OT-26-001')).toBe(false);
    expect(validarNumeroOT('REQ-0001')).toBe(false);
    expect(validarNumeroOT('')).toBe(false);
  });
});

describe('extraerNumeroSecuencial (OT)', () => {
  it('extrae el correlativo de un OT válido', () => {
    expect(extraerNumeroSecuencial('OT-2026-042')).toBe(42);
    expect(extraerNumeroSecuencial('OT-2024-001')).toBe(1);
  });
  it('devuelve null para formatos inválidos', () => {
    expect(extraerNumeroSecuencial('OT-2026-1')).toBeNull();
    expect(extraerNumeroSecuencial('basura')).toBeNull();
  });
});
