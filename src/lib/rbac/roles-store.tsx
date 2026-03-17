import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import {
  dbRoles,
  dbPermisos,
  dbUsuariosTenant,
  dbRolesPermisos,
  dbUsuariosRoles,
} from '../supabase/helpers';

// ─────────────────────────────────────────────
// Frontend types
// ─────────────────────────────────────────────

export interface Permiso {
  id: string;
  modulo: string;
  accion: string;
  descripcion?: string;
}

export interface Rol {
  _dbId: string;
  nombre: string;
  descripcion?: string;
  esSistema: boolean;
  permisoIds: string[];
  creadoEn: string;
}

export interface UsuarioTenant {
  _dbId: string;
  userId: string;
  nombre: string;
  email: string;
  cargo?: string;
  departamento?: string;
  telefono?: string;
  estado: 'activo' | 'inactivo' | 'suspendido';
  roles: Rol[];
  creadoEn: string;
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

interface RolesContextValue {
  roles: Rol[];
  permisos: Permiso[];
  usuarios: UsuarioTenant[];
  loading: boolean;
  // Roles
  crearRol: (nombre: string, descripcion: string, permisoIds: string[]) => Promise<Rol>;
  actualizarRol: (
    dbId: string,
    nombre: string,
    descripcion: string,
    permisoIds: string[],
  ) => Promise<{ exito: boolean }>;
  eliminarRol: (dbId: string) => Promise<{ exito: boolean }>;
  // Usuarios
  asignarRol: (userId: string, rolDbId: string) => Promise<{ exito: boolean }>;
  quitarRol: (userId: string, rolDbId: string) => Promise<{ exito: boolean }>;
  cambiarEstadoUsuario: (
    dbId: string,
    estado: UsuarioTenant['estado'],
  ) => Promise<{ exito: boolean }>;
}

const RolesContext = createContext<RolesContextValue | null>(null);

// ─────────────────────────────────────────────
// Helper: map DB row → Rol
// ─────────────────────────────────────────────

function mapRol(row: {
  id: string;
  nombre: string;
  descripcion?: string | null;
  es_sistema: boolean;
  creado_en: string;
  roles_permisos?: Array<{ permiso_id: string }> | null;
}): Rol {
  return {
    _dbId: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? undefined,
    esSistema: row.es_sistema,
    permisoIds: (row.roles_permisos ?? []).map(rp => rp.permiso_id),
    creadoEn: row.creado_en,
  };
}

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function RolesProvider({ children }: { children: React.ReactNode }) {
  const { user, tenantId } = useAuth();
  const [roles, setRoles] = useState<Rol[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioTenant[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [rolesRes, permisosRes, usuariosRes] = await Promise.all([
        dbRoles.listWithPermisos(tenantId),
        dbPermisos.listAll(),
        dbUsuariosTenant.list(tenantId),
      ]);

      if (rolesRes.data) {
        setRoles(
          (rolesRes.data as unknown as Array<{
            id: string;
            nombre: string;
            descripcion?: string | null;
            es_sistema: boolean;
            creado_en: string;
            roles_permisos?: Array<{ permiso_id: string }> | null;
          }>).map(mapRol),
        );
      }

      if (permisosRes.data) {
        setPermisos(
          (permisosRes.data as Array<{
            id: string;
            modulo: string;
            accion: string;
            descripcion?: string | null;
          }>).map(p => ({
            id: p.id,
            modulo: p.modulo,
            accion: p.accion,
            descripcion: p.descripcion ?? undefined,
          })),
        );
      }

      if (usuariosRes.data) {
        setUsuarios(
          (usuariosRes.data as unknown as Array<{
            id: string;
            user_id: string;
            nombre: string;
            email: string;
            cargo?: string | null;
            departamento?: string | null;
            telefono?: string | null;
            estado: 'activo' | 'inactivo' | 'suspendido';
            creado_en: string;
            usuarios_roles?: Array<{
              rol_id: string;
              roles?: {
                id: string;
                nombre: string;
                descripcion?: string | null;
                es_sistema: boolean;
                creado_en: string;
                roles_permisos?: Array<{ permiso_id: string }> | null;
              } | null;
            }> | null;
          }>).map(u => ({
            _dbId: u.id,
            userId: u.user_id,
            nombre: u.nombre,
            email: u.email,
            cargo: u.cargo ?? undefined,
            departamento: u.departamento ?? undefined,
            telefono: u.telefono ?? undefined,
            estado: u.estado,
            creadoEn: u.creado_en,
            roles: (u.usuarios_roles ?? [])
              .filter(ur => ur.roles != null)
              .map(ur => mapRol(ur.roles!)),
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (user && tenantId) {
      reload();
    } else {
      setLoading(false);
    }
  }, [user, tenantId, reload]);

  // ── Roles CRUD ──────────────────────────────

  const crearRol = useCallback(
    async (nombre: string, descripcion: string, permisoIds: string[]): Promise<Rol> => {
      if (!tenantId) throw new Error('Sin tenant');
      const { data, error } = await dbRoles.insert({
        tenant_id: tenantId,
        nombre,
        descripcion,
        es_sistema: false,
      });
      if (error || !data) throw error ?? new Error('Error al crear rol');
      const nuevoRol = data as { id: string; nombre: string; descripcion?: string | null; es_sistema: boolean; creado_en: string };
      await dbRolesPermisos.setForRol(nuevoRol.id, permisoIds);
      await reload();
      return {
        _dbId: nuevoRol.id,
        nombre: nuevoRol.nombre,
        descripcion: nuevoRol.descripcion ?? undefined,
        esSistema: nuevoRol.es_sistema,
        permisoIds,
        creadoEn: nuevoRol.creado_en,
      };
    },
    [tenantId, reload],
  );

  const actualizarRol = useCallback(
    async (
      dbId: string,
      nombre: string,
      descripcion: string,
      permisoIds: string[],
    ): Promise<{ exito: boolean }> => {
      const { error } = await dbRoles.update(dbId, { nombre, descripcion });
      if (error) return { exito: false };
      await dbRolesPermisos.setForRol(dbId, permisoIds);
      await reload();
      return { exito: true };
    },
    [reload],
  );

  const eliminarRol = useCallback(
    async (dbId: string): Promise<{ exito: boolean }> => {
      const { error } = await dbRoles.delete(dbId);
      if (error) return { exito: false };
      await reload();
      return { exito: true };
    },
    [reload],
  );

  // ── Usuarios ────────────────────────────────

  const asignarRol = useCallback(
    async (userId: string, rolDbId: string): Promise<{ exito: boolean }> => {
      if (!tenantId || !user) return { exito: false };
      const { error } = await dbUsuariosRoles.assign(
        tenantId,
        userId,
        rolDbId,
        user.email ?? user.id,
      );
      if (error) return { exito: false };
      await reload();
      return { exito: true };
    },
    [tenantId, user, reload],
  );

  const quitarRol = useCallback(
    async (userId: string, rolDbId: string): Promise<{ exito: boolean }> => {
      if (!tenantId) return { exito: false };
      const { error } = await dbUsuariosRoles.remove(tenantId, userId, rolDbId);
      if (error) return { exito: false };
      await reload();
      return { exito: true };
    },
    [tenantId, reload],
  );

  const cambiarEstadoUsuario = useCallback(
    async (
      dbId: string,
      estado: UsuarioTenant['estado'],
    ): Promise<{ exito: boolean }> => {
      const { error } = await dbUsuariosTenant.updateEstado(dbId, estado);
      if (error) return { exito: false };
      await reload();
      return { exito: true };
    },
    [reload],
  );

  return (
    <RolesContext.Provider
      value={{
        roles,
        permisos,
        usuarios,
        loading,
        crearRol,
        actualizarRol,
        eliminarRol,
        asignarRol,
        quitarRol,
        cambiarEstadoUsuario,
      }}
    >
      {children}
    </RolesContext.Provider>
  );
}

export function useRoles(): RolesContextValue {
  const ctx = useContext(RolesContext);
  if (!ctx) throw new Error('useRoles must be used within RolesProvider');
  return ctx;
}
