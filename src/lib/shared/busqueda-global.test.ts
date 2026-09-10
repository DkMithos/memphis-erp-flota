import { describe, it, expect } from 'vitest';
import { FUENTES, fuentesPermitidas, terminoSeguro } from './busqueda-global';
import type { Modulo, Accion } from '../rbac/usePermissions';

/** Un `can` que solo concede `ver` sobre los módulos indicados. */
const soloVe = (...modulos: Modulo[]) =>
  (m: Modulo, a: Accion) => a === 'ver' && modulos.includes(m);

describe('el buscador no consulta módulos que el usuario no tiene', () => {
  it('un rol de Compras solo busca en compras y proveedores', () => {
    const ids = fuentesPermitidas(soloVe('compras', 'proveedores')).map(f => f.id);
    expect(ids).toEqual(['ordenes_compra', 'proveedores']);
  });

  it('no le devuelve vehículos, clientes ni artículos', () => {
    const ids = fuentesPermitidas(soloVe('compras', 'proveedores')).map(f => f.id);
    expect(ids).not.toContain('vehiculos');
    expect(ids).not.toContain('clientes');
    expect(ids).not.toContain('articulos');
  });

  it('quien ve flota busca vehículos y órdenes de trabajo', () => {
    const ids = fuentesPermitidas(soloVe('flota')).map(f => f.id);
    expect(ids).toEqual(['ordenes_trabajo', 'vehiculos']);
  });

  it('sin ningún módulo no se consulta nada', () => {
    expect(fuentesPermitidas(() => false)).toEqual([]);
  });

  it('con todos los permisos se consultan todas las fuentes', () => {
    expect(fuentesPermitidas(() => true)).toHaveLength(FUENTES.length);
  });

  it('cada fuente apunta a una pantalla dentro de su propio módulo', () => {
    for (const f of FUENTES) {
      const ejemplo = f.mapear([{
        id: 'x', codigo: 'C1', nombre: 'N', numero: 'MM-1', estado: 'aprobada',
        razon_social: 'RS', ruc: '20', numero_ot: 'OT-1', titulo: 'T',
        placa: 'ABC-123', marca: 'M', modelo: 'Mo',
      }])[0];
      expect(ejemplo.route.startsWith(f.ruta + '/')).toBe(true);
    }
  });
});

describe('el término de búsqueda se sanea antes de interpolarlo', () => {
  it('quita lo que rompe los filtros de PostgREST', () => {
    expect(terminoSeguro('a,b(c)"d')).toBe('%a b c  d%');
  });

  it('no busca con menos de dos caracteres útiles', () => {
    expect(terminoSeguro('a')).toBeNull();
    expect(terminoSeguro('(,)')).toBeNull();
  });
});
