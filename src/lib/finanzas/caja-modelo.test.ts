/**
 * Orden y totales del modelo de caja chica, con los casos reales de
 * Administración: CAJA 25 (arrastre a favor) y CAJA 26 (deuda arrastrada y
 * todo cargado en bloque, con el mismo `creado_en`).
 */
import { describe, it, expect } from 'vitest';
import { prepararCajaModelo, esSaldoAnterior, esApertura, correlativo } from './caja-modelo';

const T = '2026-09-11T20:11:22.894097+00:00';   // mismo instante para todos (carga en bloque)

describe('correlativo', () => {
  it('lee el número final', () => {
    expect(correlativo('GCC-2026-007')).toBe(7);
    expect(correlativo('12')).toBe(12);
    expect(correlativo('SN')).toBeNull();
    expect(correlativo(null)).toBeNull();
  });
});

describe('clasificación de ingresos', () => {
  it('saldo anterior por tipo o por leyenda de las cajas viejas', () => {
    expect(esSaldoAnterior({ numero: '1', tipo: 'saldo_anterior', monto: -125.49, fecha: null })).toBe(true);
    expect(esSaldoAnterior({ numero: '1', tipo: 'apertura', monto: 50, fecha: null,
      descripcion: 'SALDO A FAVOR  DE CAJA CHICA ANTERIOR' })).toBe(true);
    expect(esApertura({ numero: '1', tipo: 'apertura', monto: 50, fecha: null,
      descripcion: 'SALDO A FAVOR DE CAJA CHICA ANTERIOR' })).toBe(false);
  });
  it('apertura por tipo o por leyenda', () => {
    expect(esApertura({ numero: '2', tipo: 'reposicion', monto: 9500, fecha: null, descripcion: 'APERTURA DE CAJA' })).toBe(true);
    expect(esApertura({ numero: '2', tipo: 'reposicion', monto: 10000, fecha: null, descripcion: 'CAJA CHICA APERTURA' })).toBe(true);
    expect(esApertura({ numero: '2', tipo: 'apertura', monto: 500, fecha: null, descripcion: 'CUENTA BBVA' })).toBe(true);
    expect(esApertura({ numero: '3', tipo: 'reposicion', monto: 102, fecha: null, descripcion: 'DEVOLUCIÓN DE ANTONIO' })).toBe(false);
  });
});

describe('CAJA 26 SOLES — deuda arrastrada y carga en bloque', () => {
  const ingresos = [
    { numero: '1', tipo: 'saldo_anterior', monto: -125.49, fecha: '2026-09-11', origen: 'CAJA 25 SOLES',
      descripcion: 'DEUDA DE CAJA CHICA ANTERIOR (CAJA 25 SOLES)', creado_en: T },
    { numero: '2', tipo: 'reposicion', monto: 9500, fecha: '2026-09-11', origen: 'DEPÓSITO',
      descripcion: 'APERTURA DE CAJA', creado_en: T },
  ];
  // Fechas de pago desordenadas a propósito: el export actual las usaba para ordenar.
  const gastos = [
    { numero: 'GCC-2026-020', monto: 10, fecha: '2026-08-31', categoria: 'FACTURA', beneficiario: 'LA PERLA', creado_en: T },
    { numero: 'GCC-2026-001', monto: 27, fecha: '2026-09-02', categoria: 'FACTURA', beneficiario: 'TARAPOTO COURIER', creado_en: T },
    { numero: 'GCC-2026-002', monto: 10, fecha: '2026-09-04', categoria: 'FACTURA', beneficiario: 'LA PERLA', creado_en: T },
    { numero: 'GCC-2026-003', monto: 202.84, fecha: '2026-09-11', categoria: 'SIN DOCUMENTO', beneficiario: 'RICHARD NAVARRO', creado_en: T },
  ];
  const m = prepararCajaModelo(ingresos, gastos);

  it('saldo anterior primero, apertura segundo, luego por correlativo (no por fecha de pago)', () => {
    expect(m.filas.map(f => f.clase)).toEqual(['saldo_anterior', 'apertura', 'gasto', 'gasto', 'gasto', 'gasto']);
    expect(m.filas.slice(2).map(f => f.razonSocial)).toEqual(['TARAPOTO COURIER', 'LA PERLA', 'RICHARD NAVARRO', 'LA PERLA']);
  });

  it('numera los ítems 1..N', () => {
    expect(m.filas.map(f => f.item)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('la deuda va como ingreso negativo, el saldo inicial es cero y el cierre cuadra con el ERP', () => {
    expect(m.filas[0].ingreso).toBe(-125.49);
    expect(m.saldoInicial).toBe(0);
    expect(m.ingresos).toBe(9374.51);            // 9500 − 125.49 (lo que el ERP llama monto_asignado)
    expect(m.gastos).toBe(249.84);
    expect(m.saldoFinal).toBe(9124.67);          // 0 + 9374.51 − 249.84
  });
});

describe('CAJA 25 SOLES — arrastre a favor y registro en distintos momentos', () => {
  const ingresos = [
    { numero: '3', tipo: 'reposicion', monto: 102, fecha: '2026-09-08', origen: 'ANTONIO REYES',
      descripcion: 'DEVOLUCIÓN DE ANTONIO REYES POR RENDICION', creado_en: '2026-09-09T15:53:01Z' },
    { numero: '2', tipo: 'reposicion', monto: 10000, fecha: '2026-09-07', origen: 'BBVA EMPRESA SOLES',
      descripcion: 'CAJA CHICA APERTURA', creado_en: '2026-09-09T15:31:32Z' },
    { numero: '1', tipo: 'saldo_anterior', monto: 95.78, fecha: '2026-09-04', origen: 'CAJA 24 SOLES',
      descripcion: 'SALDO A FAVOR DE CAJA CHICA ANTERIOR (CAJA 24 SOLES)', creado_en: '2026-09-08T19:25:25Z' },
  ];
  const gastos = [
    // Registrado después pero pagado antes: debe ir DESPUÉS.
    { numero: '5', monto: 40, fecha: '2026-09-01', beneficiario: 'B', creado_en: '2026-09-09T16:10:00Z' },
    { numero: '4', monto: 60, fecha: '2026-09-09', beneficiario: 'A', creado_en: '2026-09-09T15:40:00Z' },
  ];
  const m = prepararCajaModelo(ingresos, gastos);

  it('ítem 1 saldo anterior, ítem 2 apertura, y el resto por momento de registro', () => {
    expect(m.filas.map(f => [f.item, f.clase, f.razonSocial])).toEqual([
      [1, 'saldo_anterior', 'CAJA 24 SOLES'],
      [2, 'apertura', 'BBVA EMPRESA SOLES'],
      [3, 'gasto', 'A'],                 // registrado 15:40
      [4, 'ingreso', 'ANTONIO REYES'],   // registrado 15:53
      [5, 'gasto', 'B'],                 // registrado 16:10 aunque se pagó el 1 de set
    ]);
  });

  it('saldo inicial = arrastre positivo; ingresos no lo cuentan dos veces', () => {
    expect(m.saldoInicial).toBe(95.78);
    expect(m.ingresos).toBe(10102);              // 10000 + 102
    expect(m.gastos).toBe(100);
    expect(m.saldoFinal).toBe(10097.78);         // 95.78 + 10102 − 100 = total ingresos − gastos
  });
});

describe('caja sin caja anterior', () => {
  it('saldo inicial cero y la apertura es el ítem 1', () => {
    const m = prepararCajaModelo(
      [{ numero: '1', tipo: 'apertura', monto: 5000, fecha: '2025-09-24', descripcion: 'APERTURA DE CAJA', creado_en: '2025-09-24T10:00:00Z' }],
      [{ numero: '1', monto: 53.8, fecha: '2025-09-24', beneficiario: 'FOOD RETAIL', creado_en: '2025-09-24T11:00:00Z' }],
    );
    expect(m.filas[0].clase).toBe('apertura');
    expect(m.filas[0].item).toBe(1);
    expect(m.saldoInicial).toBe(0);
    expect(m.ingresos).toBe(5000);
    expect(m.saldoFinal).toBe(4946.2);
  });
});
