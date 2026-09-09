import { describe, it, expect } from 'vitest';
import { tasaIgv, regimenSugerido, retencionRhSugerida, esPersonaNatural } from './regimen-igv';

describe('tasaIgv', () => {
  it('solo el régimen gravado lleva 18%', () => {
    expect(tasaIgv('gravado')).toBe(0.18);
    expect(tasaIgv('exonerado_amazonia')).toBe(0);
    expect(tasaIgv('no_domiciliado')).toBe(0);
    expect(tasaIgv('inafecto')).toBe(0);
  });

  it('ante un valor desconocido cobra IGV, que es lo prudente', () => {
    expect(tasaIgv(null)).toBe(0.18);
    expect(tasaIgv('cualquier_cosa')).toBe(0.18);
  });
});

describe('regimenSugerido', () => {
  it('respeta el régimen que alguien decidió para el proveedor', () => {
    expect(regimenSugerido({ regimenIgv: 'exonerado_amazonia', domiciliado: false })).toBe('exonerado_amazonia');
  });

  it("'gravado' guardado no bloquea la propuesta: es el valor por defecto de la columna", () => {
    // Los ~30 proveedores persona natural del catálogo quedaron en 'gravado'
    // porque es el default, no porque alguien lo decidiera.
    expect(regimenSugerido({ regimenIgv: 'gravado', domiciliado: true, ruc: '10067848140' })).toBe('inafecto');
    expect(regimenSugerido({ regimenIgv: 'gravado', domiciliado: false, ruc: 'EXT-0225' })).toBe('no_domiciliado');
    expect(regimenSugerido({ regimenIgv: 'gravado', domiciliado: true, ruc: '20453919651' })).toBe('gravado');
  });

  it('un no domiciliado no lleva IGV peruano', () => {
    expect(regimenSugerido({ domiciliado: false, ruc: 'EXT-0225' })).toBe('no_domiciliado');
  });

  it('una persona natural se propone como inafecta (recibo por honorarios)', () => {
    expect(regimenSugerido({ domiciliado: true, ruc: '10067848140' })).toBe('inafecto');
    expect(regimenSugerido({ domiciliado: true, ruc: '15613345148' })).toBe('inafecto');
  });

  it('una empresa peruana es gravada', () => {
    expect(regimenSugerido({ domiciliado: true, ruc: '20453919651' })).toBe('gravado');
  });
});

describe('esPersonaNatural', () => {
  it('distingue por el arranque del RUC', () => {
    expect(esPersonaNatural('10067848140')).toBe(true);
    expect(esPersonaNatural('15613345148')).toBe(true);
    expect(esPersonaNatural('20453919651')).toBe(false);
    expect(esPersonaNatural('EXT-0225')).toBe(false);
    expect(esPersonaNatural(null)).toBe(false);
  });
});

describe('retencionRhSugerida', () => {
  const hoy = new Date('2026-09-09');

  it('a una empresa no se le propone retención de cuarta', () => {
    expect(retencionRhSugerida({ ruc: '20453919651' }, hoy)).toBe(false);
  });

  it('a una persona natural sin suspensión, sí', () => {
    expect(retencionRhSugerida({ ruc: '10067848140' }, hoy)).toBe(true);
  });

  it('con suspensión vigente, no', () => {
    expect(retencionRhSugerida(
      { ruc: '10067848140', suspensionRetencionRh: true, suspensionRetencionHasta: '2026-12-31' }, hoy,
    )).toBe(false);
  });

  it('con la suspensión VENCIDA vuelve a retener — que es el olvido típico', () => {
    expect(retencionRhSugerida(
      { ruc: '10067848140', suspensionRetencionRh: true, suspensionRetencionHasta: '2025-12-31' }, hoy,
    )).toBe(true);
  });
});
