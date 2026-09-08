/**
 * PANEL BI — el estado real del ERP, módulo por módulo.
 *
 * Sustituye al store anterior, que pedía métricas a seis tablas vacías
 * (transacciones, oportunidades, clientes, artículos, contratos, tareas) y por
 * eso enseñaba "Balance del mes S/ 0" y "Pipeline S/ 0" como si fueran cifras.
 * Un cero inventado es peor que un hueco rotulado.
 *
 * Aquí solo entra lo que tiene datos detrás. Lo que todavía no se alimenta se
 * declara aparte, en `PENDIENTES_DE_ALIMENTAR`, y la pantalla lo dice.
 *
 * PEN y USD nunca se suman: el gasto es mayoritariamente en dólares y no hay
 * tabla de tipos de cambio por fecha.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import type { Importe } from './cruzado';

export interface MesCompromiso {
  mes: string;
  ocPen: number;
  ocUsd: number;
  cajaPen: number;
}

export interface Panel {
  compras: {
    ordenesVivas: number;
    ordenesAnio: number;
    comprometidoAnio: Importe;
    requerimientosPendientes: number;
    cotizaciones: number;
  };
  caja: {
    cajasAbiertas: number;
    gastosAnio: number;
    egresoAnio: Importe;
  };
  flota: { vehiculosActivos: number; vehiculosTotal: number; otAbiertas: number };
  proveedores: { activos: number };
  proyectos: { enEjecucion: number; total: number; sinPresupuesto: number };
  fianzas: { cartasVigentes: number; venceEn60: number; afianzado: Importe };
  tendencia: MesCompromiso[];
}

/** Lo que la pantalla NO puede mostrar todavía, y por qué. Se muestra tal cual. */
export const PENDIENTES_DE_ALIMENTAR = [
  {
    titulo: 'Deuda con proveedores',
    detalle: 'Necesita las facturas (cuentas por pagar). Hoy el ERP conoce el compromiso de las órdenes, no lo facturado ni lo pagado.',
  },
  {
    titulo: 'Ingresos y rentabilidad por proyecto',
    detalle: 'Necesita las valorizaciones cobradas. Sin eso solo hay costo, no margen.',
  },
  {
    titulo: 'Contabilidad',
    detalle: 'Plan de cuentas, periodos y tipos de cambio están pendientes de Walter.',
  },
  {
    titulo: 'CRM, Inventario y Biomédico',
    detalle: 'Módulos apagados para Memphis: no se muestran cifras de algo que no se usa.',
  },
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown) => (v == null ? 0 : Number(v));
const vista = (n: string) => supabase.from(n) as any;

/** Cuenta filas sin traérselas. */
async function contar(tabla: string, filtro?: (q: any) => any): Promise<number> {
  let q: any = supabase.from(tabla).select('id', { count: 'exact', head: true });
  if (filtro) q = filtro(q);
  const { count, error } = await q;
  if (error) {
    console.error(`[panel-bi] ${tabla}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

export function usePanelBI() {
  const { tenantId } = useAuth();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!tenantId) { setCargando(false); return; }
    setCargando(true);

    const anio = new Date().getFullYear();
    const inicioAnio = `${anio}-01-01`;
    const hoy = new Date().toISOString().slice(0, 10);
    const en60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);

    const [
      ordenesVivas, ordenesAnio, requerimientos, cotizaciones,
      cajasAbiertas, gastosAnio,
      vehiculosActivos, vehiculosTotal, otAbiertas,
      proveedores, proyectosEjec, proyectosTotal,
      compromiso, cajaMensual, proyectosSinPpto, cartas,
    ] = await Promise.all([
      contar('ordenes_compra', q => q.not('estado', 'in', '("anulada","rechazada")')),
      contar('ordenes_compra', q => q.not('estado', 'in', '("anulada","rechazada")').gte('fecha_emision', inicioAnio)),
      contar('requerimientos_compra', q => q.in('estado', ['borrador', 'pendiente', 'aprobado'])),
      contar('cotizaciones'),
      contar('cajas_chicas', q => q.neq('estado', 'cerrada')),
      contar('gastos_caja_chica', q => q.gte('fecha', inicioAnio)),
      contar('vehiculos', q => q.eq('estado', 'activo')),
      contar('vehiculos'),
      contar('ordenes_trabajo', q => q.neq('estado', 'cerrada')),
      contar('proveedores', q => q.eq('estado', 'activo')),
      contar('proyectos', q => q.eq('estado', 'en_ejecucion')),
      contar('proyectos'),
      vista('v_gerencia_compromiso_mensual').select('*').order('mes'),
      vista('v_gerencia_caja_mensual').select('*').order('mes'),
      supabase.from('proyectos').select('id, presupuesto'),
      supabase.from('fianza_cartas').select('fin, monto_afianzado, estado'),
    ]);

    // ── Tendencia: últimos 12 meses con movimiento ──────────────────────────
    const porMes = new Map<string, MesCompromiso>();
    const dame = (mes: string) => {
      if (!porMes.has(mes)) porMes.set(mes, { mes, ocPen: 0, ocUsd: 0, cajaPen: 0 });
      return porMes.get(mes)!;
    };
    for (const r of (compromiso.data ?? [])) {
      const f = dame(r.mes);
      if (r.moneda === 'USD') f.ocUsd += num(r.comprometido); else f.ocPen += num(r.comprometido);
    }
    for (const r of (cajaMensual.data ?? [])) {
      if (r.moneda === 'USD') continue; // la caja en dólares es marginal; se vería como ruido
      dame(r.mes).cajaPen += num(r.egreso);
    }
    const tendencia = [...porMes.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-12);

    // ── Comprometido del año, por moneda ────────────────────────────────────
    const delAnio = (compromiso.data ?? []).filter((r: any) => r.mes >= `${anio}-01`);
    const comprometidoAnio: Importe = {
      pen: delAnio.filter((r: any) => r.moneda !== 'USD').reduce((s: number, r: any) => s + num(r.comprometido), 0),
      usd: delAnio.filter((r: any) => r.moneda === 'USD').reduce((s: number, r: any) => s + num(r.comprometido), 0),
    };
    const cajaDelAnio = (cajaMensual.data ?? []).filter((r: any) => r.mes >= `${anio}-01`);
    const egresoAnio: Importe = {
      pen: cajaDelAnio.filter((r: any) => r.moneda !== 'USD').reduce((s: number, r: any) => s + num(r.egreso), 0),
      usd: cajaDelAnio.filter((r: any) => r.moneda === 'USD').reduce((s: number, r: any) => s + num(r.egreso), 0),
    };

    // ── Fianzas ─────────────────────────────────────────────────────────────
    const filasCartas = (cartas.data ?? []) as any[];
    const vigentes = filasCartas.filter(c => c.fin && c.fin >= hoy);
    const afianzado: Importe = {
      // Las cartas del legado están en soles salvo indicación; no hay columna de
      // moneda, así que se reporta en soles y no se inventa una conversión.
      pen: vigentes.reduce((s, c) => s + num(c.monto_afianzado), 0),
      usd: 0,
    };

    setPanel({
      compras: {
        ordenesVivas, ordenesAnio, comprometidoAnio,
        requerimientosPendientes: requerimientos, cotizaciones,
      },
      caja: { cajasAbiertas, gastosAnio, egresoAnio },
      flota: { vehiculosActivos, vehiculosTotal, otAbiertas },
      proveedores: { activos: proveedores },
      proyectos: {
        enEjecucion: proyectosEjec,
        total: proyectosTotal,
        sinPresupuesto: ((proyectosSinPpto.data ?? []) as any[])
          .filter(p => !p.presupuesto || Number(p.presupuesto) === 0).length,
      },
      fianzas: {
        cartasVigentes: vigentes.length,
        venceEn60: vigentes.filter(c => c.fin <= en60).length,
        afianzado,
      },
      tendencia,
    });
    setActualizado(new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }));
    setCargando(false);
  }, [tenantId]);

  useEffect(() => { void cargar(); }, [cargar]);

  return { panel, cargando, actualizado, recargar: cargar };
}
