/**
 * STORE DE CENTROS DE COSTO
 * Conectado a Supabase — tabla centros_costo
 * Gestión de centros de costo internos de la empresa
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dbCentrosCosto } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { CentroCostoDB } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface CentroCosto {
  _dbId: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creadoEn: string;
}

export interface NuevoCentroCostoInput {
  codigo: string;
  nombre: string;
  descripcion?: string;
}

interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface CentrosCostoStoreContext {
  centrosCosto: CentroCosto[];
  loading: boolean;
  refresh: () => void;
  crearCentroCosto: (input: NuevoCentroCostoInput) => Promise<CrudResult & { centroCosto?: CentroCosto }>;
  actualizarCentroCosto: (id: string, input: Partial<NuevoCentroCostoInput>) => Promise<CrudResult>;
  toggleActivo: (id: string) => Promise<CrudResult>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const CentrosCostoContext = createContext<CentrosCostoStoreContext | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

function mapFromDB(row: CentroCostoDB): CentroCosto {
  return {
    _dbId: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion ?? null,
    activo: row.activo,
    creadoEn: row.creado_en,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function CentrosCostoProvider({ children }: { children: React.ReactNode }) {
  const { tenantId } = useAuth();
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCentrosCosto = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);

    const { data, error } = await dbCentrosCosto.listAll();

    if (error) {
      console.error('[CENTROS_COSTO] Error al cargar:', error.message);
    } else if (data) {
      setCentrosCosto((data as CentroCostoDB[]).map(mapFromDB));
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchCentrosCosto();
  }, [fetchCentrosCosto]);

  const refresh = useCallback(() => {
    fetchCentrosCosto();
  }, [fetchCentrosCosto]);

  // ============================================================================
  // CRUD
  // ============================================================================

  const crearCentroCosto = useCallback(
    async (input: NuevoCentroCostoInput): Promise<CrudResult & { centroCosto?: CentroCosto }> => {
      if (!tenantId) return { exito: false, errores: ['Sin sesión activa'] };

      // Validar código único
      const existe = centrosCosto.find(cc => cc.codigo === input.codigo.trim().toUpperCase());
      if (existe) return { exito: false, errores: ['Ya existe un centro de costo con ese código'] };

      const { data, error } = await dbCentrosCosto.create({
        tenant_id: tenantId,
        codigo: input.codigo.trim().toUpperCase(),
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
        activo: true,
      });

      if (error || !data) {
        console.error('[CENTROS_COSTO] Error al crear:', error?.message);
        return { exito: false, errores: [error?.message ?? 'Error desconocido'] };
      }

      const nuevo = mapFromDB(data as CentroCostoDB);
      setCentrosCosto(prev => [...prev, nuevo].sort((a, b) => a.codigo.localeCompare(b.codigo)));
      return { exito: true, centroCosto: nuevo };
    },
    [tenantId, centrosCosto]
  );

  const actualizarCentroCosto = useCallback(
    async (id: string, input: Partial<NuevoCentroCostoInput>): Promise<CrudResult> => {
      const updatePayload: Record<string, unknown> = {};
      if (input.nombre !== undefined) updatePayload.nombre = input.nombre.trim();
      if (input.descripcion !== undefined) updatePayload.descripcion = input.descripcion?.trim() || null;
      if (input.codigo !== undefined) updatePayload.codigo = input.codigo.trim().toUpperCase();

      const { error } = await dbCentrosCosto.update(id, updatePayload);

      if (error) {
        console.error('[CENTROS_COSTO] Error al actualizar:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setCentrosCosto(prev =>
        prev.map(cc =>
          cc._dbId === id
            ? {
                ...cc,
                ...(input.nombre !== undefined && { nombre: input.nombre.trim() }),
                ...(input.descripcion !== undefined && { descripcion: input.descripcion?.trim() || null }),
                ...(input.codigo !== undefined && { codigo: input.codigo.trim().toUpperCase() }),
              }
            : cc
        )
      );

      return { exito: true };
    },
    []
  );

  const toggleActivo = useCallback(
    async (id: string): Promise<CrudResult> => {
      const cc = centrosCosto.find(c => c._dbId === id);
      if (!cc) return { exito: false, errores: ['Centro de costo no encontrado'] };

      const nuevoActivo = !cc.activo;
      const { error } = await dbCentrosCosto.update(id, { activo: nuevoActivo });

      if (error) {
        console.error('[CENTROS_COSTO] Error al cambiar estado:', error.message);
        return { exito: false, errores: [error.message] };
      }

      setCentrosCosto(prev =>
        prev.map(c => (c._dbId === id ? { ...c, activo: nuevoActivo } : c))
      );

      return { exito: true };
    },
    [centrosCosto]
  );

  const value: CentrosCostoStoreContext = {
    centrosCosto,
    loading,
    refresh,
    crearCentroCosto,
    actualizarCentroCosto,
    toggleActivo,
  };

  return <CentrosCostoContext.Provider value={value}>{children}</CentrosCostoContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCentrosCosto() {
  const context = useContext(CentrosCostoContext);
  if (!context) {
    throw new Error('useCentrosCosto debe usarse dentro de CentrosCostoProvider');
  }
  return context;
}
