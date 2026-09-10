/**
 * EL DOCUMENTO DE LA COTIZACIÓN.
 *
 * La cotización del proveedor llega como PDF, foto o Excel. El ERP guardaba los
 * importes pero no el papel, así que el documento que respalda la compra seguía
 * viviendo en un correo o en un WhatsApp. Aquí se adjunta y se queda con la
 * cotización.
 *
 * Se admite más de un archivo por cotización: es normal que el proveedor mande
 * la propuesta y aparte la ficha técnica.
 *
 * El bucket es privado. Nunca se guarda una URL: se pide una firmada en el
 * momento de abrir el archivo y caduca en cinco minutos. Una URL guardada en la
 * base sería un enlace público permanente a un documento de la empresa.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';

const BUCKET = 'cotizaciones';

/** 10 MB, el tope del bucket. Se avisa antes de subir, no después de fallar. */
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

export const TIPOS_ACEPTADOS =
  '.pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc';

export interface ArchivoCotizacion {
  id: string;
  nombre: string;
  storagePath: string;
  mime: string | null;
  tamanoBytes: number | null;
  subidoEn: string;
}

/** "1.2 MB", "340 KB". */
export function tamanoLegible(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Quita de un nombre de archivo lo que Storage no admite en una ruta.
 * "Cotización N° 12 (final).pdf" → "Cotizacion-N-12-final-.pdf"
 */
export function nombreParaRuta(nombre: string): string {
  return nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // tildes fuera
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const tabla = () => supabase.from('cotizacion_archivos') as any;

export function useArchivosCotizacion(cotizacionDbId: string | undefined) {
  const { tenantId, user } = useAuth();
  const [archivos, setArchivos] = useState<ArchivoCotizacion[]>([]);
  const [cargando, setCargando] = useState(false);

  const recargar = useCallback(async () => {
    if (!cotizacionDbId) { setArchivos([]); return; }
    setCargando(true);
    const { data, error } = await tabla()
      .select('*')
      .eq('cotizacion_id', cotizacionDbId)
      .order('subido_en', { ascending: false });
    if (error) console.error('[cotizacion-archivos]', error.message);
    setArchivos((data ?? []).map((r: any): ArchivoCotizacion => ({
      id: r.id,
      nombre: r.nombre,
      storagePath: r.storage_path,
      mime: r.mime,
      tamanoBytes: r.tamano_bytes,
      subidoEn: r.subido_en,
    })));
    setCargando(false);
  }, [cotizacionDbId]);

  useEffect(() => { void recargar(); }, [recargar]);

  /** Sube un archivo. Devuelve el error como texto, o null si fue bien. */
  const subir = useCallback(async (archivo: File): Promise<string | null> => {
    if (!cotizacionDbId || !tenantId) return 'No se pudo identificar la cotización';
    if (archivo.size > TAMANO_MAXIMO) {
      return `"${archivo.name}" pesa ${tamanoLegible(archivo.size)}; el máximo es 10 MB`;
    }

    const ruta = `${tenantId}/${cotizacionDbId}/${Date.now()}-${nombreParaRuta(archivo.name)}`;

    const { error: errSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false });
    if (errSubida) return errSubida.message;

    const { error } = await tabla().insert({
      tenant_id: tenantId,
      cotizacion_id: cotizacionDbId,
      nombre: archivo.name,          // el nombre original, para enseñarlo tal cual
      storage_path: ruta,
      mime: archivo.type || null,
      tamano_bytes: archivo.size,
      subido_por: user?.id ?? null,
    });
    if (error) {
      // Si no se pudo registrar, no dejar el archivo suelto en el bucket.
      await supabase.storage.from(BUCKET).remove([ruta]);
      return error.message;
    }

    await recargar();
    return null;
  }, [cotizacionDbId, tenantId, user, recargar]);

  /** URL firmada de 5 minutos. `descargar` fuerza la descarga en vez de abrir. */
  const urlDe = useCallback(async (a: ArchivoCotizacion, descargar = false) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(a.storagePath, 300, descargar ? { download: a.nombre } : undefined);
    if (error) {
      console.error('[cotizacion-archivos]', error.message);
      return null;
    }
    return data?.signedUrl ?? null;
  }, []);

  const eliminar = useCallback(async (a: ArchivoCotizacion): Promise<string | null> => {
    const { error: errStorage } = await supabase.storage.from(BUCKET).remove([a.storagePath]);
    if (errStorage) return errStorage.message;
    const { error } = await tabla().delete().eq('id', a.id);
    if (error) return error.message;
    await recargar();
    return null;
  }, [recargar]);

  return { archivos, cargando, subir, urlDe, eliminar, recargar };
}
