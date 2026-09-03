/**
 * El PDF de la orden de compra.
 *
 * Esta función ya se rompió dos veces por lo mismo: campos que la plantilla
 * pide y el dato no llega, y una constante usada antes de declararse (el
 * bloque de firmas se construye antes que la plantilla). Las pruebas capturan
 * el HTML generado y comprueban el contenido, no solo que no reviente.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportOrdenPDF } from './export-utils';

let escrito = '';

beforeEach(() => {
  escrito = '';
  vi.stubGlobal('window', {
    location: { origin: 'https://erp.memphismaquinarias.com' },
    open: () => ({
      document: { write: (h: string) => { escrito += h; }, close: () => {} },
      focus: () => {},
      print: () => {},
    }),
  });
  vi.stubGlobal('setTimeout', ((fn: () => void) => { fn(); return 0; }) as any);
});

const ORDEN_BASE = {
  id: 'MM-001232',
  tipo: 'oc',
  estado: 'aprobada',
  moneda: 'USD',
  fechaEmision: '2026-08-26',
  requerimientoId: 'RQ-00238',
  cotizacionNumero: 'OP2608-313',
  centroCostoCodigo: 'SISTEMAS',
  centroCostoNombre: 'Sistemas',
  condiciones: 'Contado',
  lugarEntrega: 'Oficina Central',
  observaciones: 'UPGRADE MICROSOFT 365',
  subtotal: 92.47, impuestos: 16.64, total: 109.11,
  items: [{ descripcion: 'Licencia', cantidad: 1, unidad: 'Unid.', precioUnitario: 123.28, subtotal: 92.47 }],
  auditoria: { creadoPor: 'rnavarro@memphis.pe', creadoEn: '2026-08-26' },
};

describe('exportOrdenPDF', () => {
  it('no lanza y escribe el documento', () => {
    expect(() => exportOrdenPDF(ORDEN_BASE)).not.toThrow();
    expect(escrito).toContain('ORDEN DE COMPRA');
  });

  it('imprime los datos que antes salían en blanco', () => {
    exportOrdenPDF(ORDEN_BASE);
    expect(escrito).toContain('RQ-00238');        // requerimiento
    expect(escrito).toContain('OP2608-313');      // cotización
    expect(escrito).toContain('SISTEMAS');        // centro de costo
    expect(escrito).toContain('Contado');         // condición de pago (texto, no objeto)
    expect(escrito).toContain('Oficina Central'); // lugar de entrega
    expect(escrito).toContain('UPGRADE MICROSOFT 365');
  });

  it('acepta condiciones como objeto, para las órdenes antiguas', () => {
    exportOrdenPDF({ ...ORDEN_BASE, condiciones: { formaPago: '30 días', lugarEntrega: 'Almacén' } });
    expect(escrito).toContain('30 días');
  });

  it('estampa la firma donde consta la aprobación', () => {
    exportOrdenPDF({
      ...ORDEN_BASE,
      aprobaciones: [{
        etapa: 'comprador',
        aprobadoPorNombre: 'Richard Navarro',
        aprobadoEn: '2026-08-26',
        firma: 'data:image/png;base64,AAAA',
      }],
    });
    expect(escrito).toContain('data:image/png;base64,AAAA');
    expect(escrito).toContain('Richard Navarro');
    expect(escrito).toContain('Elaborado por');
  });

  it('pone la constancia en las órdenes del Excel 2024, no columnas vacías', () => {
    exportOrdenPDF({ ...ORDEN_BASE, migradoDe: 'oc-excel-2024', aprobaciones: [] });
    expect(escrito).toContain('DOCUMENTO HISTÓRICO');
    expect(escrito).toContain('firmó en');
    expect(escrito).not.toContain('data:image/png');
  });

  it('no inventa firmas cuando no hay aprobaciones ni origen histórico', () => {
    exportOrdenPDF({ ...ORDEN_BASE, aprobaciones: [] });
    expect(escrito).toContain('Elaborado por');
    expect(escrito).toContain('Aprobado por');
    expect(escrito).not.toContain('data:image/png');
    expect(escrito).not.toContain('DOCUMENTO HISTÓRICO');
  });

  it('rotula cada aprobador del ERP por separado', () => {
    exportOrdenPDF({
      ...ORDEN_BASE,
      aprobaciones: [
        { etapa: 'aprobador:a@memphis.pe', aprobadoPorNombre: 'Ana', aprobadoEn: '2026-08-26' },
        { etapa: 'aprobador:b@memphis.pe', aprobadoPorNombre: 'Beto', aprobadoEn: '2026-08-27' },
      ],
    });
    expect(escrito).toContain('Ana');
    expect(escrito).toContain('Beto');
    expect(escrito.match(/Aprobado por/g)?.length).toBe(2);
  });
});
