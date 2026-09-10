import { describe, it, expect } from 'vitest';
import { clavePermisos } from './usePermissions';

const TENANT = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';

describe('la identidad de permisos va por valor, no por objeto', () => {
  it('un perfil recreado con los mismos datos da la misma clave', () => {
    // Es lo que pasa en cada refresco de token: AuthProvider devuelve un objeto
    // nuevo. Si la clave cambiara, se volvería a "cargando" y el menú
    // enseñaría de golpe módulos que el usuario no puede abrir.
    const user = { id: 'u1' };
    const a = clavePermisos(user, TENANT, { rol: 'usuario' });
    const b = clavePermisos({ ...user }, TENANT, { rol: 'usuario' });

    expect(a).toBe(b);
  });

  it('cambiar de usuario sí cambia la clave', () => {
    expect(clavePermisos({ id: 'u1' }, TENANT, null))
      .not.toBe(clavePermisos({ id: 'u2' }, TENANT, null));
  });

  it('cambiar de tenant sí cambia la clave', () => {
    expect(clavePermisos({ id: 'u1' }, TENANT, null))
      .not.toBe(clavePermisos({ id: 'u1' }, 'otro-tenant', null));
  });

  it('subir a administrador de empresa sí cambia la clave', () => {
    expect(clavePermisos({ id: 'u1' }, TENANT, { rol: 'usuario' }))
      .not.toBe(clavePermisos({ id: 'u1' }, TENANT, { rol: 'admin_empresa' }));
  });

  it('sin tenant todavía la clave no se confunde con la del tenant ya cargado', () => {
    expect(clavePermisos({ id: 'u1' }, null, null))
      .not.toBe(clavePermisos({ id: 'u1' }, TENANT, null));
  });

  it('sin sesión no hay nada que cargar', () => {
    expect(clavePermisos(null, TENANT, null)).toBeNull();
  });
});
