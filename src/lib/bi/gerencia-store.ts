/**
 * Datos del tablero de Gerencia (Fase 1).
 *
 * Sale de vistas en la base (`v_gerencia_*`), no de cálculos en el navegador:
 * así la cifra que ve Gerencia y la que ve Contabilidad salen del mismo sitio.
 *
 * Todo va separado por moneda a propósito. El gasto de Memphis es
 * mayoritariamente en dólares (902 órdenes por $22.2M frente a 395 por
 * S/20.2M), así que consolidar con un tipo de cambio fijo movería la cifra en
 * millones. El consolidado llega cuando exista la tabla de tipos de cambio por
 * fecha, que es una decisión pendiente de Contabilidad.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';

export interface CompromisoMes {
  mes: string;
  pen: number;
  usd: number;
  ordenes: number;
  egresoCajaPen: number;
}

export interface FilaProyecto {
  proyectoId: string;
  proyecto: string;
  estado: string;
  presupuesto: number | null;
  costoReal: number | null;
  avance: number;
  comprometidoPen: number;
  comprometidoUsd: number;
  ordenes: number;
}

export interface FilaCentroCosto {
  codigo: string;
  nombre: string;
  tieneProyecto: boolean;
  comprometidoPen: number;
  comprometidoUsd: number;
  ordenes: number;
}

export interface FilaProveedor {
  proveedor: string;
  ruc: string | null;
  comprometidoPen: number;
  comprometidoUsd: number;
  ordenes: number;
  ultimaOrden: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const vista = (n: string) => supabase.from(n) as any;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export function useGerencia() {
  const { tenantId } = useAuth();
  const [meses, setMeses] = useState<CompromisoMes[]>([]);
  const [proyectos, setProyectos] = useState<FilaProyecto[]>([]);
  const [centros, setCentros] = useState<FilaCentroCosto[]>([]);
  const [proveedores, setProveedores] = useState<FilaProveedor[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);

    const [mm, cc, pp, pr, cj] = await Promise.all([
      vista('v_gerencia_compromiso_mensual').select('*').order('mes'),
      vista('v_gerencia_por_centro_costo').select('*'),
      vista('v_gerencia_por_proyecto').select('*'),
      vista('v_gerencia_por_proveedor').select('*'),
      vista('v_gerencia_caja_mensual').select('*'),
    ]);

    // La vista devuelve una fila por mes y moneda; aquí se junta en una por mes.
    const porMes = new Map<string, CompromisoMes>();
    const dame = (mes: string) => {
      if (!porMes.has(mes)) porMes.set(mes, { mes, pen: 0, usd: 0, ordenes: 0, egresoCajaPen: 0 });
      return porMes.get(mes)!;
    };
    for (const r of (mm.data ?? [])) {
      const f = dame(r.mes);
      if (r.moneda === 'USD') f.usd += num(r.comprometido); else f.pen += num(r.comprometido);
      f.ordenes += num(r.ordenes);
    }
    for (const r of (cj.data ?? [])) {
      if (r.moneda === 'USD') continue;   // la caja en dólares es marginal y se vería como ruido
      dame(r.mes).egresoCajaPen += num(r.egreso);
    }
    setMeses([...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)));

    setProyectos((pp.data ?? []).map((r: any) => ({
      proyectoId: r.proyecto_id,
      proyecto: r.proyecto,
      estado: r.estado,
      presupuesto: r.presupuesto === null ? null : Number(r.presupuesto),
      costoReal: r.costo_real === null ? null : Number(r.costo_real),
      avance: num(r.porcentaje_avance),
      comprometidoPen: num(r.comprometido_pen),
      comprometidoUsd: num(r.comprometido_usd),
      ordenes: num(r.ordenes),
    })).sort((a: FilaProyecto, b: FilaProyecto) =>
      (b.comprometidoPen + b.comprometidoUsd) - (a.comprometidoPen + a.comprometidoUsd)));

    setCentros((cc.data ?? []).map((r: any) => ({
      codigo: r.codigo,
      nombre: r.nombre,
      tieneProyecto: !!r.tiene_proyecto,
      comprometidoPen: num(r.comprometido_pen),
      comprometidoUsd: num(r.comprometido_usd),
      ordenes: num(r.ordenes),
    })).filter((c: FilaCentroCosto) => c.ordenes > 0)
      .sort((a: FilaCentroCosto, b: FilaCentroCosto) => b.ordenes - a.ordenes));

    setProveedores((pr.data ?? []).map((r: any) => ({
      proveedor: r.proveedor,
      ruc: r.ruc,
      comprometidoPen: num(r.comprometido_pen),
      comprometidoUsd: num(r.comprometido_usd),
      ordenes: num(r.ordenes),
      ultimaOrden: r.ultima_orden,
    })).sort((a: FilaProveedor, b: FilaProveedor) =>
      (b.comprometidoPen + b.comprometidoUsd) - (a.comprometidoPen + a.comprometidoUsd)));

    setLoading(false);
  }, [tenantId]);

  useEffect(() => { void cargar(); }, [cargar]);

  return { meses, proyectos, centros, proveedores, loading, recargar: cargar };
}

/** Concentración: qué parte del compromiso está en los N primeros proveedores. */
export function concentracion(proveedores: FilaProveedor[], n = 10) {
  const totales = proveedores.map(p => p.comprometidoPen + p.comprometidoUsd);
  const total = totales.reduce((s, x) => s + x, 0);
  const top = totales.slice(0, n).reduce((s, x) => s + x, 0);
  return { total, top, porcentaje: total > 0 ? (top / total) * 100 : 0 };
}
