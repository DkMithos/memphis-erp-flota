/**
 * El lector del Histórico de Movimientos de BBVA se prueba contra el archivo
 * real de Finanzas (BANCOS2026.xlsx) cuando está en el disco de Kevin; en CI, la
 * parte sintética basta.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { leerHojaBbva, fechaISO, numero } from './bancos-bbva';

const RUTA = String.raw`C:\Users\URSULA\AppData\Local\Temp\claude\C--Users-URSULA-Proyectos-memphis-erp-flota\8d33990c-93a6-418b-ae32-d99f46f984d7\scratchpad\gg\pagos\BANCOS2026.xlsx`;

describe('fechaISO / numero', () => {
  it('convierte los formatos que trae BBVA', () => {
    expect(fechaISO('02-09-2026')).toBe('2026-09-02');
    expect(fechaISO('2026-09-02 00:00:00')).toBe('2026-09-02');
    expect(fechaISO(new Date(Date.UTC(2026, 8, 2)))).toBe('2026-09-02');
    expect(fechaISO(46267)).toBe('2026-09-02');
    expect(numero('-1614937.5')).toBe(-1614937.5);
    expect(numero('1.614.937,50')).toBe(1614937.5);
    expect(numero('')).toBeNull();
  });
});

describe('leerHojaBbva (sintética)', () => {
  it('lee cuenta, moneda, movimientos y saldos', () => {
    const filas = [
      ['Histórico de Movimientos'], ['Periodo: de 01-09-2026 a 30-09-2026'], [], [], [], [],
      ['Cuenta Actual: 00110178160100101830 US'], ['Importes en: USD'], [], [], [], [],
      ['F. Operación', 'F. Valor', 'Código', 'Nº. Doc.', 'Concepto', 'Importe', 'Oficina'],
      [null, null, null, null, 'Saldo Inicial: 02-09-2026', 100],
      ['02-09-2026', '02-09-2026', '16', '0000002300', 'TRANSF.INTERBANCARIA.CCE 007', -70, '0102'],
      ['02-09-2026', '02-09-2026', '527', '0000002301', 'ITF', -0.5, '0437'],
      [null, null, null, null, 'Saldo Final: 02-09-2026', 29.5],
    ];
    const h = leerHojaBbva('x', filas);
    expect(h.numeroCuenta).toBe('00110178160100101830');
    expect(h.moneda).toBe('USD');
    expect(h.movimientos).toHaveLength(2);
    expect(h.movimientos[0].numero_doc).toBe('0000002300');
    expect(h.saldoInicial?.saldo).toBe(100);
    expect(h.saldos[0]).toEqual({ fecha: '2026-09-02', saldo: 29.5 });
    expect(h.avisos).toEqual([]);
  });
});

describe('leerHojaBbva (archivo real)', () => {
  it.skipIf(!existsSync(RUTA))('la hoja "806 202609 PEN" es en realidad la 830 en dólares y cuadra el saldo', async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(readFileSync(RUTA), { type: 'buffer', cellDates: true });
    const ws = wb.Sheets['806 202609 PEN'];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as (string | number | Date | null)[][];
    const h = leerHojaBbva('806 202609 PEN', filas);
    expect(h.numeroCuenta).toBe('00110178160100101830');
    expect(h.moneda).toBe('USD');
    expect(h.movimientos.length).toBeGreaterThan(100);
    expect(h.saldoInicial?.saldo).toBe(7103595.17);
    expect(h.saldos[h.saldos.length - 1].saldo).toBe(166837.81);
    expect(h.avisos).toEqual([]);
    // todas las hojas del libro se leen sin cabeceras perdidas
    for (const nombre of wb.SheetNames) {
      const f = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: null }) as (string | number | Date | null)[][];
      const hh = leerHojaBbva(nombre, f);
      expect(hh.numeroCuenta, nombre).toMatch(/^\d{20}$/);
      expect(hh.movimientos.length, nombre).toBeGreaterThan(0);
    }
  });
});
