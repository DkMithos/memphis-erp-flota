import { describe, it, expect } from 'vitest';
import {
  acumular, agrupar, totales, nombreMes, paraExportar, fuentesPermitidas,
  type Movimiento,
} from './cruzado';

const mov = (p: Partial<Movimiento>): Movimiento => ({
  fuente: 'orden_compra', flujo: 'egreso', id: crypto.randomUUID(), numero: 'MM-000001',
  fecha: '2026-09-01', mes: '2026-09', estado: 'aprobada', moneda: 'PEN', monto: 100,
  proyectoId: null, proyecto: null, centroCostoId: null, centroCosto: null,
  enCatalogo: true, contraparte: null, descripcion: null,
  ...p,
});

describe('las monedas no se mezclan', () => {
  it('acumula cada una por su lado', () => {
    let x = { pen: 0, usd: 0 };
    x = acumular(x, 'PEN', 100);
    x = acumular(x, 'USD', 50);
    x = acumular(x, 'PEN', 25);
    expect(x).toEqual({ pen: 125, usd: 50 });
  });

  it('un grupo con soles y dólares los reporta separados, no sumados', () => {
    const [fila] = agrupar([
      mov({ moneda: 'PEN', monto: 1000, proyectoId: 'p1', proyecto: 'GORE Ica' }),
      mov({ moneda: 'USD', monto: 400, proyectoId: 'p1', proyecto: 'GORE Ica' }),
    ], 'proyecto');

    expect(fila.egreso).toEqual({ pen: 1000, usd: 400 });
    expect(fila.movimientos).toBe(2);
  });
});

describe('agrupar', () => {
  it('separa egresos de ingresos', () => {
    const [fila] = agrupar([
      mov({ flujo: 'egreso', monto: 300, centroCosto: 'OFCENTRAL' }),
      mov({ flujo: 'ingreso', fuente: 'ingreso_caja', monto: 500, centroCosto: 'OFCENTRAL' }),
    ], 'centroCosto');

    expect(fila.egreso.pen).toBe(300);
    expect(fila.ingreso.pen).toBe(500);
  });

  it('lo que nadie imputó cae en una fila propia, no se reparte', () => {
    const filas = agrupar([
      mov({ proyectoId: 'p1', proyecto: 'GORE Ica', monto: 100 }),
      mov({ proyectoId: null, monto: 900 }),
    ], 'proyecto');

    const sin = filas.find(f => f.clave === '__sin__');
    expect(sin?.etiqueta).toBe('Sin proyecto asignado');
    expect(sin?.egreso.pen).toBe(900);
  });

  it('ordena por egreso descendente', () => {
    const filas = agrupar([
      mov({ proyectoId: 'chico', proyecto: 'Chico', monto: 10 }),
      mov({ proyectoId: 'grande', proyecto: 'Grande', monto: 900 }),
    ], 'proyecto');

    expect(filas.map(f => f.etiqueta)).toEqual(['Grande', 'Chico']);
  });

  it('por mes va cronológico aunque el importe diga otra cosa', () => {
    const filas = agrupar([
      mov({ mes: '2026-09', monto: 10 }),
      mov({ mes: '2026-07', monto: 999 }),
      mov({ mes: '2026-08', monto: 50 }),
    ], 'mes');

    expect(filas.map(f => f.clave)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(filas[0].etiqueta).toBe('Jul 2026');
  });

  it('marca el centro de costo que no está en el catálogo', () => {
    const [fila] = agrupar([
      mov({ centroCosto: 'OFICINA CENTRAL', enCatalogo: false }),
      mov({ centroCosto: 'OFICINA CENTRAL', enCatalogo: false }),
    ], 'centroCosto');

    expect(fila.enCatalogo).toBe(false);
  });
});

describe('totales', () => {
  it('cuenta los egresos sin proyecto y los centros fuera de catálogo', () => {
    const t = totales([
      mov({ monto: 100, proyectoId: 'p1', centroCosto: 'OFCENTRAL' }),
      mov({ monto: 200, proyectoId: null, centroCosto: 'OFICINA CENTRAL', enCatalogo: false }),
      mov({ flujo: 'ingreso', fuente: 'ingreso_caja', monto: 50, moneda: 'USD' }),
    ]);

    expect(t.movimientos).toBe(3);
    expect(t.egreso).toEqual({ pen: 300, usd: 0 });
    expect(t.ingreso).toEqual({ pen: 0, usd: 50 });
    // El ingreso no cuenta como "egreso sin proyecto".
    expect(t.sinProyecto).toBe(1);
    expect(t.fueraDeCatalogo).toBe(1);
  });
});

describe('nombreMes', () => {
  it('traduce el mes ISO', () => {
    expect(nombreMes('2026-01')).toBe('Ene 2026');
    expect(nombreMes('2026-09')).toBe('Set 2026');
  });

  it('deja pasar lo que no reconoce', () => {
    expect(nombreMes('sin fecha')).toBe('sin fecha');
  });
});

describe('exportación', () => {
  it('manda cada importe a su columna, sin convertir', () => {
    const filas = paraExportar([
      mov({ moneda: 'USD', monto: 1200 }),
      mov({ moneda: 'PEN', monto: 340 }),
    ]);

    expect(filas[0].dolares).toBe(1200);
    expect(filas[0].soles).toBe('');
    expect(filas[1].soles).toBe(340);
    expect(filas[1].dolares).toBe('');
  });
});

describe('el reporte no enseña lo que el rol no puede ver', () => {
  it('un rol de Compras cruza órdenes, no la caja chica', () => {
    expect(fuentesPermitidas(m => m === 'compras')).toEqual(['orden_compra']);
  });

  it('un rol de Finanzas ve las dos fuentes de caja y ninguna orden', () => {
    expect(fuentesPermitidas(m => m === 'finanzas')).toEqual(['gasto_caja', 'ingreso_caja']);
  });

  it('quien ve los dos módulos cruza todo', () => {
    expect(fuentesPermitidas(() => true)).toEqual(['orden_compra', 'gasto_caja', 'ingreso_caja']);
  });

  it('sin ninguno de los dos módulos no queda nada que cruzar', () => {
    expect(fuentesPermitidas(() => false)).toEqual([]);
  });
});
