/**
 * El parser de la plantilla presupuestal de Antonio, fijado contra filas REALES
 * de PLANTILLA PRESUPUESTAL - NUEVA.xlsx (GORE LORETO BOMBEROS, CUI 2652192).
 *
 * Importa el archivo de la propia Edge Function: es el mismo código que corre en
 * producción.
 */
import { describe, it, expect } from 'vitest';
import {
  numeroPeru, itemCanonico, nivelDeItem, tasaIgv,
  leerCabecera, leerLineas, totales,
} from '../../../supabase/functions/presupuesto-import/plantilla';

// Fila del Excel = celdas separadas por tab. Se pasan como arrays.
const F = (...c: string[]) => c;

describe('el item mezcla comas y puntos', () => {
  it('la coma del nivel 2 es un decimal disfrazado: "1,1" es 1.1', () => {
    expect(itemCanonico('1,1')).toBe('1.1');
    expect(nivelDeItem(itemCanonico('1,1'))).toBe(2);
  });

  it('los niveles profundos ya vienen con puntos', () => {
    expect(itemCanonico('2.1.4.2')).toBe('2.1.4.2');
    expect(nivelDeItem('2.1.4.2')).toBe(4);
  });

  it('nivel 1 es un solo número', () => {
    expect(nivelDeItem(itemCanonico('1'))).toBe(1);
  });

  it('un texto suelto no es un item', () => {
    expect(itemCanonico('PRESUPUESTO PLANIFICADO')).toBe('');
    expect(itemCanonico('')).toBe('');
  });
});

describe('números y tasas de la plantilla', () => {
  it('lee el formato peruano', () => {
    expect(numeroPeru('58.633,80')).toBe(58633.8);
    expect(numeroPeru('8.443.266,88')).toBe(8443266.88);
    expect(numeroPeru(' 10.382,20 ')).toBe(10382.2);
  });

  it('el 0,00 es cero, la celda vacía es nada', () => {
    expect(numeroPeru('0,00')).toBe(0);
    expect(numeroPeru('')).toBeNull();
  });

  it('"18%" es 0,18', () => {
    expect(tasaIgv('18%')).toBe(0.18);
    expect(tasaIgv('')).toBeNull();
  });
});

describe('cabecera', () => {
  const CAB = [
    F('', 'FORMATO DE PRESUPUESTO'),
    F(''),
    F('PROYECTO:ADQUISICIÓN DE VEHÍCULO ... DEPARTAMENTO LORETO', '', '', 'Soles'),
    F('CUI: 2652192', '', '', 'US$'),
    F('Importes del Convenio de Inversión'),
    F('Ejecución del Proyecto', '', 'S/ 43.835.818,59'),
    F('Importe Referencial Total de INVERSION', '', 'S/ 43.900.818,64'),
    F('Tasa de Cambio:', '', '3,70'),
    F('Plazo de Ejecución:', '', '300 días'),
  ];

  it('saca proyecto, CUI, importes, TC y plazo por etiqueta, no por fila fija', () => {
    const c = leerCabecera(CAB);
    expect(c.proyecto).toContain('ADQUISICIÓN DE VEHÍCULO');
    expect(c.cui).toBe('2652192');
    expect(c.importeEjecucion).toBe(43835818.59);
    expect(c.importeReferencial).toBe(43900818.64);
    expect(c.tipoCambio).toBe(3.7);
    expect(c.plazoDias).toBe(300);
  });

  it('el valor pegado en la misma celda ("CUI: 2652192") también se lee', () => {
    expect(leerCabecera([F('CUI: 2652192')]).cui).toBe('2652192');
  });
});

describe('líneas de partida', () => {
  const HOJA = [
    F('ITEM', 'DESCRIPCION', 'UNDIDAD', 'CANTIDAD', 'PRECIO U.', 'Tipo Moneda',
      'PRECIO U. (S/)', 'PRECIO T. (S/)', 'Impuesto', 'TOTA Inc. IGV', 'PROVEEDOR /NOTAS'),
    // nivel 1: agregado (NO es hoja — sumaría doble)
    F('1', 'EQUIPO DE PROTECCIÓN PERSONAL', '', '144', '', '', '58.633,80', '8.443.266,88', '', '9.963.054,92', ''),
    // nivel 2: cabecera de grupo (solo nombre)
    F('1,1', 'Uniforme de bombero estructurales'),
    // nivel 3: hoja real en soles
    F('1.1.1', 'Chaquetón, Capote Y Pantalón', ' Und ', '144,00', ' 10.382,20 ', 'Soles',
      ' 10.382,20 ', '1.495.036,80', '18%', ' 1.764.143,42 ', 'FIRE TEAM PERÚ E.I.R.L'),
    // nivel 3: hoja real en dólares
    F('1.2.1', 'Camisa y Pantalón', ' Und ', '96,00', '517,62', 'US$',
      ' 1.915,20 ', '183.859,20', '18%', ' 216.953,86 ', 'KPN'),
    F(''),  // separación en blanco
  ];

  it('la partida de nivel 1 NO es hoja: su total es agregado y duplicaría', () => {
    const l = leerLineas(HOJA).find(x => x.item === '1')!;
    expect(l.esHoja).toBe(false);
    expect(l.nivel).toBe(1);
  });

  it('la cabecera de grupo (1.1) tampoco es hoja', () => {
    const l = leerLineas(HOJA).find(x => x.item === '1.1')!;
    expect(l.esHoja).toBe(false);
  });

  it('la línea con unidad y total SÍ es hoja, con su moneda y proveedor', () => {
    const l = leerLineas(HOJA).find(x => x.item === '1.1.1')!;
    expect(l.esHoja).toBe(true);
    expect(l.unidad).toBe('Und');
    expect(l.cantidad).toBe(144);
    expect(l.moneda).toBe('PEN');
    expect(l.totalSinIgv).toBe(1495036.8);
    expect(l.igvTasa).toBe(0.18);
    expect(l.proveedorNota).toBe('FIRE TEAM PERÚ E.I.R.L');
  });

  it('reconoce la moneda dólares', () => {
    expect(leerLineas(HOJA).find(x => x.item === '1.2.1')!.moneda).toBe('USD');
  });

  it('el total suma SOLO las hojas, nunca los agregados', () => {
    const t = totales(leerLineas(HOJA));
    // Solo 1.1.1 (1.495.036,80) + 1.2.1 (183.859,20) = 1.678.896,00
    expect(t.hojas).toBe(2);
    expect(t.sinIgv).toBe(1678896);
  });

  it('las filas en blanco no cuentan como líneas', () => {
    expect(leerLineas(HOJA).some(l => l.item === '')).toBe(false);
  });
});
