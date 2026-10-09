import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { leerHojaSire, unirHojasSire } from './sire';

const RUTA = String.raw`C:\Users\URSULA\AppData\Local\Temp\claude\C--Users-URSULA-Proyectos-memphis-erp-flota\8d33990c-93a6-418b-ae32-d99f46f984d7\scratchpad\gg\fin\03_sire_compras_set.xlsx`;

describe('leerHojaSire', () => {
  it('ubica columnas por nombre aunque la cabecera no esté en la fila 1', () => {
    const filas = [
      ['REGISTRO DE COMPRAS'], [],
      ['Periodo', 'Fecha de emisión', 'Fecha Vcto/Pago', 'Tipo CP/Doc.', 'Serie del CDP', 'Año', 'Nro CP o Doc. Nro Inicial (Rango)', 'Nro Final (Rango)', 'Tipo Doc Identidad', 'Nro Doc Identidad', 'Apellidos Nombres/ Razón  Social', 'BI Gravado DG', 'IGV / IPM DG', 'BI Gravado DGNG', 'IGV / IPM DGNG', 'BI Gravado DNG', 'IGV / IPM DNG', 'Valor Adq. NG', 'ISC', 'ICBPER', 'Otros Trib/ Cargos', 'Total CP', 'M', 'Tipo de Cambio', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'Detracción', 'Tipo de Nota', 'Est. Comp.'],
      [202609, new Date(Date.UTC(2026, 8, 4)), null, 1, 'E001', null, 13, null, 6, 10438047994, 'SEGUNDO HUARAYA JUAN JOSE', 81.45, 8.55, 0, 0, 0, 0, 0, 0, 0, 0, 90, 'PEN', 1, null, null, null, null, null, null, null, null, null, null, 'D', null, 1],
    ];
    const r = leerHojaSire(filas);
    expect(r.avisos).toEqual([]);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({ periodo: '202609', fecha_emision: '2026-09-04', tipo: '01', serie: 'E001', numero: '13', ruc: '10438047994', total: 90, moneda: 'PEN', detraccion: 'D' });
  });

  it('acepta las variantes "Moneda", "T/C" y "D" que traen otros meses', () => {
    const filas = [
      ['Periodo', 'Fecha de emisión', 'Fecha Vcto/Pago', 'Tipo CP/Doc.', 'Serie del CDP', 'Nro CP o Doc. Nro Inicial (Rango)', 'Tipo Doc Identidad', 'Nro Doc Identidad', 'Apellidos Nombres/ Razón  Social', 'BI Gravado DG', 'IGV / IPM DG', 'Valor Adq. NG', 'Otros Trib/ Cargos', 'Total CP', 'Moneda', 'T/C', 'Fecha Emisión Doc Modificado', 'Tipo CP Modificado', 'Serie CP Modificado', 'Nro CP Modificado', 'D'],
      [202602, '2026-02-10', null, 1, 'F001', 120, 6, 20100000001, 'PROVEEDOR USD S.A.', 1000, 180, 0, 0, 1180, 'USD', 3.75, null, null, null, null, 'D'],
    ];
    const r = leerHojaSire(filas);
    expect(r.filas[0]).toMatchObject({ moneda: 'USD', tc: 3.75, detraccion: 'D', total: 1180, serie: 'F001', numero: '120' });
  });

  it('une las hojas de un libro sin repetir comprobantes', () => {
    const a = { periodo: '202602', fecha_emision: '2026-02-01', fecha_vencimiento: null, tipo: '01', serie: 'F001', numero: '7', ruc: '20100000001', razon_social: 'X', bi_gravada: 0, igv: 0, no_gravada: 0, total: 10, moneda: 'PEN', tc: null, detraccion: '', estado: '' };
    const r = unirHojasSire([
      { hoja: 'DECLARAR', filas: [a, { ...a, numero: '0008' }], avisos: [] },
      { hoja: 'SIRE', filas: [a, { ...a, numero: '8' }, { ...a, numero: '9' }], avisos: [] },
    ]);
    expect(r.hoja).toBe('SIRE + DECLARAR');
    expect(r.filas.map(f => f.numero)).toEqual(['7', '8', '9']);
  });

  it.skipIf(!existsSync(RUTA))('lee el SIRE real de setiembre 2026: 315 filas, 304 facturas y 11 notas de crédito', async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(readFileSync(RUTA), { type: 'buffer', cellDates: true });
    const filas = XLSX.utils.sheet_to_json(wb.Sheets['SIRE SET26'], { header: 1, raw: true, defval: null }) as (string | number | Date | null)[][];
    const r = leerHojaSire(filas);
    expect(r.avisos).toEqual([]);
    expect(r.filas.length).toBe(315);
    expect(r.filas.filter(f => f.tipo === '01').length).toBe(304);
    expect(r.filas.filter(f => f.tipo === '07').length).toBe(11);
    expect(r.filas.filter(f => f.detraccion === 'D').length).toBe(138);
    expect(Math.round(r.filas.reduce((s, f) => s + f.total, 0))).toBe(4171038);
  });
});
