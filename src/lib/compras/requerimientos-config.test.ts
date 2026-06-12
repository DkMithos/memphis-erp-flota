import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  generarIdRequerimiento,
  extraerNumeroSecuencial,
} from './requerimientos-config';

describe('normalizeEmail', () => {
  it('pasa a minúsculas y recorta espacios', () => {
    expect(normalizeEmail('  Kevin.Castillo@Memphis.PE  ')).toBe('kevin.castillo@memphis.pe');
  });
  it('deja igual un email ya normalizado', () => {
    expect(normalizeEmail('a@b.com')).toBe('a@b.com');
  });
});

describe('generarIdRequerimiento', () => {
  it('genera REQ-NNNN con padding a 4 dígitos', () => {
    expect(generarIdRequerimiento(0)).toBe('REQ-0001');
    expect(generarIdRequerimiento(41)).toBe('REQ-0042');
    expect(generarIdRequerimiento(1233)).toBe('REQ-1234');
  });
});

describe('extraerNumeroSecuencial (Requerimiento)', () => {
  it('extrae el correlativo de un REQ válido', () => {
    expect(extraerNumeroSecuencial('REQ-0042')).toBe(42);
    expect(extraerNumeroSecuencial('REQ-0001')).toBe(1);
  });
  it('devuelve null para formatos inválidos', () => {
    expect(extraerNumeroSecuencial('OC-0001')).toBeNull();
    expect(extraerNumeroSecuencial('basura')).toBeNull();
  });
});
