/**
 * OBLIGACIONES FINANCIERAS — préstamos de socios y terceros, cheques diferidos,
 * letras, deuda tributaria y fraccionamientos de SUNAT. Cada obligación tiene su
 * cronograma de cuotas; cada cuota es un compromiso del flujo (categoría
 * `financiamiento`) que se ve en Cuentas por pagar y se paga por lotes. La
 * lógica vive en la base (`obligacion_*`); aquí solo lecturas y llamadas.
 */
import { supabase } from '../supabase/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;
const lanzar = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
const num = (v: unknown) => Number(v ?? 0);

export type TipoObligacion = 'prestamo' | 'cheque_diferido' | 'letra' | 'deuda_tributaria' | 'fraccionamiento' | 'otro';
export type EstadoObligacion = 'vigente' | 'vencida' | 'pagada' | 'renegociada' | 'anulada';

export const TIPO_LABEL: Record<TipoObligacion, string> = {
  prestamo: 'Préstamo', cheque_diferido: 'Cheque diferido', letra: 'Letra de cambio',
  deuda_tributaria: 'Deuda tributaria', fraccionamiento: 'Fraccionamiento SUNAT', otro: 'Otro',
};
export const ESTADO_LABEL: Record<EstadoObligacion, string> = {
  vigente: 'Vigente', vencida: 'Vencida', pagada: 'Pagada', renegociada: 'Renegociada', anulada: 'Anulada',
};

export interface Obligacion {
  id: string; numero: string; tipo: TipoObligacion; acreedor: string; proveedorId: string | null; proveedorRazonSocial: string | null;
  concepto: string | null; documento: string | null; moneda: string; capital: number; interesTotal: number; tasaInteres: number | null;
  interesTipo: string | null; penalidad: string | null; fechaContrato: string | null; fechaVencimiento: string | null;
  estado: EstadoObligacion; area: string; cdc: string | null; centroCostoId: string | null; proyectoId: string | null;
  observaciones: string | null; origenArchivo: string | null;
  cuotas: number; cuotasPagadas: number; total: number; pagado: number; saldo: number; proximoVencimiento: string | null; vencido: number;
  creadoEn: string;
}

export interface Cuota {
  id: string; obligacionId: string; numero: number; vencimiento: string; capital: number; interes: number; total: number;
  estado: 'pendiente' | 'pagada' | 'anulada'; pagado: number; fechaPago: string | null; compromisoId: string | null;
  compromisoEstado: string | null; vencida: boolean; notas: string | null;
}

function mapOblig(r: Record<string, any>): Obligacion {
  return {
    id: r.id, numero: r.numero, tipo: r.tipo, acreedor: r.acreedor, proveedorId: r.proveedor_id ?? null, proveedorRazonSocial: r.proveedor_razon_social ?? null,
    concepto: r.concepto ?? null, documento: r.documento ?? null, moneda: r.moneda ?? 'PEN', capital: num(r.capital), interesTotal: num(r.interes_total),
    tasaInteres: r.tasa_interes == null ? null : num(r.tasa_interes), interesTipo: r.interes_tipo ?? null, penalidad: r.penalidad ?? null,
    fechaContrato: r.fecha_contrato ?? null, fechaVencimiento: r.fecha_vencimiento ?? null, estado: r.estado, area: r.area ?? 'ADMINISTRACION',
    cdc: r.cdc ?? null, centroCostoId: r.centro_costo_id ?? null, proyectoId: r.proyecto_id ?? null, observaciones: r.observaciones ?? null,
    origenArchivo: r.origen_archivo ?? null, cuotas: num(r.cuotas), cuotasPagadas: num(r.cuotas_pagadas), total: num(r.total), pagado: num(r.pagado),
    saldo: num(r.saldo), proximoVencimiento: r.proximo_vencimiento ?? null, vencido: num(r.vencido), creadoEn: r.creado_en,
  };
}
function mapCuota(r: Record<string, any>): Cuota {
  return {
    id: r.id, obligacionId: r.obligacion_id, numero: num(r.numero), vencimiento: r.vencimiento, capital: num(r.capital), interes: num(r.interes), total: num(r.total),
    estado: r.estado, pagado: num(r.pagado), fechaPago: r.fecha_pago ?? null, compromisoId: r.compromiso_id ?? null, compromisoEstado: r.compromiso_estado ?? null,
    vencida: Boolean(r.vencida), notas: r.notas ?? null,
  };
}

export async function cargarObligaciones(): Promise<Obligacion[]> {
  const { data, error } = await db.from('v_obligaciones').select('*').order('estado').order('fecha_vencimiento', { ascending: true, nullsFirst: false });
  lanzar(error);
  return ((data ?? []) as Record<string, any>[]).map(mapOblig);
}

export async function cargarCuotas(obligacionId: string): Promise<Cuota[]> {
  const { data, error } = await db.from('v_obligaciones_cuotas').select('*').eq('obligacion_id', obligacionId).order('numero');
  lanzar(error);
  return ((data ?? []) as Record<string, any>[]).map(mapCuota);
}

export interface ObligacionInput {
  id?: string; tipo: TipoObligacion; acreedor: string; proveedor_id?: string | null; concepto?: string; documento?: string; moneda: string;
  capital: number; interes_total?: number; tasa_interes?: number | null; interes_tipo?: string | null; penalidad?: string | null;
  fecha_contrato?: string | null; fecha_vencimiento?: string | null; area?: string; cdc?: string | null; centro_costo_id?: string | null;
  proyecto_id?: string | null; observaciones?: string | null;
}

export async function guardarObligacion(p: ObligacionInput): Promise<string> {
  const { data, error } = await db.rpc('obligacion_guardar', { p });
  lanzar(error);
  return data as string;
}

export async function generarCuotas(id: string, n: number, primerVencimiento: string, periodicidad: 'mensual' | 'unica' = 'mensual'): Promise<number> {
  const { data, error } = await db.rpc('obligacion_cuotas_generar', { p_id: id, p_n: n, p_primer_vencimiento: primerVencimiento, p_periodicidad: periodicidad });
  lanzar(error);
  return Number(data ?? 0);
}

export async function marcarCuotaPagada(cuotaId: string, fecha: string, monto?: number | null, nota?: string): Promise<void> {
  const { error } = await db.rpc('obligacion_cuota_marcar_pagada', { p_cuota: cuotaId, p_fecha: fecha, p_monto: monto ?? null, p_nota: nota ?? null });
  lanzar(error);
}

export async function cambiarEstadoObligacion(id: string, estado: 'vigente' | 'anulada' | 'renegociada' | 'pagada', nota?: string): Promise<void> {
  const { error } = await db.rpc('obligacion_estado', { p_id: id, p_estado: estado, p_nota: nota ?? null });
  lanzar(error);
}
