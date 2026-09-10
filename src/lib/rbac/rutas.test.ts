/**
 * Las reglas de acceso por ruta, fijadas por prueba.
 *
 * No están aquí todas las combinaciones: están las que se decidieron a mano y
 * que un cambio distraído en `rutas.ts` volvería a abrir sin que nadie se
 * entere. Cada caso corresponde a un hallazgo del recorrido por rol del 08/09.
 */
import { describe, it, expect } from 'vitest';
import { puedeVerRuta } from './rutas';
import type { Modulo, Accion } from './usePermissions';

/** Construye el `can()` de un rol a partir de su lista "modulo.accion". */
const conPermisos = (ps: string[]) => {
  const set = new Set(ps);
  return (m: Modulo, a: Accion) => set.has(`${m}.${a}`);
};

const CARGOS_FIANZAS = conPermisos(['fianzas.cargos']);
const COMPRAS = conPermisos(['compras.ver', 'compras.crear', 'compras.recepcionar', 'inventario.ver']);
const CONTABILIDAD = conPermisos(['compras.ver', 'contabilidad.ver', 'finanzas.ver', 'proveedores.ver']);
const GERENCIA = conPermisos(['admin.ver', 'compras.ver', 'finanzas.ver', 'proyectos.ver', 'flota.ver']);

describe('Flujo Gerencia', () => {
  it('lo abren gerencia y administración de sistemas', () => {
    expect(puedeVerRuta('/bi/gerencia', GERENCIA)).toBe(true);
  });

  it('NO lo abre quien solo ve un módulo operativo', () => {
    // Márgenes y rentabilidad de toda la empresa: no es un reporte de compras.
    expect(puedeVerRuta('/bi/gerencia', COMPRAS)).toBe(false);
    expect(puedeVerRuta('/bi/gerencia', CONTABILIDAD)).toBe(false);
  });

  it('el BI cruzado sí sigue abierto a los módulos que reporta', () => {
    expect(puedeVerRuta('/bi/cruzado', COMPRAS)).toBe(true);
  });
});

describe('Dashboard general', () => {
  it('pide ver al menos un módulo', () => {
    expect(puedeVerRuta('/dashboard', COMPRAS)).toBe(true);
    // Un rol de un solo trámite no ve la foto de la empresa.
    expect(puedeVerRuta('/dashboard', CARGOS_FIANZAS)).toBe(false);
  });
});

describe('Cargos de fianzas', () => {
  it('entra con `cargos` aunque no tenga `fianzas.ver`', () => {
    expect(puedeVerRuta('/fianzas/cargos', CARGOS_FIANZAS)).toBe(true);
  });

  it('no alcanza para el tablero de fianzas, donde están los montos', () => {
    expect(puedeVerRuta('/fianzas', CARGOS_FIANZAS)).toBe(false);
  });
});

describe('Recepciones', () => {
  it('verlas basta con ver compras; darlas exige recepcionar', () => {
    expect(puedeVerRuta('/compras/recepciones', CONTABILIDAD)).toBe(true);
    expect(puedeVerRuta('/compras/recepciones/nuevo', CONTABILIDAD)).toBe(false);
    expect(puedeVerRuta('/compras/recepciones/nuevo', COMPRAS)).toBe(true);
  });
});

describe('Administración del sistema', () => {
  it('ver la sección no es gestionar usuarios ni roles', () => {
    expect(puedeVerRuta('/admin', GERENCIA)).toBe(true);
    expect(puedeVerRuta('/admin/usuarios', GERENCIA)).toBe(false);
    expect(puedeVerRuta('/admin/roles', GERENCIA)).toBe(false);
  });
});

describe('las pantallas de alta exigen crear, no ver', () => {
  const soloLectura = (m: Modulo, a: Accion) => a === 'ver' || a === 'exportar';
  const lecturaYAlta = (m: Modulo, a: Accion) => a === 'ver' || a === 'exportar' || a === 'crear';

  it('Walter, con Compras en lectura, entra a la lista pero no al alta', () => {
    expect(puedeVerRuta('/compras/ordenes', soloLectura)).toBe(true);
    expect(puedeVerRuta('/compras/ordenes/nuevo', soloLectura)).toBe(false);
  });

  it('quien sí puede crear, entra', () => {
    expect(puedeVerRuta('/compras/ordenes/nuevo', lecturaYAlta)).toBe(true);
  });

  it('el detalle de un registro sigue siendo ver, no crear', () => {
    expect(puedeVerRuta('/compras/ordenes/MM-001240', soloLectura)).toBe(true);
    expect(puedeVerRuta('/proyectos/360/abc', soloLectura)).toBe(true);
  });

  it('vale para todos los módulos, no solo compras', () => {
    expect(puedeVerRuta('/crm/clientes/nuevo', soloLectura)).toBe(false);
    expect(puedeVerRuta('/contabilidad/asientos/nuevo', soloLectura)).toBe(false);
    expect(puedeVerRuta('/flota/vehiculos/nuevo', soloLectura)).toBe(false);
    expect(puedeVerRuta('/proveedores/directorio/nuevo', soloLectura)).toBe(false);
  });

  it('recepciones mantiene su regla propia: la da quien recepciona', () => {
    // Es la excepción documentada: Flota y Proyectos dan conformidad de
    // mercadería sin tener el resto de Compras.
    const recepcionista = (m: Modulo, a: Accion) => a === 'recepcionar';
    expect(puedeVerRuta('/compras/recepciones/nuevo', recepcionista)).toBe(true);
    expect(puedeVerRuta('/compras/recepciones/nuevo', soloLectura)).toBe(false);
  });
});
