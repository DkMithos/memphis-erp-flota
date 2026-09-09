/**
 * Carga y guarda el flujo de aprobación desde la tabla `flujo_aprobacion`.
 *
 * Antes vivía en localStorage: cada navegador tenía su propia copia, así que lo
 * que Kevin configuraba no lo veía Richard. Es una política de la empresa, no
 * una preferencia personal.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import {
  FLUJO_APROBACION_DEFAULT, normalizarConfig, setFlujoAprobacionCache,
  type FlujoAprobacionConfig,
} from './approval-flow';

/* eslint-disable @typescript-eslint/no-explicit-any */
const tabla = () => (supabase as any).from('flujo_aprobacion');

export function useFlujoAprobacion() {
  const { tenantId, user } = useAuth();
  const [config, setConfig] = useState<FlujoAprobacionConfig>(FLUJO_APROBACION_DEFAULT);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!tenantId) { setCargando(false); return; }
    const { data, error } = await tabla().select('config').eq('tenant_id', tenantId).maybeSingle();
    if (error) console.error('[FLUJO] No se pudo leer la configuración:', error.message);
    const normalizada = normalizarConfig(data?.config);
    setConfig(normalizada);
    // Se cachea para que el resto del código pueda leerla sin ser asíncrono.
    setFlujoAprobacionCache(normalizada);
    setCargando(false);
  }, [tenantId]);

  useEffect(() => { void cargar(); }, [cargar]);

  const guardar = useCallback(async (nueva: FlujoAprobacionConfig) => {
    if (!tenantId) return { exito: false, error: 'Sin empresa en sesión' };
    const payload = { ...nueva, updatedAt: new Date().toISOString(), updatedBy: user?.email ?? 'sistema' };
    const { error } = await tabla().upsert(
      { tenant_id: tenantId, config: payload, actualizado_en: new Date().toISOString(), actualizado_por: user?.email ?? 'sistema' },
      { onConflict: 'tenant_id' },
    );
    if (error) return { exito: false, error: error.message };
    setConfig(payload);
    setFlujoAprobacionCache(payload);
    return { exito: true };
  }, [tenantId, user]);

  return { config, cargando, guardar, recargar: cargar };
}
