import { describe, it, expect } from 'vitest';
// Se prueba el MISMO módulo que corre en la Edge Function.
import {
  numeroPeru, mesEspanol, fechaDMY, moneda, estadoPago, leerCompromisos, resumen,
} from '../../../supabase/functions/flujo-import/flujo';

describe('numeroPeru (formato peruano de las BD)', () => {
  it('lee millares con coma decimal', () => {
    expect(numeroPeru(' 184.121,00 ')).toBe(184121);
    expect(numeroPeru('5.822,00')).toBe(5822);
    expect(numeroPeru(' 4.631.194,00 ')).toBe(4631194);
  });
  it('cero y guion vacío', () => {
    expect(numeroPeru('0,00')).toBe(0);
    expect(numeroPeru(' -   ')).toBeNull();
    expect(numeroPeru('')).toBeNull();
  });
  it('decimales de "postergado"', () => {
    expect(numeroPeru('0,5')).toBe(0.5);
    expect(numeroPeru('2,5')).toBe(2.5);
    expect(numeroPeru('1')).toBe(1);
  });
});

describe('mesEspanol', () => {
  it('mmm-aa a primer día del mes', () => {
    expect(mesEspanol('mar-26')).toBe('2026-03-01');
    expect(mesEspanol('abr-26')).toBe('2026-04-01');
    expect(mesEspanol('ene-27')).toBe('2027-01-01');
  });
  it('mayúsculas y "set"', () => {
    expect(mesEspanol('SET-26')).toBe('2026-09-01');
    expect(mesEspanol('Dic-25')).toBe('2025-12-01');
  });
  it('vacío o basura → ""', () => {
    expect(mesEspanol('')).toBe('');
    expect(mesEspanol('no es mes')).toBe('');
  });
});

describe('fechaDMY', () => {
  it('dd/mm/aaaa a ISO', () => {
    expect(fechaDMY('19/03/2026')).toBe('2026-03-19');
    expect(fechaDMY('02/09/2026')).toBe('2026-09-02');
  });
  it('vacío → ""', () => {
    expect(fechaDMY('')).toBe('');
    expect(fechaDMY('PAGADO')).toBe('');
  });
});

describe('moneda y estado', () => {
  it('moneda', () => {
    expect(moneda('S/')).toBe('PEN');
    expect(moneda('US$')).toBe('USD');
    expect(moneda('')).toBe('PEN');
  });
  it('estado en mayúsculas', () => {
    expect(estadoPago(' PAGADO ')).toBe('PAGADO');
    expect(estadoPago('Pendiente')).toBe('PENDIENTE');
    expect(estadoPago('')).toBe('');
  });
});

// Cabecera real de BD CONTA (con "Columna2"/"Columna1" basura).
const CAB_CONTA = [
  'CDC', 'CONCEPTO', 'Columna2', 'CATEGORIA', 'PROVEEDOR', 'MONEDA', 'TC',
  'MES VENCIMIENTO', 'MONTO EJECUTADO', 'MONTO PRESUPUESTADO', 'MONTO PAGADO',
  'MES PAGADO', 'PAGADO/PENDIENTE', 'MES PROGRAMADO', 'POSTERGADO', 'MOMENTO',
  'OBSERVACIONES', 'Columna1',
];
const FILA_CONTA_1 = [
  ' RETENCION 3% ', 'RETENCIONES FEB2026', '', 'SUNAT', 'SUNAT', 'S/', '',
  'mar-26', ' 184.121,00 ', ' 184.121,00 ', ' 184.121,00 ',
  '19/03/2026', 'PAGADO', 'mar-26', '', 'En el mes de vencimiento', '', '',
];
const FILA_CONTA_2 = [
  ' IGV ', 'Pago Impuesto SUNAT IGV JUN2026', '', 'SUNAT', 'SUNAT', 'S/', '',
  'jul-26', ' -   ', ' -   ', '', '', 'PENDIENTE', 'sep-26', '2',
  'En el mes de vencimiento', '', '',
];

describe('leerCompromisos — mapea por nombre pese a Columna2', () => {
  const lineas = leerCompromisos([CAB_CONTA, FILA_CONTA_1, FILA_CONTA_2]);

  it('lee las dos filas', () => expect(lineas).toHaveLength(2));

  it('fila pagada: CDC recortado, montos y fecha', () => {
    const l = lineas[0];
    expect(l.cdc).toBe('RETENCION 3%');
    expect(l.concepto).toBe('RETENCIONES FEB2026');
    expect(l.categoria).toBe('SUNAT');
    expect(l.proveedor).toBe('SUNAT');
    expect(l.moneda).toBe('PEN');
    expect(l.mesVencimiento).toBe('2026-03-01');
    expect(l.montoPresupuestado).toBe(184121);
    expect(l.montoPagado).toBe(184121);
    expect(l.fechaPagado).toBe('2026-03-19');
    expect(l.estadoPago).toBe('PAGADO');
  });

  it('fila pendiente: sin pago, con postergado', () => {
    const l = lineas[1];
    expect(l.cdc).toBe('IGV');
    expect(l.estadoPago).toBe('PENDIENTE');
    expect(l.montoPagado).toBeNull();
    expect(l.mesProgramado).toBe('2026-09-01');
    expect(l.postergado).toBe(2);
  });
});

// BD TI: misma cabecera SIN "Columna2".
const CAB_TI = [
  'CDC', 'CONCEPTO', 'CATEGORIA', 'PROVEEDOR', 'MONEDA', 'TC', 'MES VENCIMIENTO',
  'MONTO EJECUTADO', 'MONTO PRESUPUESTADO', 'MONTO PAGADO', 'MES PAGADO',
  'PAGADO/PENDIENTE', 'MES PROGRAMADO', 'POSTERGADO', 'MOMENTO', 'OBSERVACIONES',
];
const FILA_TI = [
  'LICENCIAS', 'Microsoft 365', 'SOFTWARE', 'Microsoft', 'US$', '3,75', 'ago-26',
  '1.280,30', '1.152,30', '1.280,30', '20/08/2026', 'PAGADO', 'ago-26', '', '', '',
];

describe('leerCompromisos — BD TI (sin Columna2, con USD)', () => {
  const lineas = leerCompromisos([CAB_TI, FILA_TI]);
  it('mapea bien aunque cambie la posición', () => {
    const l = lineas[0];
    expect(l.cdc).toBe('LICENCIAS');
    expect(l.categoria).toBe('SOFTWARE');
    expect(l.proveedor).toBe('Microsoft');
    expect(l.moneda).toBe('USD');
    expect(l.tc).toBe(3.75);
    expect(l.montoPagado).toBe(1280.3);
    expect(l.fechaPagado).toBe('2026-08-20');
  });
});

describe('resumen', () => {
  it('suma pagado, presupuestado y pendiente', () => {
    const lineas = leerCompromisos([CAB_CONTA, FILA_CONTA_1, FILA_CONTA_2]);
    const r = resumen(lineas);
    expect(r.compromisos).toBe(2);
    expect(r.pagado).toBe(184121);
    expect(r.presupuestado).toBe(184121);
  });
});
