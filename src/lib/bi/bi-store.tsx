/**
 * STORE BI — Business Intelligence & Reportería Global
 * Consulta Supabase en paralelo para agregar métricas de todos los módulos.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';

// ============================================================================
// TIPOS
// ============================================================================

export interface MetricaGeneral {
  vehiculosActivos: number;
  otAbiertas: number;
  ordenesCompraActivas: number;
  articulosBajoMinimo: number;
  valorTotalInventario: number;
  clientesActivos: number;
  oportunidadesAbiertas: number;
  valorPipelineCRM: number;
  proyectosEnEjecucion: number;
  tareasVencidas: number;
  ingresosMes: number;
  egresosMes: number;
  balanceMes: number;
  proveedoresActivos: number;
  contratosVencimientoProximo: number;
}

export interface TendenciaMensual {
  mes: string; // "Ene", "Feb", etc.
  ingresos: number;
  egresos: number;
}

interface BIContextValue {
  metricas: MetricaGeneral | null;
  tendencias: TendenciaMensual[];
  loading: boolean;
  lastUpdate: string | null;
  recargar: () => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const BIContext = createContext<BIContextValue | null>(null);

// ============================================================================
// HELPERS
// ============================================================================

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getMesCorto(isoYearMonth: string): string {
  const parts = isoYearMonth.split('-');
  const monthIndex = parseInt(parts[1], 10) - 1;
  return MESES_CORTOS[monthIndex] ?? isoYearMonth;
}

function getMesRange(isoYearMonth: string): { desde: string; hasta: string } {
  const [year, month] = isoYearMonth.split('-').map(Number);
  const desde = `${isoYearMonth}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const hasta = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { desde, hasta };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function BIProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [metricas, setMetricas] = useState<MetricaGeneral | null>(null);
  const [tendencias, setTendencias] = useState<TendenciaMensual[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Mes actual para filtros
      const ahora = new Date();
      const mesActual = ahora.toISOString().slice(0, 7); // "2026-03"
      const { desde: mesDesde, hasta: mesHasta } = getMesRange(mesActual);

      // Fecha límite para contratos próximos a vencer (30 días desde hoy)
      const hoy = ahora.toISOString().split('T')[0];
      const en30dias = new Date(ahora);
      en30dias.setDate(en30dias.getDate() + 30);
      const fecha30 = en30dias.toISOString().split('T')[0];

      // Queries paralelas
      const [
        resVehiculos,
        resOTs,
        resOrdenes,
        resArticulos,
        resClientes,
        resOportunidades,
        resProyectos,
        resTareas,
        resIngresos,
        resEgresos,
        resProveedores,
        resContratos,
      ] = await Promise.all([
        // Vehículos activos
        supabase
          .from('vehiculos')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'activo'),

        // OTs abiertas (programada | en_ejecucion | espera_repuesto | espera_aprobacion)
        supabase
          .from('ordenes_trabajo')
          .select('id', { count: 'exact', head: true })
          .in('estado', ['programada', 'en_ejecucion', 'espera_repuesto', 'espera_aprobacion']),

        // Órdenes de compra activas (enviada | aprobada | recibida_parcial)
        supabase
          .from('ordenes_compra')
          .select('id', { count: 'exact', head: true })
          .in('estado', ['enviada', 'aprobada', 'recibida_parcial']),

        // Artículos bajo mínimo
        supabase
          .from('articulos')
          .select('id, stock_actual, stock_minimo, precio_unitario'),

        // Clientes activos
        supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'activo'),

        // Oportunidades abiertas + valor pipeline
        supabase
          .from('oportunidades')
          .select('id, monto_estimado, probabilidad')
          .not('etapa', 'in', '("cerrado_ganado","cerrado_perdido")'),

        // Proyectos en ejecución
        supabase
          .from('proyectos')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'en_ejecucion'),

        // Tareas vencidas (fecha_vencimiento < hoy, estado != completada/cancelada)
        supabase
          .from('tareas_proyecto')
          .select('id', { count: 'exact', head: true })
          .lt('fecha_vencimiento', hoy)
          .not('estado', 'in', '("completada","cancelada")'),

        // Ingresos del mes
        supabase
          .from('transacciones')
          .select('monto')
          .eq('tipo', 'ingreso')
          .in('estado', ['aprobada', 'pagada'])
          .gte('fecha', mesDesde)
          .lt('fecha', mesHasta),

        // Egresos del mes
        supabase
          .from('transacciones')
          .select('monto')
          .eq('tipo', 'egreso')
          .in('estado', ['aprobada', 'pagada'])
          .gte('fecha', mesDesde)
          .lt('fecha', mesHasta),

        // Proveedores activos
        supabase
          .from('proveedores')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'activo'),

        // Contratos próximos a vencer (activos, fecha_fin <= hoy + 30 días)
        supabase
          .from('contratos_proveedor')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'activo')
          .lte('fecha_fin', fecha30)
          .gte('fecha_fin', hoy),
      ]);

      // Procesar artículos
      const articulos = resArticulos.data ?? [];
      const articulosBajoMinimo = articulos.filter(
        (a) => (a.stock_actual ?? 0) <= (a.stock_minimo ?? 0)
      ).length;
      const valorTotalInventario = articulos.reduce(
        (acc, a) => acc + (a.stock_actual ?? 0) * (a.precio_unitario ?? 0),
        0
      );

      // Procesar oportunidades
      const oportunidades = resOportunidades.data ?? [];
      const valorPipelineCRM = oportunidades.reduce(
        (acc, o) => acc + ((o.monto_estimado ?? 0) * (o.probabilidad ?? 0)) / 100,
        0
      );

      // Procesar ingresos/egresos
      const ingresosMes = (resIngresos.data ?? []).reduce((acc, t) => acc + (t.monto ?? 0), 0);
      const egresosMes = (resEgresos.data ?? []).reduce((acc, t) => acc + (t.monto ?? 0), 0);

      setMetricas({
        vehiculosActivos: resVehiculos.count ?? 0,
        otAbiertas: resOTs.count ?? 0,
        ordenesCompraActivas: resOrdenes.count ?? 0,
        articulosBajoMinimo,
        valorTotalInventario,
        clientesActivos: resClientes.count ?? 0,
        oportunidadesAbiertas: oportunidades.length,
        valorPipelineCRM,
        proyectosEnEjecucion: resProyectos.count ?? 0,
        tareasVencidas: resTareas.count ?? 0,
        ingresosMes,
        egresosMes,
        balanceMes: ingresosMes - egresosMes,
        proveedoresActivos: resProveedores.count ?? 0,
        contratosVencimientoProximo: resContratos.count ?? 0,
      });

      // Tendencias últimos 6 meses
      const meses = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return d.toISOString().slice(0, 7);
      }).reverse();

      const tendenciasData = await Promise.all(
        meses.map(async (mes) => {
          const { desde, hasta } = getMesRange(mes);
          const [ingQ, egrQ] = await Promise.all([
            supabase
              .from('transacciones')
              .select('monto')
              .eq('tipo', 'ingreso')
              .in('estado', ['aprobada', 'pagada'])
              .gte('fecha', desde)
              .lt('fecha', hasta),
            supabase
              .from('transacciones')
              .select('monto')
              .eq('tipo', 'egreso')
              .in('estado', ['aprobada', 'pagada'])
              .gte('fecha', desde)
              .lt('fecha', hasta),
          ]);
          const ing = (ingQ.data ?? []).reduce((acc, t) => acc + (t.monto ?? 0), 0);
          const egr = (egrQ.data ?? []).reduce((acc, t) => acc + (t.monto ?? 0), 0);
          return { mes: getMesCorto(mes), ingresos: ing, egresos: egr };
        })
      );

      setTendencias(tendenciasData);
      setLastUpdate(new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }));
    } catch (err) {
      console.error('[bi-store] Error al cargar métricas:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) recargar();
  }, [user, recargar]);

  return (
    <BIContext.Provider value={{ metricas, tendencias, loading, lastUpdate, recargar }}>
      {children}
    </BIContext.Provider>
  );
}

export function useBI() {
  const ctx = useContext(BIContext);
  if (!ctx) throw new Error('useBI must be used within BIProvider');
  return ctx;
}
