/**
 * El parser del PRO-FOR-004 (formato de presupuesto de Operaciones), fijado
 * contra la estructura real de los 10 archivos de "General - PROYECTOS":
 * precios con IGV, dólares escondidos en la fórmula (`=37990*$C$7`), códigos
 * "01.02.03" con ".00" de grupo y códigos repetidos.
 *
 * Importa el archivo de la propia Edge Function: es el mismo código que corre en
 * producción.
 */
import { describe, it, expect } from 'vitest';
import {
  esProFor004, filaTabla, itemProFor004, referenciaCelda, origenDeDireccion, direccion,
  leerCabeceraProFor004, leerLineasProFor004,
} from '../../../supabase/functions/presupuesto-import/profor004';
import { totales } from '../../../supabase/functions/presupuesto-import/plantilla';

// Hoja como la devuelve Graph: `values` (números como números) y `formulas`
// (la fórmula si la hay; si no, el valor).
const valores: unknown[][] = [
  ['FORMATO DE PRESUPUESTO', '', ''],
  [],
  ['PROYECTO: ADQUISICIÓN DE AMBULANCIAS', '', ''],
  ['CUI: 2652192', '', ''],
  ['Costo de Ejecución del Proyecto', '', 36153270.35],
  ['Importe referencial', '', 40000000],
  ['Tasa de Cambio', '', 3.65, 'TC', 3.6],
  ['Plazo', '', '300 días'],
  ['PRESUPUESTO PLANIFICADO', '', '', '', '', '', '', '', 'PRESUPUESTO FINAL'],
  ['ITEM', 'DESCRIPCION', 'UNIDAD', 'CANTIDAD', 'PRECIO U. (S/)', 'PRECIO T. (S/)', 'Proveedor', 'Forma de Pago',
    'PRECIO U.', 'PRECIO T. (S/)', 'Proveedor', 'Forma de Pago'],
  ['01.00.00', 'EQUIPAMIENTO'],
  ['01.01.00', 'Ambulancias'],
  ['01.01.01', 'Ambulancia tipo II', 'UND', 10, 138663.5, 1386635, 'Toyota', 'CIPRL', 135000, 1350000, 'Toyota del Perú', 'CIPRL'],
  ['01.01.02', 'Camilla', 'UND', 10, 849.6, 8496, 'Medic', '30 días'],
  ['01.01.02', 'Camilla (repetida)', 'UND', 2, 100, 200],
  ['01.01.00', 'Ambulancias (grupo repetido)'],
  ['02.00.00', 'GASTOS GENERALES'],
  ['02.01.01', 'Supervisión', 'GLB', 1, 0, 0],
  ['', 'TOTAL', '', '', '', 1395331],
];
const formulas: unknown[][] = valores.map(f => [...f]);
formulas[12][4] = '=37990*$C$7';
formulas[12][5] = '=D13*E13';
formulas[12][8] = '=37500*$E$7';
formulas[13][4] = '=ROUND(720*1.18,2)';

describe('reconocer el formato', () => {
  it('la tabla es la fila ITEM | DESCRIPCION', () => {
    expect(filaTabla(valores)).toBe(9);
  });

  it('PRO-FOR-004 lleva PRECIO T. y Proveedor donde la plantilla-v1 lleva MONEDA', () => {
    expect(esProFor004(valores)).toBe(true);
    const v1 = [['ITEM', 'DESCRIPCION', 'UNIDAD', 'CANT', 'PRECIO U', 'MONEDA', 'P.U. SOLES', 'TOTAL SIN IGV']];
    expect(esProFor004(v1)).toBe(false);
  });
});

describe('los códigos "01.02.03"', () => {
  it('se canonizan sin ceros a la izquierda', () => {
    expect(itemProFor004('01.02.03')).toEqual({ item: '1.2.3', grupo: false });
  });

  it('".00" al final es un grupo y se recorta', () => {
    expect(itemProFor004('01.02.00')).toEqual({ item: '1.2', grupo: true });
    expect(itemProFor004('01.00.00')).toEqual({ item: '1', grupo: true });
  });

  it('el texto no es un ítem', () => {
    expect(itemProFor004('TOTAL')).toBeNull();
    expect(itemProFor004('')).toBeNull();
  });
});

describe('la moneda se lee en la fórmula', () => {
  it('referenciar la celda del TC, con o sin $, es dólares', () => {
    expect(referenciaCelda('=37990*$C$7', 'C7')).toBe(true);
    expect(referenciaCelda('=37990*C7', 'C7')).toBe(true);
  });

  it('C70 o AC7 no son C7', () => {
    expect(referenciaCelda('=100*C70', 'C7')).toBe(false);
    expect(referenciaCelda('=100*AC7', 'C7')).toBe(false);
  });

  it('un valor sin fórmula es soles', () => {
    expect(referenciaCelda(849.6, 'C7')).toBe(false);
    expect(referenciaCelda('=ROUND(720*1.18,2)', 'C7')).toBe(false);
  });
});

describe('el rango leído no siempre empieza en A1', () => {
  it('la dirección del usedRange da el desplazamiento', () => {
    expect(origenDeDireccion('Presu.!B3:M400')).toEqual({ fila: 2, col: 1 });
    expect(origenDeDireccion("'Presu. BASE'!A1:L300")).toEqual({ fila: 0, col: 0 });
    expect(origenDeDireccion(undefined)).toEqual({ fila: 0, col: 0 });
  });

  it('y la celda del TC se calcula con él', () => {
    expect(direccion(6, 2, { fila: 0, col: 0 })).toBe('C7');
    expect(direccion(6, 2, { fila: 2, col: 1 })).toBe('D9');
  });
});

describe('la cabecera', () => {
  const cab = leerCabeceraProFor004(valores);

  it('proyecto y CUI vienen pegados a la etiqueta', () => {
    expect(cab.proyecto).toBe('ADQUISICIÓN DE AMBULANCIAS');
    expect(cab.cui).toBe('2652192');
  });

  it('importes, plazo y los dos tipos de cambio con su celda', () => {
    expect(cab.importeEjecucion).toBe(36153270.35);
    expect(cab.importeReferencial).toBe(40000000);
    expect(cab.plazoDias).toBe(300);
    expect(cab.tipoCambio).toBe(3.65);
    expect(cab.celdaTc).toBe('C7');
    expect(cab.tipoCambioFinal).toBe(3.6);
    expect(cab.celdaTcFinal).toBe('E7');
  });

  it('un "TC" de 70 (SMARTBOM) es basura y se ignora', () => {
    const v = valores.map(f => [...f]);
    v[6] = ['Tasa de Cambio', '', 3.5, 'TC', 70];
    expect(leerCabeceraProFor004(v).tipoCambioFinal).toBeNull();
  });
});

describe('las partidas', () => {
  const cab = leerCabeceraProFor004(valores);
  const lineas = leerLineasProFor004(valores, formulas, cab);
  const por = (item: string) => lineas.find(l => l.item === item)!;

  it('grupos y hojas, sin el grupo repetido', () => {
    expect(lineas.map(l => l.item)).toEqual(['1', '1.1', '1.1.1', '1.1.2', '1.1.2#2', '2', '2.1.1']);
    expect(por('1').esHoja).toBe(false);
    expect(por('1.1.1').esHoja).toBe(true);
  });

  it('una línea en dólares: precio en US$, precio en soles y totales con y sin IGV', () => {
    const l = por('1.1.1');
    expect(l.moneda).toBe('USD');
    expect(l.precioUnitario).toBe(37990);
    expect(l.precioUnitarioSoles).toBe(138663.5);
    expect(l.totalConIgv).toBe(1386635);
    expect(l.totalSinIgv).toBe(1175114.41);
    expect(l.igvTasa).toBe(0.18);
    expect(l.proveedorNota).toBe('Toyota');
    expect(l.formaPago).toBe('CIPRL');
    expect(l.filaExcel).toBe(13);
  });

  it('el bloque FINAL con su propio TC', () => {
    const l = por('1.1.1');
    expect(l.monedaFinal).toBe('USD');
    expect(l.precioUnitarioFinal).toBe(37500);
    expect(l.totalFinal).toBe(1350000);
    expect(l.proveedorFinal).toBe('Toyota del Perú');
    expect(l.formaPagoFinal).toBe('CIPRL');
  });

  it('una línea en soles con el IGV metido en la fórmula', () => {
    const l = por('1.1.2');
    expect(l.moneda).toBe('PEN');
    expect(l.precioUnitario).toBe(849.6);
    expect(l.totalSinIgv).toBe(7200);
    expect(l.monedaFinal).toBe('');
    expect(l.precioUnitarioFinal).toBeNull();
  });

  it('la segunda hoja con el mismo código no se pisa: "#2"', () => {
    expect(por('1.1.2#2').descripcion).toBe('Camilla (repetida)');
    expect(por('1.1.2#2').nivel).toBe(3);
  });

  it('una partida a cero no es gasto', () => {
    expect(por('2.1.1').esHoja).toBe(false);
  });

  it('el total suma solo las hojas y cuadra con el TOTAL del Excel', () => {
    const t = totales(lineas);
    expect(t.hojas).toBe(3);
    expect(t.conIgv).toBe(1395331);
    expect(t.sinIgv).toBe(1182483.9);
  });

  it('con el rango desplazado, la fila del Excel se corrige', () => {
    const origen = { fila: 2, col: 0 };
    const c = leerCabeceraProFor004(valores, origen);
    expect(c.celdaTc).toBe('C9');
    const ls = leerLineasProFor004(valores, formulas.map(f => f.map(x => x === '=37990*$C$7' ? '=37990*$C$9' : x)), c, origen);
    expect(ls.find(l => l.item === '1.1.1')!.filaExcel).toBe(15);
    expect(ls.find(l => l.item === '1.1.1')!.moneda).toBe('USD');
  });
});
