/**
 * STORE DE DOCUMENTOS BIOMÉDICOS
 * Conectado a Supabase — tabla documentos_biomedicos
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dbDocumentosBiomedicos } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';
import type { DocumentoBiomedico } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface DocumentoBio {
  _dbId: string;
  id: string;              // UUID (no tiene código secuencial propio)
  equipoId: string;
  equipoNombre: string;
  equipoDbId: string;
  nombre: string;
  tipo: 'manual' | 'certificado' | 'protocolo' | 'garantia' | 'ficha_tecnica' | 'otro';
  descripcion?: string;
  urlStorage?: string;
  nombreArchivo?: string;
  tamanoBytes?: number;
  mimeType?: string;
  vigencia?: string;
  subidoPor?: string;
  creadoEn: string;
}

export interface NuevoDocumentoBioInput {
  equipoId: string;
  equipoDbId: string;
  nombre: string;
  tipo: DocumentoBio['tipo'];
  descripcion?: string;
  vigencia?: string;
}

export interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface DocumentosBioContextValue {
  documentos: DocumentoBio[];
  loading: boolean;
  agregarDocumento: (input: NuevoDocumentoBioInput) => Promise<DocumentoBio>;
  eliminarDocumento: (dbId: string) => Promise<CrudResult>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const DocumentosBioContext = createContext<DocumentosBioContextValue | undefined>(undefined);

// ============================================================================
// MAPPER DB → FRONTEND
// ============================================================================

function mapFromDB(row: DocumentoBiomedico): DocumentoBio {
  const equipo = row.equipo as { codigo: string; nombre: string } | null;
  return {
    _dbId: row.id,
    id: row.id,
    equipoId: equipo?.codigo ?? '',
    equipoNombre: equipo?.nombre ?? '',
    equipoDbId: row.equipo_id,
    nombre: row.nombre,
    tipo: row.tipo,
    descripcion: row.descripcion ?? undefined,
    urlStorage: row.url_storage ?? undefined,
    nombreArchivo: row.nombre_archivo ?? undefined,
    tamanoBytes: row.tamano_bytes ?? undefined,
    mimeType: row.mime_type ?? undefined,
    vigencia: row.vigencia ?? undefined,
    subidoPor: row.subido_por ?? undefined,
    creadoEn: row.creado_en,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function DocumentosBioProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [documentos, setDocumentos] = useState<DocumentoBio[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocumentos = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await dbDocumentosBiomedicos.list(tenantId);
    if (error) {
      console.error('[DOCUMENTOS_BIO] Error al cargar:', error.message);
    } else if (data) {
      setDocumentos((data as DocumentoBiomedico[]).map(mapFromDB));
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchDocumentos();
  }, [fetchDocumentos]);

  const agregarDocumento = useCallback(async (input: NuevoDocumentoBioInput): Promise<DocumentoBio> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');

    const { data, error } = await dbDocumentosBiomedicos.insert({
      tenant_id: tenantId,
      equipo_id: input.equipoDbId,
      nombre: input.nombre,
      tipo: input.tipo,
      descripcion: input.descripcion ?? null,
      vigencia: input.vigencia ?? null,
      subido_por: user.id,
      url_storage: null,
      nombre_archivo: null,
      tamano_bytes: null,
      mime_type: null,
    });

    if (error) throw new Error(error.message);

    const nuevo = mapFromDB({
      ...(data as DocumentoBiomedico),
      equipo: { codigo: input.equipoId, nombre: '' },
    });
    setDocumentos(prev => [nuevo, ...prev]);
    return nuevo;
  }, [tenantId, user]);

  const eliminarDocumento = useCallback(async (dbId: string): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const { error } = await dbDocumentosBiomedicos.delete(dbId);
    if (error) return { exito: false, errores: [error.message] };

    setDocumentos(prev => prev.filter(d => d._dbId !== dbId));
    return { exito: true };
  }, [user]);

  const value: DocumentosBioContextValue = {
    documentos,
    loading,
    agregarDocumento,
    eliminarDocumento,
  };

  return (
    <DocumentosBioContext.Provider value={value}>
      {children}
    </DocumentosBioContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useDocumentosBioStore() {
  const context = useContext(DocumentosBioContext);
  if (!context) throw new Error('useDocumentosBioStore debe usarse dentro de DocumentosBioProvider');
  return context;
}
