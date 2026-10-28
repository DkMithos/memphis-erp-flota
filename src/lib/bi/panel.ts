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
 * PEN y USD se muestran separados a propósito: el gasto es mayoritariamente en
 * dólares y una suma mixta en el panel engaña más de lo que ayuda (el TC SUNAT
 * diario existe y lo usan los informes que sí lo necesitan).
 *
 * Desde octubre de 2026 el ERP tiene facturas, cuentas por pagar y cobrar, pagos
 * y extracto bancario, valorizaciones, contabilidad, viajes y correspondencia:
 * `bi_panel_resumen()` los trae en una llamada y `pendientesDeAlimentar()`
 * calcula con datos (no con texto fijo) qué sigue faltando.
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

/** Lo que devuelve `bi_panel_resumen()` (una llamada, agregados del tenant). */
export interface Resumen {
  facturas: { recibidas: number; por_conformar: number; conformes: number; observadas: number; ultima_emision: string | null };
  cxp: { compromisos: number; pendiente_pen: number; pendiente_usd: number; vencido_pen: number; vencido_usd: number; vencidos: number };
  cxc: { pendientes: number; pendiente_pen: number; pendiente_usd: number };
  tesoreria: { pagos_anio: number; pagado_pen: number; pagado_usd: number; cobrado_pen: number; cobrado_usd: number };
  bancos: { movimientos: number; sin_conciliar: number; extracto_hasta: string | null; cuentas_activas: number; lotes_pago: number };
  proyectos: { con_contrato: number; contrato_total: number; cobrado_total: number; valorizaciones_cobradas: number; valorizaciones_por_cobrar: number; valorizado_cobrado_pen: number; sin_presupuesto: number };
  contabilidad: { plan_cuentas: number; periodos_abiertos: number; asientos: number; tc_fecha: string | null; facturas_sin_contabilizar: number };
  operaciones: { viajes_abiertos: number; rendiciones_por_revisar: number; cartas_pendientes: number; cartas_vencidas: number; unidades: number; unidades_en_almacen: number; unidades_instaladas: number; obligaciones: number; presupuesto_area_lineas: number; equipos_biomedicos: number; oportunidades_crm: number };
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
  resumen: Resumen | null;
}

/**
 * Lo que todavía falta alimentar, calculado con los datos de hoy. Antes era una
 * lista fija que decía "no hay facturas ni cuentas por pagar" meses después de
 * cargarlas; para Gerencia un aviso viejo es peor que ninguno.
 */
export function pendientesDeAlimentar(r: Resumen | null): { titulo: string; detalle: string; ruta?: string }[] {
  if (!r) return [];
  const out: { titulo: string; detalle: string; ruta?: string }[] = [];
  const hoy = new Date();
  const mesActual = hoy.toISOString().slice(0, 7);
  const fechaCorta = (s: string | null) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—';
  if (!r.bancos.extracto_hasta || r.bancos.extracto_hasta.slice(0, 7) < mesActual) {
    out.push({ titulo: 'Extracto bancario del mes', detalle: `La conciliación llega hasta el ${fechaCorta(r.bancos.extracto_hasta)}; falta importar el extracto BBVA del mes en curso (Finanzas › Bancos).`, ruta: '/finanzas/bancos' });
  }
  if (r.bancos.sin_conciliar > 0) {
    out.push({ titulo: `${r.bancos.sin_conciliar} movimientos del banco sin transacción`, detalle: 'Cargos o abonos del extracto que todavía no se cruzaron con un pago, factura o cobro del ERP.', ruta: '/finanzas/bancos' });
  }
  if (r.bancos.lotes_pago === 0) {
    out.push({ titulo: 'Lotes de pago', detalle: 'Todavía no se arma ningún lote en el ERP: los pagos de la semana siguen naciendo en el Excel y entran recién con el extracto.', ruta: '/finanzas/lotes-pago' });
  }
  if (r.facturas.por_conformar > 0) {
    out.push({ titulo: `${r.facturas.por_conformar} facturas de proveedores por conformar`, detalle: 'Hasta la conformidad no cuentan contra la orden ni entran a Cuentas por pagar.', ruta: '/compras/facturas' });
  }
  if (r.contabilidad.facturas_sin_contabilizar > 0) {
    out.push({ titulo: `${r.contabilidad.facturas_sin_contabilizar} facturas de 2026 sin asiento`, detalle: 'Conformes o pagadas, pero sin contabilizar: la contabilización automática espera que Contabilidad confirme cuentas y momento.', ruta: '/contabilidad' });
  }
  if (r.proyectos.sin_presupuesto > 0) {
    out.push({ titulo: `${r.proyectos.sin_presupuesto} proyectos en ejecución sin presupuesto`, detalle: 'Sin presupuesto cargado no hay control por partida ni margen previsto.', ruta: '/proyectos/presupuesto' });
  }
  if (r.operaciones.presupuesto_area_lineas === 0) {
    out.push({ titulo: 'Presupuestos de área', detalle: 'Finanzas no ha cargado presupuesto para el gasto que no es de proyecto: el control por partida solo cubre proyectos.', ruta: '/finanzas/presupuestos' });
  }
  if (r.operaciones.cartas_pendientes > 0 && r.operaciones.cartas_vencidas === 0) {
    out.push({ titulo: `${r.operaciones.cartas_pendientes} acciones de correspondencia sin fecha límite`, detalle: 'Operaciones debe ponerles plazo para que el semáforo de vencidas funcione.', ruta: '/proyectos/correspondencia' });
  }
  if (r.operaciones.equipos_biomedicos === 0 && r.operaciones.oportunidades_crm === 0) {
    out.push({ titulo: 'CRM y Biomédico', detalle: 'No se usan en Memphis: no se muestran cifras de lo que no se alimenta.' });
  }
  return out;
}

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
      compromiso, cajaMensual, proyectosSinPpto, cartas, resumenRes,
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
      (supabase as any).rpc('bi_panel_resumen'),
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
      resumen: ((resumenRes as any)?.data ?? null) as Resumen | null,
    });
    setActualizado(new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }));
    setCargando(false);
  }, [tenantId]);

  useEffect(() => { void cargar(); }, [cargar]);

  return { panel, cargando, actualizado, recargar: cargar };
}
