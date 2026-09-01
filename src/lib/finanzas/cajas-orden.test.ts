import { describe, it, expect } from 'vitest';
import { ordenarCajas, filtrarCajas, cajasParaMostrar } from './cajas-orden';

const caja = (nombre: string, estado: string, moneda = 'PEN', extra: Record<string, string> = {}) =>
  ({ nombre, estado, moneda, ...extra });

describe('ordenarCajas', () => {
  it('pone las abiertas antes que las cerradas', () => {
    const r = ordenarCajas([
      caja('CAJA 5', 'cerrada'),
      caja('CAJA 9', 'activo'),
      caja('CAJA 7', 'en_reposicion'),
    ]);
    expect(r.map(c => c.estado)).toEqual(['activo', 'en_reposicion', 'cerrada']);
  });

  it('ordena los números como números, no como texto', () => {
    // Con localeCompare normal, "CAJA 10" iría antes que "CAJA 2".
    const r = ordenarCajas([
      caja('CAJA 10', 'activo'), caja('CAJA 2', 'activo'),
      caja('CAJA 1', 'activo'), caja('CAJA 21', 'activo'),
    ]);
    expect(r.map(c => c.nombre)).toEqual(['CAJA 1', 'CAJA 2', 'CAJA 10', 'CAJA 21']);
  });

  it('deja juntas las dos monedas de la misma caja', () => {
    const r = ordenarCajas([
      caja('CAJA 3', 'activo', 'USD'),
      caja('CAJA 2', 'activo', 'PEN'),
      caja('CAJA 3', 'activo', 'PEN'),
    ]);
    expect(r.map(c => `${c.nombre}-${c.moneda}`))
      .toEqual(['CAJA 2-PEN', 'CAJA 3-PEN', 'CAJA 3-USD']);
  });

  it('no muta el arreglo original', () => {
    const original = [caja('CAJA 2', 'cerrada'), caja('CAJA 1', 'activo')];
    const copia = [...original];
    ordenarCajas(original);
    expect(original).toEqual(copia);
  });

  it('manda al final un estado desconocido en vez de romper', () => {
    const r = ordenarCajas([caja('X', 'inventado'), caja('Y', 'activo')]);
    expect(r[0].nombre).toBe('Y');
  });
});

describe('filtrarCajas', () => {
  const cajas = [
    caja('CAJA 1', 'activo', 'PEN', { id: 'ADMI001-2025', responsable: 'Carolina Okamura' }),
    caja('CAJA 1', 'cerrada', 'USD', { id: 'ADMI001-2025-DOLARES', responsable: 'Carolina Okamura' }),
    caja('CAJA 2', 'activo', 'PEN', { id: 'ADMI002-2025', responsable: 'Shirley Bujaico' }),
  ];

  it('filtra por moneda', () => {
    expect(filtrarCajas(cajas, { busqueda: '', moneda: 'USD', estado: 'todos' })).toHaveLength(1);
  });

  it('filtra por estado', () => {
    expect(filtrarCajas(cajas, { busqueda: '', moneda: 'todos', estado: 'activo' })).toHaveLength(2);
  });

  it('busca por nombre, código y responsable', () => {
    const f = (busqueda: string) => filtrarCajas(cajas, { busqueda, moneda: 'todos', estado: 'todos' });
    expect(f('shirley')).toHaveLength(1);
    expect(f('ADMI001')).toHaveLength(2);
    expect(f('caja 2')).toHaveLength(1);
  });
});

describe('cajasParaMostrar', () => {
  it('filtra y ordena en un paso', () => {
    const r = cajasParaMostrar(
      [caja('CAJA 10', 'cerrada'), caja('CAJA 2', 'activo'), caja('CAJA 1', 'activo')],
      { busqueda: '', moneda: 'todos', estado: 'todos' },
    );
    expect(r.map(c => c.nombre)).toEqual(['CAJA 1', 'CAJA 2', 'CAJA 10']);
  });
});
