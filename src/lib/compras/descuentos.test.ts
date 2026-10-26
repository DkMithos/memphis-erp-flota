import { describe, it, expect } from 'vitest';
import { calcularTotalesConDescuento, descuentoLinea, descuentoGlobalMonto, etiquetaDescuentoItem, netoLinea } from './descuentos';

describe('descuentoLinea', () => {
  it('porcentaje: % sobre cantidad × precio', () => {
    expect(descuentoLinea({ cantidad: 10, precioUnitario: 100, descuentoTipo: 'porcentaje', descuentoValor: 5 })).toBe(50);
  });
  it('por unidad: monto × cantidad', () => {
    expect(descuentoLinea({ cantidad: 7, precioUnitario: 168, descuentoTipo: 'unidad', descuentoValor: 45.36 })).toBe(317.52);
  });
  it('monto fijo del ítem', () => {
    expect(descuentoLinea({ cantidad: 3, precioUnitario: 20, descuentoTipo: 'monto', descuentoValor: 12.5 })).toBe(12.5);
  });
  it('sin tipo usa el monto guardado (filas migradas del sistema anterior)', () => {
    expect(descuentoLinea({ cantidad: 1, precioUnitario: 236.34, descuento: 23.64 })).toBe(23.64);
    expect(netoLinea({ cantidad: 1, precioUnitario: 236.34, descuento: 23.64 })).toBe(212.7);
  });
  it('nunca pasa de la línea ni es negativo', () => {
    expect(descuentoLinea({ cantidad: 2, precioUnitario: 10, descuentoTipo: 'monto', descuentoValor: 500 })).toBe(20);
    expect(descuentoLinea({ cantidad: 2, precioUnitario: 10, descuentoTipo: 'porcentaje', descuentoValor: -5 })).toBe(0);
    expect(descuentoLinea({ cantidad: 2, precioUnitario: 10, descuentoTipo: 'porcentaje', descuentoValor: 150 })).toBe(20);
  });
});

describe('descuento global', () => {
  it('porcentaje sobre el subtotal neto de ítems y monto fijo, con tope', () => {
    expect(descuentoGlobalMonto(1000, { tipo: 'porcentaje', valor: 10 })).toBe(100);
    expect(descuentoGlobalMonto(1000, { tipo: 'monto', valor: 250 })).toBe(250);
    expect(descuentoGlobalMonto(1000, { tipo: 'monto', valor: 5000 })).toBe(1000);
    expect(descuentoGlobalMonto(1000, null)).toBe(0);
    expect(descuentoGlobalMonto(1000, { tipo: null, valor: 99 })).toBe(0);
  });
});

describe('calcularTotalesConDescuento', () => {
  const items = [
    { cantidad: 10, precioUnitario: 100, descuentoTipo: 'porcentaje' as const, descuentoValor: 5 },   // 1000 − 50
    { cantidad: 4, precioUnitario: 50, descuentoTipo: 'unidad' as const, descuentoValor: 2 },          // 200 − 8
    { cantidad: 1, precioUnitario: 300 },                                                               // 300
  ];
  it('bruto − ítems − global = base; IGV sobre la base', () => {
    const t = calcularTotalesConDescuento(items, 0.18, { tipo: 'porcentaje', valor: 10 });
    expect(t.bruto).toBe(1500);
    expect(t.descuentoItems).toBe(58);
    expect(t.descuentoGlobal).toBe(144.2);      // 10 % de 1442
    expect(t.subtotal).toBe(1297.8);
    expect(t.impuestos).toBe(233.6);            // 1297.8 × 0.18 = 233.604
    expect(t.total).toBe(1531.4);
  });
  it('sin descuentos coincide con el cálculo de siempre', () => {
    const t = calcularTotalesConDescuento([{ cantidad: 2, precioUnitario: 50 }], 0.18);
    expect(t).toEqual({ bruto: 100, descuentoItems: 0, descuentoGlobal: 0, subtotal: 100, impuestos: 18, total: 118 });
  });
  it('régimen sin IGV', () => {
    const t = calcularTotalesConDescuento(items, 0, { tipo: 'monto', valor: 42 });
    expect(t.subtotal).toBe(1400);
    expect(t.impuestos).toBe(0);
    expect(t.total).toBe(1400);
  });
});

describe('etiquetaDescuentoItem', () => {
  it('describe cómo lo dio el proveedor', () => {
    expect(etiquetaDescuentoItem({ cantidad: 10, precioUnitario: 100, descuentoTipo: 'porcentaje', descuentoValor: 5 }, 'PEN')).toBe('5 %');
    expect(etiquetaDescuentoItem({ cantidad: 4, precioUnitario: 50, descuentoTipo: 'unidad', descuentoValor: 2 }, 'USD')).toBe('$ 2.00/u');
    expect(etiquetaDescuentoItem({ cantidad: 1, precioUnitario: 50, descuento: 5 }, 'PEN')).toBe('S/ 5.00');
    expect(etiquetaDescuentoItem({ cantidad: 1, precioUnitario: 50 }, 'PEN')).toBeNull();
  });
});
