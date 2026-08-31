/**
 * El Excel de caja chica en el modelo de Administración.
 *
 * Lo que se protege: que los importes lleguen como NÚMERO y las fechas como
 * FECHA. Antes este export generaba un HTML renombrado a .xls, y los montos
 * salían como texto ("S/ 1,234.56"), así que no se podían sumar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const escrito: { wb: any; nombre: string }[] = [];

vi.mock('xlsx', async () => {
  const real: any = await vi.importActual('xlsx');
  return {
    ...real,
    utils: real.utils,
    writeFile: (wb: any, nombre: string) => { escrito.push({ wb, nombre }); },
  };
});

import { exportCajaModeloExcel } from './export-utils';

const CAJA = { nombre: 'CAJA 1 SOLES', codigo: 'CC-001', responsable: 'Carolina Okamura', moneda: 'PEN' };

describe('exportCajaModeloExcel — modelo de Administración', () => {
  beforeEach(() => { escrito.length = 0; });

  it('escribe los importes como número y las fechas como fecha', async () => {
    await exportCajaModeloExcel(CAJA, [
      { item: 1, centroCosto: 'ADMI001', tipoDoc: 'FACTURA', comprobante: 'F001-0034292',
        razonSocial: 'PROVISIONES TECNOLOGICAS', descripcion: 'Toner', ingreso: null,
        egreso: 481.75, fecha: '2026-08-14' },
    ]);

    expect(escrito).toHaveLength(1);
    const { wb, nombre } = escrito[0];
    expect(nombre).toBe('CAJA_1_SOLES_CC-001.xlsx');

    const ws = wb.Sheets['Caja Chica'];
    // Fila 8 (1-based) = primer movimiento: H egreso, I fecha
    expect(ws.H8.t).toBe('n');
    expect(ws.H8.v).toBe(481.75);
    expect(ws.H8.z).toBe('"S/" #,##0.00');
    expect(ws.I8.t).toBe('d');

    // El comprobante y el ITEM son códigos: texto
    expect(ws.D8.t).toBe('s');
    expect(ws.A8.t).toBe('s');
  });

  it('cuadra los totales y el saldo', async () => {
    await exportCajaModeloExcel(CAJA, [
      { item: 1, ingreso: 1000, egreso: null, fecha: '2026-08-01' },
      { item: 2, ingreso: null, egreso: 250.5, fecha: '2026-08-02' },
      { item: 3, ingreso: null, egreso: 100.25, fecha: '2026-08-03' },
    ]);
    const ws = escrito[0].wb.Sheets['Caja Chica'];
    expect(ws.H3.v).toBe(1000);      // Ingresos
    expect(ws.H4.v).toBe(350.75);    // Gastos
    expect(ws.H5.v).toBe(649.25);    // Saldo Final
    // Fila de totales, después de los 3 movimientos (filas 8,9,10) → fila 11
    expect(ws.G11.v).toBe(1000);
    expect(ws.H11.v).toBe(350.75);
  });

  it('usa el símbolo y la leyenda de dólares cuando la caja es USD', async () => {
    await exportCajaModeloExcel({ ...CAJA, moneda: 'USD' }, [
      { item: 1, ingreso: null, egreso: 20, fecha: '2026-08-01' },
    ]);
    const ws = escrito[0].wb.Sheets['Caja Chica'];
    expect(ws.A3.v).toBe('(Expresado en Dólares)');
    expect(ws.H8.z).toBe('"$" #,##0.00');
    expect(ws.H7.v).toBe('EGRESO USD');
  });
});
