import { describe, it, expect } from 'vitest';
// Se prueba el MISMO módulo que corre en la Edge Function.
import {
  numeroPeru, mesEspanol, mesDeFecha, fechaISO, fechaDMY, moneda, estadoPago,
  leerCompromisos, leerProyectos, leerAdministracion, resumen,
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
  it('importes de Proyectos con 3 decimales (coma decimal peruana)', () => {
    expect(numeroPeru('43152,256')).toBe(43152.256);
    expect(numeroPeru('1048524,276')).toBe(1048524.276);
    expect(numeroPeru('12.691,84')).toBe(12691.84);
    expect(numeroPeru('275965,5')).toBe(275965.5);
    expect(numeroPeru('5242620')).toBe(5242620);
  });
  it('punto suelto: millar si son 3 cifras, decimal si 1–2', () => {
    expect(numeroPeru('12.691')).toBe(12691);      // millar peruano
    expect(numeroPeru('1.048.524')).toBe(1048524);
    expect(numeroPeru('4728.02')).toBe(4728.02);   // decimal gringo suelto
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
  it('nombre completo del mes (Proyectos) por sus 3 primeras letras', () => {
    expect(mesEspanol('Octubre-25')).toBe('2025-10-01');
    expect(mesEspanol('Setiembre-25')).toBe('2025-09-01');
    expect(mesEspanol('Enero-27')).toBe('2027-01-01');
  });
  it('vacío o basura → ""', () => {
    expect(mesEspanol('')).toBe('');
    expect(mesEspanol('no es mes')).toBe('');
  });
});

describe('mesDeFecha', () => {
  it('de una fecha dd/mm/aaaa o ISO al primer día del mes', () => {
    expect(mesDeFecha('15/10/2025')).toBe('2025-10-01');
    expect(mesDeFecha('2026-03-19')).toBe('2026-03-01');
    expect(mesDeFecha('')).toBe('');
  });
});

describe('fechaISO', () => {
  it('acepta dd/mm/aaaa y también fecha ya-ISO (BD ADMIN)', () => {
    expect(fechaISO('29/10/2025')).toBe('2025-10-29');
    expect(fechaISO('2025-10-29 00:00:00')).toBe('2025-10-29');
    expect(fechaISO('')).toBe('');
  });
});

// BD ADMIN: tabla plana con la cabecera común, pero las fechas pueden venir
// como fecha (no "ago-25"). El parser común debe leerlas igual.
describe('leerCompromisos — BD ADMIN con fechas y pagado/pendiente', () => {
  const CAB = [
    'CDC', 'CONCEPTO', 'CATEGORIA', 'PROVEEDOR', 'MONEDA', 'TC', 'MES VENCIMIENTO',
    'MONTO EJECUTADO', 'MONTO PRESUPUESTADO', 'DETRACCIÓN', 'RETENCIÓN', 'MONTO PAGADO',
    'MES PAGADO', 'PAGADO/PENDIENTE', 'MES PROGRAMADO', 'POSTERGADO', 'MOMENTO', 'OBSERVACIONES',
  ];
  const FILA = [
    'ALQUILER DE SOCIOS', 'Alquiler de Vivienda', 'Alquiler', 'Inmobiliaria Golf', '$', '3,4',
    '2025-08-01', '8.072,25', '8.072,25', '0,1', '-', '7.290,25',
    '2025-10-29', 'PAGADO', '2025-08-01', '0', 'Puede esperar', 'E001-317',
  ];
  const l = leerCompromisos([CAB, FILA])[0];
  it('lee el mes de vencimiento aunque venga como fecha', () => {
    expect(l.mesVencimiento).toBe('2025-08-01');
  });
  it('lee la moneda, el pagado y el estado', () => {
    expect(l.moneda).toBe('USD');
    expect(l.montoPagado).toBe(7290.25);
    expect(l.estadoPago).toBe('PAGADO');
    expect(l.fechaPagado).toBe('2025-10-29');
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
    expect(moneda('$')).toBe('USD');       // Proyectos usa "$" a secas
    expect(moneda('Soles')).toBe('PEN');
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

// Flujo de proyectos: hoja plana "BASE DE DATOS" con cabecera propia.
const CAB_PROY = [
  'CÓDIGO', 'CDC', 'CATEGORIA', 'CONCEPTO', 'PROVEEDOR', 'CANTIDAD', 'MONEDA', 'PU', 'TOTAL', 'TC',
  'METODO DE PAGO', 'FECHA INICIO', 'DIAS DE CREDITO', 'FECHA DE VENCIMIENTO', 'MES DE VENCIMIENTO',
  'TOTAL SOLES', 'PRESUPUESTADO', 'MES DE PROGRAMACION', 'POSTERGADO', 'PAGADO', 'FECHA DE PAGO',
  'MONTO PAGADO', 'OC', 'FACTURA',
];
const FILA_PROY = [
  '01.01.01.353', 'GHUANUCOPNP', 'SEGUROS', 'CUOTA 3 Poliza 3D', 'RIMAC', '1', '$', '5869', '5869', '3,45',
  'CREDITO', '15/09/2025', '30', '15/10/2025', 'Octubre-25', '20248,05', '0', '', '4', 'PENDIENTE', '', '', '', '',
];

describe('leerProyectos — cabecera propia, monto = TOTAL SOLES, mes de la fecha', () => {
  const l = leerProyectos([CAB_PROY, FILA_PROY])[0];
  it('mapea la fila real', () => {
    expect(l.cdc).toBe('GHUANUCOPNP');
    expect(l.concepto).toBe('CUOTA 3 Poliza 3D');
    expect(l.categoria).toBe('SEGUROS');
    expect(l.proveedor).toBe('RIMAC');
    expect(l.moneda).toBe('USD');
    expect(l.tc).toBe(3.45);
    expect(l.mesVencimiento).toBe('2025-10-01');   // de FECHA DE VENCIMIENTO 15/10/2025
    expect(l.montoPresupuestado).toBe(20248.05);   // TOTAL SOLES
    expect(l.estadoPago).toBe('PENDIENTE');
    expect(l.postergado).toBe(4);
  });
});

// Flujo Administración: matriz por meses.
const CAB_ADMIN = ['CDC', 'CONCEPTO', 'CATEGORIA', 'Deuda Vencida', 'Ago-25', 'Set-25', 'Oct-25'];
const FILAS_ADMIN = [
  [' OFCENTRAL ', 'Alquiler de Oficina', 'Oficina gastos básico', '', '', ' 10.402,50 ', ' 10.402,50 '],
  [' OFCENTRAL ', 'Mantenimiento Oficina', 'Oficina gastos básico', ' 3.026,38 ', ' 2.396,15 ', '', ''],
  ['', 'GASTOS OFICINA', '', '', '', '', ''],   // fila de sección: sin montos
];

describe('leerAdministracion — desdobla la matriz por meses', () => {
  const lineas = leerAdministracion([CAB_ADMIN, ...FILAS_ADMIN]);

  it('cada celda con monto es un compromiso de ese mes', () => {
    const alq = lineas.filter(l => l.concepto === 'Alquiler de Oficina');
    expect(alq.map(l => [l.mesVencimiento, l.montoPresupuestado])).toEqual([
      ['2025-09-01', 10402.5], ['2025-10-01', 10402.5],
    ]);
    expect(alq[0].cdc).toBe('OFCENTRAL');
    expect(alq[0].categoria).toBe('Oficina gastos básico');
  });

  it('la deuda vencida es un compromiso vencido sin mes', () => {
    const mant = lineas.filter(l => l.concepto === 'Mantenimiento Oficina');
    const deuda = mant.find(l => l.estadoPago === 'VENCIDO')!;
    expect(deuda.montoPresupuestado).toBe(3026.38);
    expect(deuda.mesVencimiento).toBe('');
    expect(deuda.observaciones).toBe('Deuda vencida');
    // y su mes de agosto
    expect(mant.some(l => l.mesVencimiento === '2025-08-01' && l.montoPresupuestado === 2396.15)).toBe(true);
  });

  it('las filas de sección no generan nada', () => {
    expect(lineas.some(l => l.concepto === 'GASTOS OFICINA')).toBe(false);
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
