import { describe, it, expect } from 'vitest';
import { esFalloDeDescarga } from './lazy-modulo';

describe('esFalloDeDescarga', () => {
  it('reconoce el fallo de cada navegador', () => {
    expect(esFalloDeDescarga(new TypeError('Failed to fetch dynamically imported module: https://erp/assets/Flota-abc123.js'))).toBe(true);
    expect(esFalloDeDescarga(new Error('error loading dynamically imported module'))).toBe(true);
    expect(esFalloDeDescarga(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('NO confunde un error del propio módulo con un fallo de descarga', () => {
    // Si el módulo carga pero revienta, hay que ver el error, no recargar.
    expect(esFalloDeDescarga(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(esFalloDeDescarga(new Error('supabase: permission denied'))).toBe(false);
  });

  it('aguanta lo que no es un Error', () => {
    expect(esFalloDeDescarga(null)).toBe(false);
    expect(esFalloDeDescarga(undefined)).toBe(false);
    expect(esFalloDeDescarga('Failed to fetch dynamically imported module')).toBe(true);
  });
});
