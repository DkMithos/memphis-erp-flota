import { describe, it, expect } from 'vitest';
import { htmlFormatoUnico } from './rendicion-formato';
import type { Pasajero, Rendicion, RendicionItem, Viaje } from './viajes';

const viaje = { numero: '003-MM-LOMM-2026', destino: 'CUSCO', fecha_salida: '2026-03-04', fecha_retorno: '2026-03-06', proyecto_codigo: '06CUSPNP25', proyecto_nombre: 'GORE CUSCO - PNP' } as Viaje;
const pasajero = { nombre: 'LISBET MONTEZA', dni: '12345678', cuenta_abono: null } as Pasajero;
const rend = { numero: 'RD-2026-0007', fecha: '2026-03-09', gastado: 1200, entregado: 900, saldo: 300, banco: 'BCP', cuenta: '191-123', cci: '002-191-000', moneda_reembolso: 'PEN', tope_excedido: false, justificacion: null } as Rendicion;
const items: RendicionItem[] = [
  { fecha: '2026-03-04', tipo_gasto: 'alimentacion', descripcion: 'Almuerzo', comprobante_tipo: 'boleta', comprobante_numero: 'B001-55', ruc: '20123456789', proveedor_nombre: 'Restaurante X', moneda: 'PEN', monto: 70, tc: null, sustentado: true, foto_path: null },
  { fecha: '2026-03-05', tipo_gasto: 'hospedaje', descripcion: 'Hotel', comprobante_tipo: 'factura', comprobante_numero: 'F001-9', ruc: '20999999999', proveedor_nombre: 'Hotel Y', moneda: 'USD', monto: 60, tc: 3.5, sustentado: true, foto_path: null },
  { fecha: '2026-03-05', tipo_gasto: 'movilidad', descripcion: 'Taxi al GORE', comprobante_tipo: 'sin_comprobante', comprobante_numero: null, ruc: null, proveedor_nombre: null, moneda: 'PEN', monto: 25, tc: null, sustentado: false, foto_path: null, lugar_origen: 'Hotel', lugar_destino: 'Gobierno Regional' },
];

describe('Formato Único de Reembolso y Liquidación (Anexo 2)', () => {
  const html = htmlFormatoUnico(viaje, pasajero, rend, items);
  it('lleva la cabecera y los datos bancarios del Excel de Administración', () => {
    for (const s of ['FORMATO ÚNICO DE REEMBOLSO Y LIQUIDACIÓN', 'NÚMERO:', '003-MM-LOMM-2026', 'LISBET MONTEZA', '12345678', 'BANCO A REEMBOLSAR', 'BCP', '191-123', '002-191-000', 'Soles']) expect(html).toContain(s);
  });
  it('separa soles y dólares en el detalle y totaliza como la hoja', () => {
    expect(html).toContain('IMPORTE TOTAL GASTADO');
    expect(html).toContain('<td class="n">70.00</td><td class="n"></td>');     // alimentación en soles
    expect(html).toContain('<td class="n"></td><td class="n">60.00</td>');     // hospedaje en dólares
    expect(html).toContain('DEPOSITADO POR EL EMPLEADOR');
    expect(html).toContain('TOTAL A DEVOLVER AL TRABAJADOR');
    expect(html).toContain('S/ 300.00');
  });
  it('la movilidad va en su propia planilla con origen y destino', () => {
    expect(html).toContain('PLANILLA POR GASTOS DE MOVILIDAD');
    expect(html).toContain('Gobierno Regional');
    expect(html).not.toContain('<td>Taxi al GORE</td><td class="n">25.00</td><td class="n"></td>'); // no se duplica en el detalle general
  });
  it('declaración, notas y firmas de la política', () => {
    for (const s of ['DECLARACIÓN DEL TRABAJADOR', 'NOTAS IMPORTANTES', 'FIRMA DEL TRABAJADOR', 'JEFE INMEDIATO / GERENCIA GENERAL', 'ADMINISTRACIÓN']) expect(html).toContain(s);
  });
  it('sin movilidad no imprime la segunda hoja', () => {
    expect(htmlFormatoUnico(viaje, pasajero, rend, items.slice(0, 2))).not.toContain('PLANILLA POR GASTOS DE MOVILIDAD');
  });
});
