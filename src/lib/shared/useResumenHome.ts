/**
 * useResumenHome — cifras REALES para la pantalla de bienvenida.
 *
 * Sustituye los números fijos que traía HomeWelcome ("Alertas pendientes: 3",
 * "Tareas del día: 5", "Tendencia: +12%"), que no salían de ningún lado.
 *
 * Cada indicador se consulta solo si el usuario puede ver ese módulo, así que
 * el Home muestra lo que le toca a cada quien y no dispara consultas que RLS
 * va a rechazar de todos modos.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '../rbac/usePermissions';

export interface IndicadorHome {
  id: string;
  label: string;
  valor: string;
  ruta: string;
}

export function useResumenHome() {
  const { tenantId } = useAuth();
  const { can, loading: permisosLoading } = usePermissions();
  const [indicadores, setIndicadores] = useState<IndicadorHome[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permisosLoading || !tenantId) return;
    let vivo = true;

    const contar = async (tabla: string, filtro?: (q: any) => any) => {
      let q = supabase.from(tabla).select('*', { count: 'exact', head: true });
      if (filtro) q = filtro(q);
      const { count, error } = await q;
      return error ? null : (count ?? 0);
    };

    (async () => {
      const out: IndicadorHome[] = [];

      if (can('compras', 'ver')) {
        const n = await contar('ordenes_compra', q => q.eq('estado', 'enviada'));
        if (n !== null) out.push({ id: 'oc', label: 'Órdenes por aprobar', valor: String(n), ruta: '/compras/ordenes' });
      }
      if (can('finanzas', 'ver')) {
        const n = await contar('cajas_chicas', q => q.eq('estado', 'activo'));
        if (n !== null) out.push({ id: 'caja', label: 'Cajas chicas abiertas', valor: String(n), ruta: '/finanzas/caja-chica' });
      }
      if (can('flota', 'ver')) {
        const n = await contar('vehiculos');
        if (n !== null) out.push({ id: 'veh', label: 'Vehículos', valor: String(n), ruta: '/flota/vehiculos' });
      }
      if (can('proyectos', 'ver')) {
        const n = await contar('proyectos');
        if (n !== null) out.push({ id: 'proy', label: 'Proyectos', valor: String(n), ruta: '/proyectos/lista' });
      }
      if (can('contabilidad', 'ver')) {
        const n = await contar('comprobantes_pago');
        if (n !== null) out.push({ id: 'comp', label: 'Comprobantes', valor: String(n), ruta: '/contabilidad/comprobantes' });
      }

      if (vivo) {
        setIndicadores(out.slice(0, 4));
        setLoading(false);
      }
    })();

    return () => { vivo = false; };
  }, [tenantId, permisosLoading, can]);

  return { indicadores, loading: loading || permisosLoading };
}
