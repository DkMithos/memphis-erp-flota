import { describe, it, expect } from 'vitest';
import { construirHojasProveedores, cuentasDe, cuentaComoTexto } from './export-proveedores';
import type { Proveedor } from './proveedores-store';

// Proveedor mínimo válido; cada test ajusta lo que le importa.
function prov(over: Partial<Proveedor>): Proveedor {
  return {
    id: 'PROV-0001', _dbId: 'uuid-1', ruc: '20123456789', razonSocial: 'ACME SAC',
    nombreComercial: null, regimenIgv: 'gravado', domiciliado: true,
    suspensionRetencionRh: false, suspensionRetencionHasta: null,
    tipo: 'bienes', categorias: ['repuestos'], estado: 'activo', condicion: 'buena',
    contacto: null, email: 'a@acme.pe', telefono: '017778888', telefonoAlternativo: null,
    direccion: 'Av. Siempre Viva 123', ciudad: 'Lima', pais: 'Perú',
    contactoPrincipal: null, datosBancarios: null, cuentasBancarias: [],
    datosTributarios: { sujetoDetraccion: false, tasaDetraccion: null, codigoBienServicio: null, sujetoRetencion: false },
    calificacion: 0, totalCompras: 0, numeroOrdenes: 0,
    auditoria: { creadoPor: null, creadoEn: '2026-01-15T10:00:00Z', modificadoPor: null, modificadoEn: null, inactivadoPor: null, inactivadoEn: null, motivoInactivacion: null },
    observaciones: null, documentosAdjuntos: [],
    ...over,
  } as Proveedor;
}

describe('cuentasDe — precedencia jsonb sobre cuenta plana', () => {
  it('usa las cuentas múltiples si existen', () => {
    const p = prov({
      datosBancarios: { banco: 'BCP', numeroCuenta: '111', cci: '', tipoCuenta: 'corriente', moneda: 'PEN' },
      cuentasBancarias: [
        { banco: 'Interbank', numeroCuenta: '222', cci: '333', tipoCuenta: 'ahorros', moneda: 'USD' },
      ],
    });
    expect(cuentasDe(p).map(c => c.banco)).toEqual(['Interbank']);
  });
  it('cae a la cuenta única cuando no hay múltiples', () => {
    const p = prov({ datosBancarios: { banco: 'BCP', numeroCuenta: '111', cci: '', tipoCuenta: 'corriente', moneda: 'PEN' } });
    expect(cuentasDe(p).map(c => c.numeroCuenta)).toEqual(['111']);
  });
  it('vacío si no hay ninguna', () => {
    expect(cuentasDe(prov({}))).toEqual([]);
  });
});

describe('cuentaComoTexto', () => {
  it('arma la línea legible y omite lo vacío', () => {
    expect(cuentaComoTexto({ banco: 'BCP', numeroCuenta: '19492625348055', cci: '00219419262534805597', tipoCuenta: 'corriente', moneda: 'PEN' }))
      .toBe('BCP · 19492625348055 · CCI 00219419262534805597 · Soles · Corriente');
    expect(cuentaComoTexto({ banco: 'BBVA', numeroCuenta: '001100500200147904', cci: '', tipoCuenta: 'ahorros', moneda: 'USD' }))
      .toBe('BBVA · 001100500200147904 · Dólares · Ahorros');
  });
});

describe('construirHojasProveedores', () => {
  const categorias = [{ key: 'repuestos', label: 'Repuestos y Autopartes' }, { key: 'flota_gps', label: 'GPS de Flota' }];

  it('hoja Proveedores trae todos los campos con etiquetas legibles', () => {
    const p = prov({
      nombreComercial: 'Acme', tipo: 'servicios', categorias: ['repuestos', 'flota_gps'] as any,
      estado: 'en_evaluacion', condicion: 'sin_evaluar', calificacion: 4, regimenIgv: 'exonerado',
      domiciliado: false,
      contactoPrincipal: { nombre: 'Juan Pérez', cargo: 'Ventas', email: 'juan@acme.pe', telefono: '999888777' },
      observaciones: 'Entrega en 48h',
      datosTributarios: { sujetoDetraccion: true, tasaDetraccion: 12, codigoBienServicio: '037', sujetoRetencion: true },
      suspensionRetencionRh: true, suspensionRetencionHasta: '2026-12-31',
      cuentasBancarias: [
        { banco: 'BCP', numeroCuenta: '194', cci: '002', tipoCuenta: 'corriente', moneda: 'PEN' },
        { banco: 'Interbank', numeroCuenta: '200', cci: '', tipoCuenta: 'ahorros', moneda: 'USD' },
      ],
    });
    const [hojaProv] = construirHojasProveedores([p], categorias);
    const f = hojaProv.data[0];
    expect(hojaProv.nombre).toBe('Proveedores');
    expect(f.tipo).toBe('Servicios');
    expect(f.categorias).toBe('Repuestos y Autopartes, GPS de Flota');
    expect(f.estado).toBe('En Evaluación');
    expect(f.condicion).toBe('Sin Evaluar');
    expect(f.regimenIgv).toBe('Exonerado');
    expect(f.domiciliado).toBe('No');
    expect(f.contacto).toBe('Juan Pérez');
    expect(f.contactoCargo).toBe('Ventas');
    expect(f.observaciones).toBe('Entrega en 48h');
    expect(f.sujetoDetraccion).toBe('Sí');
    expect(f.tasaDetraccion).toBe('12%');
    expect(f.codigoBienServicio).toBe('037');
    expect(f.sujetoRetencion).toBe('Sí');
    expect(f.suspensionRetencionRh).toBe('Sí');
    expect(f.suspensionRetencionHasta).toBe('2026-12-31');
    // Primera cuenta en columnas propias + todas concatenadas
    expect(f.nCuentas).toBe(2);
    expect(f.banco).toBe('BCP');
    expect(f.cuenta).toBe('194');
    expect(f.monedaCuenta).toBe('Soles');
    expect(f.todasLasCuentas).toBe('BCP · 194 · CCI 002 · Soles · Corriente | Interbank · 200 · Dólares · Ahorros');
    expect(f.creadoEn).toBe('2026-01-15');
  });

  it('con una sola cuenta no llena "Todas las cuentas"', () => {
    const p = prov({ datosBancarios: { banco: 'BCP', numeroCuenta: '111', cci: '', tipoCuenta: 'corriente', moneda: 'PEN' } });
    const f = construirHojasProveedores([p])[0].data[0];
    expect(f.nCuentas).toBe(1);
    expect(f.banco).toBe('BCP');
    expect(f.todasLasCuentas).toBe('');
  });

  it('categoría desconocida cae a la key sin romper', () => {
    const f = construirHojasProveedores([prov({ categorias: ['algo_raro' as any] })])[0].data[0];
    expect(f.categorias).toBe('algo_raro');
  });

  it('hoja Cuentas bancarias: una fila por cuenta con RUC y razón social', () => {
    const ps = [
      prov({ id: 'PROV-0001', ruc: '20111', razonSocial: 'ACME',
        cuentasBancarias: [
          { banco: 'BCP', numeroCuenta: '194', cci: '002', tipoCuenta: 'corriente', moneda: 'PEN' },
          { banco: 'BBVA', numeroCuenta: '555', cci: '', tipoCuenta: 'ahorros', moneda: 'USD' },
        ] }),
      prov({ id: 'PROV-0002', ruc: '20222', razonSocial: 'BETA',
        datosBancarios: { banco: 'Scotiabank', numeroCuenta: '777', cci: '888', tipoCuenta: 'corriente', moneda: 'PEN' } }),
      prov({ id: 'PROV-0003', ruc: '20333', razonSocial: 'SIN CUENTA' }),
    ];
    const cuentas = construirHojasProveedores(ps)[1];
    expect(cuentas.nombre).toBe('Cuentas bancarias');
    expect(cuentas.data).toHaveLength(3);   // 2 + 1 + 0
    expect(cuentas.data.map(r => [r.codigo, r.banco, r.moneda])).toEqual([
      ['PROV-0001', 'BCP', 'Soles'],
      ['PROV-0001', 'BBVA', 'Dólares'],
      ['PROV-0002', 'Scotiabank', 'Soles'],
    ]);
  });
});
