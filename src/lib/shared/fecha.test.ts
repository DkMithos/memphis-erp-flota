import { describe, it, expect } from 'vitest';
import { formatearFecha, formatearFechaHora } from './fecha';

describe('formatearFecha', () => {
  it('no retrocede un día con una fecha sin hora', () => {
    // El fallo real: una orden emitida el 09/09 se mostraba como 08/09 porque
    // 'YYYY-MM-DD' se interpretaba como medianoche UTC y Lima va cinco horas atrás.
    expect(formatearFecha('2026-09-09')).toBe('09/09/2026');
    expect(formatearFecha('2026-01-01')).toBe('01/01/2026');
    expect(formatearFecha('2026-12-31')).toBe('31/12/2026');
  });

  it('acepta vacíos sin romper', () => {
    expect(formatearFecha(null)).toBe('—');
    expect(formatearFecha(undefined)).toBe('—');
    expect(formatearFecha('')).toBe('—');
  });

  it('deja pasar lo que no es una fecha', () => {
    expect(formatearFecha('sin fecha')).toBe('sin fecha');
  });
});

describe('formatearFechaHora', () => {
  it('un día suelto no inventa una hora', () => {
    expect(formatearFechaHora('2026-09-09')).toBe('09/09/2026');
  });

  it('vacío no rompe', () => {
    expect(formatearFechaHora(null)).toBe('—');
  });
});
