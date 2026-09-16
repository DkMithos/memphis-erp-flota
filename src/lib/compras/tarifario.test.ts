import { describe, it, expect } from 'vitest';
import {
  hoyISO, tarifarioVigente, tarifarioUtilizable, opcionesParaOrden, etiquetaVigencia,
  type CotizacionTarifario,
} from './tarifario';

const cot = (p: Partial<CotizacionTarifario> = {}): CotizacionTarifario => ({
  id: 'COT-0100', estado: 'aprobada', esTarifario: true, tarifarioVigencia: null, ...p,
});

const HOY = '2026-09-16';

describe('vigencia del tarifario', () => {
  it('sin fecha, vale: hay acuerdos abiertos y los cierra Compras, no el sistema', () => {
    expect(tarifarioVigente(cot({ tarifarioVigencia: null }), HOY)).toBe(true);
  });

  it('el día en que vence todavía vale', () => {
    expect(tarifarioVigente(cot({ tarifarioVigencia: HOY }), HOY)).toBe(true);
  });

  it('al día siguiente ya no', () => {
    expect(tarifarioVigente(cot({ tarifarioVigencia: '2026-09-15' }), HOY)).toBe(false);
  });

  it('compara como texto, no como fecha: en Lima un vencimiento de hoy se daba por pasado', () => {
    // new Date('2026-09-16') es medianoche UTC = 19:00 del día 15 en Lima.
    expect(tarifarioVigente(cot({ tarifarioVigencia: '2026-09-16' }), '2026-09-16')).toBe(true);
  });

  it('hoyISO devuelve la fecha local, con ceros delante', () => {
    expect(hoyISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('qué tarifario sirve para generar una orden', () => {
  it('aprobado y vigente, sí', () => {
    expect(tarifarioUtilizable(cot(), HOY)).toBe(true);
  });

  it('una cotización normal no es tarifario por mucho que esté aprobada', () => {
    expect(tarifarioUtilizable(cot({ esTarifario: false }), HOY)).toBe(false);
  });

  it('un tarifario sin aprobar no sirve: el precio no está acordado', () => {
    expect(tarifarioUtilizable(cot({ estado: 'enviada' }), HOY)).toBe(false);
  });

  it('un tarifario vencido tampoco: un precio de hace un año no es un precio', () => {
    expect(tarifarioUtilizable(cot({ tarifarioVigencia: '2025-12-31' }), HOY)).toBe(false);
  });
});

describe('lo que se ofrece al generar una orden', () => {
  const lista = [
    cot({ id: 'TAR-1' }),
    cot({ id: 'TAR-VENCIDO', tarifarioVigencia: '2025-01-01' }),
    cot({ id: 'COT-1', esTarifario: false }),
    cot({ id: 'COT-USADA', esTarifario: false }),
    cot({ id: 'COT-BORRADOR', esTarifario: false, estado: 'borrador' }),
  ];
  const usadas = new Set(['COT-USADA']);

  it('los tarifarios van en su propio grupo', () => {
    const { tarifarios } = opcionesParaOrden(lista, usadas, HOY);
    expect(tarifarios.map(c => c.id)).toEqual(['TAR-1']);
  });

  it('un tarifario ya usado sigue disponible: para eso es un tarifario', () => {
    const { tarifarios } = opcionesParaOrden(lista, new Set(['TAR-1']), HOY);
    expect(tarifarios.map(c => c.id)).toEqual(['TAR-1']);
  });

  it('una cotización normal ya convertida en orden desaparece de la lista', () => {
    const { sueltas } = opcionesParaOrden(lista, usadas, HOY);
    expect(sueltas.map(c => c.id)).toEqual(['COT-1']);
  });

  it('los tarifarios no se cuelan entre las sueltas', () => {
    const { sueltas } = opcionesParaOrden(lista, usadas, HOY);
    expect(sueltas.some(c => c.esTarifario)).toBe(false);
  });
});

describe('cómo se lee la vigencia en pantalla', () => {
  it('dice la fecha en formato peruano', () => {
    expect(etiquetaVigencia(cot({ tarifarioVigencia: '2026-12-31' }), HOY)).toBe('vence el 31/12/2026');
  });

  it('grita cuando está vencido', () => {
    expect(etiquetaVigencia(cot({ tarifarioVigencia: '2026-01-01' }), HOY)).toBe('VENCIDO el 01/01/2026');
  });

  it('y lo dice claro cuando no tiene fecha', () => {
    expect(etiquetaVigencia(cot(), HOY)).toBe('sin fecha de vencimiento');
  });
});
