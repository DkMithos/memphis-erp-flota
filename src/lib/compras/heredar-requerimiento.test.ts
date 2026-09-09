import { describe, it, expect } from 'vitest';
import { heredarDelRequerimiento } from './heredar-requerimiento';
import { puedeCotizarRequerimiento } from './requerimientos-config';
import type { Requerimiento, ItemRequerimiento } from './requerimientos-store';

const item = (p: Partial<ItemRequerimiento> = {}): ItemRequerimiento => ({
  id: 'IT-1', descripcion: 'Llanta 295/80 R22.5', cantidad: 4, unidad: 'UND',
  precioEstimado: 1200, comentario: null, ...p,
});

const req = (p: Partial<Requerimiento> = {}): Requerimiento => ({
  id: 'RQ-00245', _dbId: 'uuid', titulo: 'Equipamiento', descripcion: '',
  centroCosto: 'OFCENTRAL', prioridad: 'media', estado: 'enviado',
  solicitanteNombre: 'Richard Navarro', solicitanteEmail: 'rnavarro@memphis.pe',
  fechaRequerida: null, moneda: 'PEN', items: [item()], totalEstimado: 4800,
  proyectoId: null, centroCostoId: null,
  aprobadoPor: null, aprobadoEn: null, rechazadoPor: null, rechazadoEn: null,
  motivoRechazo: null,
  auditoria: {
    creadoPor: 'rnavarro@memphis.pe', creadoEn: '2026-09-09', modificadoPor: null,
    modificadoEn: null, anuladoPor: null, anuladoEn: null, motivoAnulacion: null,
  },
  ...p,
});

describe('la cotización no obliga a teclear otra vez lo pedido', () => {
  it('trae cada item con su cantidad y unidad', () => {
    const h = heredarDelRequerimiento(req({
      items: [item(), item({ descripcion: 'Cámara', cantidad: 2, unidad: 'JGO', precioEstimado: 90 })],
    }));

    expect(h.items).toEqual([
      { descripcion: 'Llanta 295/80 R22.5', cantidad: 4, unidad: 'UND', precioUnitario: 1200 },
      { descripcion: 'Cámara', cantidad: 2, unidad: 'JGO', precioUnitario: 90 },
    ]);
  });

  it('el precio estimado entra como precio de partida', () => {
    const h = heredarDelRequerimiento(req({ items: [item({ precioEstimado: 555 })] }));
    expect(h.items[0].precioUnitario).toBe(555);
  });

  it('respeta la moneda del requerimiento', () => {
    expect(heredarDelRequerimiento(req({ moneda: 'USD' })).moneda).toBe('USD');
  });

  it('el comentario interno va a observaciones, no a la descripción que ve el proveedor', () => {
    const h = heredarDelRequerimiento(req({
      items: [item({ comentario: 'urge para el lunes' })],
    }));

    expect(h.items[0].descripcion).toBe('Llanta 295/80 R22.5');
    expect(h.observaciones).toBe('Llanta 295/80 R22.5: urge para el lunes');
  });

  it('sin comentarios no inventa observaciones', () => {
    expect(heredarDelRequerimiento(req()).observaciones).toBe('');
  });

  it('un requerimiento sin items no revienta', () => {
    const h = heredarDelRequerimiento(req({ items: [] }));
    expect(h.items).toEqual([]);
  });
});

describe('qué se puede cotizar', () => {
  it('lo enviado, que es donde se necesitan los precios', () => {
    expect(puedeCotizarRequerimiento('enviado')).toBe(true);
  });

  it('y lo ya aprobado', () => {
    expect(puedeCotizarRequerimiento('aprobado')).toBe(true);
  });

  it('un borrador no: todavía no lo pidió nadie', () => {
    expect(puedeCotizarRequerimiento('borrador')).toBe(false);
  });

  it('ni lo rechazado ni lo anulado', () => {
    expect(puedeCotizarRequerimiento('rechazado')).toBe(false);
    expect(puedeCotizarRequerimiento('anulado')).toBe(false);
  });
});
