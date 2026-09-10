import { describe, it, expect } from 'vitest';
import { validateTransition, COTIZACION_TRANSITIONS } from './state-machine';

const puede = (desde: string, hasta: string) =>
  validateTransition(desde, hasta, COTIZACION_TRANSITIONS, 'COT-0001').valid;

describe('una cotización rechazada se puede corregir y volver a presentar', () => {
  it('rechazada vuelve a revisión', () => {
    // Richard la corrigió y le dio a enviar: el cambio se rechazaba en silencio
    // y la cotización se quedaba en "rechazada" mientras la pantalla decía que
    // se había enviado.
    expect(puede('rechazada', 'enviada')).toBe(true);
  });

  it('y también se puede anular sin pasar por revisión', () => {
    expect(puede('rechazada', 'anulada')).toBe(true);
  });

  it('pero no salta directa a aprobada', () => {
    expect(puede('rechazada', 'aprobada')).toBe(false);
  });
});

describe('el resto del circuito no cambia', () => {
  it('un borrador se presenta a revisión', () => {
    expect(puede('borrador', 'enviada')).toBe(true);
  });

  it('lo aprobado y lo anulado son finales', () => {
    expect(puede('aprobada', 'enviada')).toBe(false);
    expect(puede('anulada', 'enviada')).toBe(false);
  });

  it('no se aprueba desde borrador: primero se presenta', () => {
    expect(puede('borrador', 'aprobada')).toBe(false);
  });
});
