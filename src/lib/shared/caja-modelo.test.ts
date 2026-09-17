/**
 * El Excel de caja chica en el modelo de Administración.
 *
 * Se arma el libro con exceljs y se inspeccionan las celdas: valores como
 * NÚMERO y FECHA (para que Excel sume), la numeración de ítems, los colores del
 * modelo, y los totales como fórmula con resultado. Al final se escribe a
 * buffer y se vuelve a leer, para asegurar que el archivo es válido.
 */
import { describe, it, expect } from 'vitest';
import { construirLibroCajaModelo } from './export-utils';
import { prepararCajaModelo } from '../finanzas/caja-modelo';

const CAJA = { nombre: 'CAJA 26 SOLES', codigo: 'ADMI026-SOLES', responsable: 'CAROLINA OKAMURA', moneda: 'PEN' };
const T = '2026-09-11T20:11:22Z';

const modelo26 = prepararCajaModelo(
  [
    { numero: '1', tipo: 'saldo_anterior', monto: -125.49, fecha: '2026-09-11', origen: 'CAJA 25 SOLES',
      descripcion: 'DEUDA DE CAJA CHICA ANTERIOR (CAJA 25 SOLES)', creado_en: T },
    { numero: '2', tipo: 'reposicion', monto: 9500, fecha: '2026-09-11', origen: 'DEPÓSITO',
      descripcion: 'APERTURA DE CAJA', creado_en: T },
  ],
  [
    { numero: 'GCC-2026-002', monto: 10, fecha: '2026-09-04', categoria: 'FACTURA', beneficiario: 'LA PERLA',
      comprobante_numero: 'FE13-00000345', centro_costo: 'GHUANUCOPNP', descripcion: 'ENVIO DE DOCUMENTOS', creado_en: T },
    { numero: 'GCC-2026-001', monto: 27, fecha: '2026-09-02', categoria: 'FACTURA', beneficiario: 'TARAPOTO COURIER SAC',
      comprobante_numero: 'FF01-00039302', centro_costo: 'GLOREBOMBE', descripcion: 'ENVIO DE DOCUMENTOS', creado_en: T },
  ],
);

describe('construirLibroCajaModelo — modelo de Administración', () => {
  it('nombra la hoja como la caja y pone los títulos en negrita', async () => {
    const wb = await construirLibroCajaModelo(CAJA, modelo26);
    const ws = wb.getWorksheet('CAJA 26 SOLES')!;
    expect(ws).toBeDefined();
    expect(ws.getCell('A1').value).toBe('MEMPHIS MAQUINARIAS SAC');
    expect(ws.getCell('A1').font?.bold).toBe(true);
    expect(ws.getCell('A3').value).toBe('(Expresado en Soles)');
    expect(ws.getCell('A4').value).toBe('N° DE CAJA: ADMI026-SOLES');
    expect(ws.getCell('A5').value).toBe('RESPONSABLE: CAROLINA OKAMURA');
  });

  it('numera los ítems y escribe importes como número y fechas como fecha', async () => {
    const wb = await construirLibroCajaModelo(CAJA, modelo26);
    const ws = wb.getWorksheet('CAJA 26 SOLES')!;
    // Fila 8: ítem 1 = saldo anterior; fila 9: apertura; 10 y 11: gastos por correlativo
    expect(ws.getCell('A8').value).toBe(1);
    expect(ws.getCell('A9').value).toBe(2);
    expect(ws.getCell('A10').value).toBe(3);
    expect(ws.getCell('A11').value).toBe(4);
    expect(ws.getCell('F8').value).toBe('DEUDA DE CAJA CHICA ANTERIOR (CAJA 25 SOLES)');
    expect(ws.getCell('G8').value).toBe(-125.49);
    expect(ws.getCell('F9').value).toBe('APERTURA DE CAJA');
    expect(ws.getCell('G9').value).toBe(9500);
    expect(ws.getCell('E10').value).toBe('TARAPOTO COURIER SAC');   // GCC-001 antes que GCC-002
    expect(ws.getCell('H10').value).toBe(27);
    expect(ws.getCell('H10').numFmt).toBe('"S/" #,##0.00');
    expect(ws.getCell('D10').value).toBe('FF01-00039302');           // comprobante como texto
    expect(ws.getCell('I10').value).toBeInstanceOf(Date);
    expect(ws.getCell('I10').numFmt).toBe('dd/mm/yyyy');
  });

  it('conserva los colores del modelo', async () => {
    const wb = await construirLibroCajaModelo(CAJA, modelo26);
    const ws = wb.getWorksheet('CAJA 26 SOLES')!;
    const argb = (ref: string) => (ws.getCell(ref).fill as { fgColor?: { argb?: string } })?.fgColor?.argb;
    expect(argb('A7')).toBe('FFC6E0B4');      // cabecera verde claro
    expect(argb('G2')).toBe('FFE7E6E6');      // saldo inicial gris
    expect(argb('H5')).toBe('FF9BC2E6');      // saldo final azul
    expect(ws.getCell('H5').font?.bold).toBe(true);
    // Fila Total = 8 + 4 filas = 12
    expect(ws.getCell('A12').value).toBe('Total');
    expect(argb('A12')).toBe('FF375623');
    expect(ws.getCell('A12').font?.color?.argb).toBe('FFFFFFFF');
    expect(ws.getCell('A8').border?.top?.style).toBe('thin');
  });

  it('el recuadro de saldos sigue las reglas: inicial 0 con deuda, cierre = inicial + ingresos − gastos', async () => {
    const wb = await construirLibroCajaModelo(CAJA, modelo26);
    const ws = wb.getWorksheet('CAJA 26 SOLES')!;
    expect(ws.getCell('H2').value).toBe(0);                            // deuda → saldo inicial 0
    expect(ws.getCell('G12').value).toEqual({ formula: 'SUM(G8:G11)', result: 9374.51 });
    expect(ws.getCell('H12').value).toEqual({ formula: 'SUM(H8:H11)', result: 37 });
    expect(ws.getCell('H3').value).toEqual({ formula: 'G12-H2', result: 9374.51 });
    expect(ws.getCell('H4').value).toEqual({ formula: 'H12', result: 37 });
    expect(ws.getCell('H5').value).toEqual({ formula: 'H2+H3-H4', result: 9337.51 });
    // Pie de firma, dos filas debajo del total
    expect(ws.getCell('B15').value).toBe('FIRMA DEL RESPONSABLE');
    expect(ws.getCell('B16').value).toBe('NOMBRE: CAROLINA OKAMURA');
    expect(ws.getCell('B17').value).toBe('CARGO:');
  });

  it('con saldo a favor, el saldo inicial es ese importe y no se cuenta dos veces', async () => {
    const modelo = prepararCajaModelo(
      [
        { numero: '1', tipo: 'saldo_anterior', monto: 95.78, fecha: '2026-09-04', origen: 'CAJA 24 SOLES',
          descripcion: 'SALDO A FAVOR DE CAJA CHICA ANTERIOR (CAJA 24 SOLES)', creado_en: '2026-09-08T19:25:25Z' },
        { numero: '2', tipo: 'reposicion', monto: 10000, fecha: '2026-09-07', descripcion: 'CAJA CHICA APERTURA', creado_en: '2026-09-09T15:31:32Z' },
      ],
      [{ numero: '1', monto: 100, fecha: '2026-09-09', creado_en: '2026-09-09T16:00:00Z' }],
    );
    const wb = await construirLibroCajaModelo({ ...CAJA, nombre: 'CAJA 25 SOLES' }, modelo);
    const ws = wb.getWorksheet('CAJA 25 SOLES')!;
    expect(ws.getCell('H2').value).toBe(95.78);
    expect(ws.getCell('G11').value).toEqual({ formula: 'SUM(G8:G10)', result: 10095.78 });
    expect(ws.getCell('H3').value).toEqual({ formula: 'G11-H2', result: 10000 });
    expect(ws.getCell('H5').value).toEqual({ formula: 'H2+H3-H4', result: 9995.78 });
  });

  it('usa el símbolo y la leyenda de dólares cuando la caja es USD', async () => {
    const modelo = prepararCajaModelo([], [{ numero: '1', monto: 20, fecha: '2026-08-01' }]);
    const wb = await construirLibroCajaModelo({ ...CAJA, nombre: 'CAJA 1 DÓLARES', moneda: 'USD' }, modelo);
    const ws = wb.getWorksheet('CAJA 1 DÓLARES')!;
    expect(ws.getCell('A3').value).toBe('(Expresado en Dólares)');
    expect(ws.getCell('H7').value).toBe('Egreso USD');
    expect(ws.getCell('H8').numFmt).toBe('"$" #,##0.00');
  });

  it('el archivo se escribe y se vuelve a leer sin perder valores', async () => {
    const wb = await construirLibroCajaModelo(CAJA, modelo26);
    const buffer = await wb.xlsx.writeBuffer();
    const { Workbook } = await import('exceljs');
    const leido = new Workbook();
    await leido.xlsx.load(buffer as ArrayBuffer);
    const ws = leido.getWorksheet('CAJA 26 SOLES')!;
    expect(ws.getCell('A8').value).toBe(1);
    expect(ws.getCell('G9').value).toBe(9500);
    expect((ws.getCell('H5').value as { result?: number }).result).toBe(9337.51);
  });
});
