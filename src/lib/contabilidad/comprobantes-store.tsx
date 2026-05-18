/**
 * Memphis ERP — Comprobantes de Pago Store (3B)
 * Facturas, boletas, notas de crédito/débito recibidas y emitidas.
 * Alimenta automáticamente registro_compras y registro_ventas.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { calcIGV, calcBase, periodoToString } from './fiscal-peru';

export type DireccionComprobante = 'recibido' | 'emitido';
export type EstadoComprobante = 'activo' | 'anulado' | 'baja_baja';

export interface DetalleComprobante {
  id: string;
  comprobante_id: string;
  numero_linea: number;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  valor_venta: number;
  tipo_afectacion_igv: string;
  igv_linea: number;
  precio_venta: number;
  cuenta_contable: string | null;
}

export interface ComprobantePago {
  id: string;               // UUID Supabase
  tenantId: string;
  tipo: string;             // 01, 03, 07, 08 ...
  serie: string;
  numero: string;
  numeroCompleto: string;   // F001-00001
  direccion: DireccionComprobante;
  fechaEmision: string;
  fechaVencimiento: string | null;
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  rucReceptor: string | null;
  razonSocialReceptor: string | null;
  opGravada: number;
  opExonerada: number;
  opInafecta: number;
  opExportacion: number;
  subtotal: number;
  igv: number;
  otrosTributos: number;
  total: number;
  moneda: string;
  tipoCambio: number;
  tieneDetraccion: boolean;
  detraccionCodigo: string | null;
  detraccionTasa: number | null;
  detraccionMonto: number | null;
  tieneRetencion: boolean;
  retencionTasa: number | null;
  retencionMonto: number | null;
  estado: EstadoComprobante;
  asientoId: string | null;
  contabilizado: boolean;
  proveedorId: string | null;
  ordenCompraNumero: string | null;
  observaciones: string | null;
  creadoPor: string | null;
  creadoEn: string;
  detalles: DetalleComprobante[];
}

export interface DetalleInput {
  descripcion: string;
  unidad?: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  tipoAfectacionIgv?: string;
  cuentaContable?: string;
}

export interface NuevoComprobanteInput {
  tipo: string;
  serie: string;
  numero: string;
  direccion: DireccionComprobante;
  fechaEmision: string;
  fechaVencimiento?: string;
  rucEmisor?: string;
  razonSocialEmisor?: string;
  rucReceptor?: string;
  razonSocialReceptor?: string;
  moneda?: string;
  tipoCambio?: number;
  tieneDetraccion?: boolean;
  detraccionCodigo?: string;
  detraccionTasa?: number;
  tieneRetencion?: boolean;
  retencionTasa?: number;
  proveedorId?: string;
  ordenCompraNumero?: string;
  observaciones?: string;
  detalles: DetalleInput[];
}

export interface CrudResult { ok: boolean; error?: string; }

interface ComprobantesContextValue {
  comprobantes: ComprobantePago[];
  loading: boolean;
  error: string | null;
  crearComprobante: (input: NuevoComprobanteInput) => Promise<ComprobantePago>;
  anularComprobante: (id: string) => Promise<CrudResult>;
  obtenerPorId: (id: string) => ComprobantePago | undefined;
  obtenerPorPeriodo: (periodo: string) => ComprobantePago[];
  pendientesContabilizar: ComprobantePago[];
  recargar: () => void;
}

const ComprobantesCtx = createContext<ComprobantesContextValue | null>(null);

export function useComprobantesStore(): ComprobantesContextValue {
  const ctx = useContext(ComprobantesCtx);
  if (!ctx) throw new Error('useComprobantesStore fuera de ComprobantesProvider');
  return ctx;
}

function calcLinea(det: DetalleInput, igvTasa = 0.18) {
  const valorVenta = det.cantidad * det.precioUnitario - (det.descuento ?? 0);
  const afectacion = det.tipoAfectacionIgv ?? '10';
  const igvLinea = afectacion === '10' ? calcIGV(valorVenta, igvTasa) : 0;
  return { valorVenta, igvLinea, precioVenta: valorVenta + igvLinea };
}

function mapFromDB(row: any, detalles: DetalleComprobante[] = []): ComprobantePago {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tipo: row.tipo,
    serie: row.serie,
    numero: row.numero,
    numeroCompleto: row.numero_completo,
    direccion: row.direccion as DireccionComprobante,
    fechaEmision: row.fecha_emision,
    fechaVencimiento: row.fecha_vencimiento ?? null,
    rucEmisor: row.ruc_emisor ?? null,
    razonSocialEmisor: row.razon_social_emisor ?? null,
    rucReceptor: row.ruc_receptor ?? null,
    razonSocialReceptor: row.razon_social_receptor ?? null,
    opGravada: Number(row.op_gravada ?? 0),
    opExonerada: Number(row.op_exonerada ?? 0),
    opInafecta: Number(row.op_inafecta ?? 0),
    opExportacion: Number(row.op_exportacion ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    igv: Number(row.igv ?? 0),
    otrosTributos: Number(row.otros_tributos ?? 0),
    total: Number(row.total ?? 0),
    moneda: row.moneda ?? 'PEN',
    tipoCambio: Number(row.tipo_cambio ?? 1),
    tieneDetraccion: row.tiene_detraccion ?? false,
    detraccionCodigo: row.detraccion_codigo ?? null,
    detraccionTasa: row.detraccion_tasa ? Number(row.detraccion_tasa) : null,
    detraccionMonto: row.detraccion_monto ? Number(row.detraccion_monto) : null,
    tieneRetencion: row.tiene_retencion ?? false,
    retencionTasa: row.retencion_tasa ? Number(row.retencion_tasa) : null,
    retencionMonto: row.retencion_monto ? Number(row.retencion_monto) : null,
    estado: row.estado as EstadoComprobante,
    asientoId: row.asiento_id ?? null,
    contabilizado: row.contabilizado ?? false,
    proveedorId: row.proveedor_id ?? null,
    ordenCompraNumero: row.orden_compra_numero ?? null,
    observaciones: row.observaciones ?? null,
    creadoPor: row.creado_por ?? null,
    creadoEn: row.creado_en,
    detalles,
  };
}

export function ComprobantesProvider({ children }: { children: ReactNode }) {
  const { user, tenantId } = useAuth();
  const [comprobantes, setComprobantes] = useState<ComprobantePago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('comprobantes_pago')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('fecha_emision', { ascending: false })
        .limit(1000);
      if (err) throw err;
      setComprobantes((data ?? []).map(r => mapFromDB(r)));
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar comprobantes');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { cargar(); }, [cargar]);

  const crearComprobante = useCallback(async (input: NuevoComprobanteInput): Promise<ComprobantePago> => {
    if (!tenantId || !user?.id) throw new Error('Sin sesión activa');

    // Calcular totales desde líneas
    let opGravada = 0, opExonerada = 0, opInafecta = 0, opExportacion = 0, totalIgv = 0;
    const detallesCalc = input.detalles.map((det, i) => {
      const { valorVenta, igvLinea, precioVenta } = calcLinea(det);
      const afectacion = det.tipoAfectacionIgv ?? '10';
      if (afectacion === '10') opGravada += valorVenta;
      else if (afectacion === '20') opExonerada += valorVenta;
      else if (afectacion === '30') opInafecta += valorVenta;
      else if (afectacion === '40') opExportacion += valorVenta;
      totalIgv += igvLinea;
      return { det, i: i + 1, valorVenta, igvLinea, precioVenta };
    });

    const subtotal = opGravada + opExonerada + opInafecta + opExportacion;
    const total = subtotal + totalIgv + (input.tieneRetencion ? 0 : 0);
    const detraccionMonto = input.tieneDetraccion && input.detraccionTasa
      ? Math.round(total * input.detraccionTasa * 100) / 100 : null;
    const retencionMonto = input.tieneRetencion && input.retencionTasa
      ? Math.round(total * input.retencionTasa * 100) / 100 : null;

    const numeroCompleto = `${input.serie}-${input.numero.padStart(8, '0')}`;

    const { data: cab, error: e1 } = await supabase
      .from('comprobantes_pago')
      .insert({
        tenant_id: tenantId,
        tipo: input.tipo,
        serie: input.serie,
        numero: input.numero,
        numero_completo: numeroCompleto,
        direccion: input.direccion,
        fecha_emision: input.fechaEmision,
        fecha_vencimiento: input.fechaVencimiento ?? null,
        ruc_emisor: input.rucEmisor ?? null,
        razon_social_emisor: input.razonSocialEmisor ?? null,
        ruc_receptor: input.rucReceptor ?? null,
        razon_social_receptor: input.razonSocialReceptor ?? null,
        op_gravada: opGravada,
        op_exonerada: opExonerada,
        op_inafecta: opInafecta,
        op_exportacion: opExportacion,
        subtotal,
        igv: totalIgv,
        otros_tributos: 0,
        total,
        moneda: input.moneda ?? 'PEN',
        tipo_cambio: input.tipoCambio ?? 1,
        tiene_detraccion: input.tieneDetraccion ?? false,
        detraccion_codigo: input.detraccionCodigo ?? null,
        detraccion_tasa: input.detraccionTasa ?? null,
        detraccion_monto: detraccionMonto,
        tiene_retencion: input.tieneRetencion ?? false,
        retencion_tasa: input.retencionTasa ?? null,
        retencion_monto: retencionMonto,
        estado: 'activo',
        contabilizado: false,
        proveedor_id: input.proveedorId ?? null,
        orden_compra_numero: input.ordenCompraNumero ?? null,
        observaciones: input.observaciones ?? null,
        creado_por: user.id,
        creado_en: new Date().toISOString(),
      })
      .select().single();
    if (e1) throw new Error(e1.message);

    // Insertar detalles
    const detDB = detallesCalc.map(({ det, i, valorVenta, igvLinea, precioVenta }) => ({
      tenant_id: tenantId,
      comprobante_id: cab.id,
      numero_linea: i,
      descripcion: det.descripcion,
      unidad: det.unidad ?? 'NIU',
      cantidad: det.cantidad,
      precio_unitario: det.precioUnitario,
      descuento: det.descuento ?? 0,
      valor_venta: valorVenta,
      tipo_afectacion_igv: det.tipoAfectacionIgv ?? '10',
      igv_linea: igvLinea,
      precio_venta: precioVenta,
      cuenta_contable: det.cuentaContable ?? null,
    }));
    const { error: e2 } = await supabase.from('comprobantes_detalle').insert(detDB);
    if (e2) console.warn('[comprobantes] error al insertar detalles:', e2.message);

    // Insertar en registro_compras o registro_ventas
    const periodo = periodoToString(
      new Date(input.fechaEmision).getFullYear(),
      new Date(input.fechaEmision).getMonth() + 1,
    );
    if (input.direccion === 'recibido') {
      const { count } = await supabase
        .from('registro_compras')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('periodo', periodo);
      await supabase.from('registro_compras').insert({
        tenant_id: tenantId,
        periodo,
        correlativo: (count ?? 0) + 1,
        fecha_emision: input.fechaEmision,
        fecha_vencimiento: input.fechaVencimiento ?? null,
        tipo_comprobante: input.tipo,
        serie: input.serie,
        numero: input.numero,
        tipo_doc_identidad: '6',
        ruc_proveedor: input.rucEmisor ?? null,
        razon_social_proveedor: input.razonSocialEmisor ?? 'SIN NOMBRE',
        base_imponible_gravada: opGravada,
        igv: totalIgv,
        base_imponible_no_gravada: opExonerada + opInafecta,
        importe_total: total,
        moneda: input.moneda ?? 'PEN',
        tipo_cambio: input.tipoCambio ?? 1,
        comprobante_id: cab.id,
      });
    } else {
      const { count } = await supabase
        .from('registro_ventas')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('periodo', periodo);
      await supabase.from('registro_ventas').insert({
        tenant_id: tenantId,
        periodo,
        correlativo: (count ?? 0) + 1,
        fecha_emision: input.fechaEmision,
        tipo_comprobante: input.tipo,
        serie: input.serie,
        numero: input.numero,
        tipo_doc_identidad_cliente: '6',
        doc_identidad_cliente: input.rucReceptor ?? null,
        razon_social_cliente: input.razonSocialReceptor ?? null,
        base_imponible_gravada: opGravada,
        igv: totalIgv,
        base_imponible_exonerada: opExonerada,
        base_imponible_inafecta: opInafecta,
        exportacion: opExportacion,
        importe_total: total,
        moneda: input.moneda ?? 'PEN',
        tipo_cambio: input.tipoCambio ?? 1,
        comprobante_id: cab.id,
      });
    }

    const nuevo = mapFromDB(cab);
    setComprobantes(prev => [nuevo, ...prev]);
    return nuevo;
  }, [tenantId, user]);

  const anularComprobante = useCallback(async (id: string): Promise<CrudResult> => {
    const { error: err } = await supabase
      .from('comprobantes_pago')
      .update({ estado: 'anulado' })
      .eq('id', id);
    if (err) return { ok: false, error: err.message };
    setComprobantes(prev => prev.map(c => c.id === id ? { ...c, estado: 'anulado' as EstadoComprobante } : c));
    return { ok: true };
  }, []);

  const obtenerPorId = useCallback((id: string) => comprobantes.find(c => c.id === id), [comprobantes]);

  const obtenerPorPeriodo = useCallback((periodo: string) =>
    comprobantes.filter(c => {
      const p = periodoToString(
        new Date(c.fechaEmision).getFullYear(),
        new Date(c.fechaEmision).getMonth() + 1,
      );
      return p === periodo;
    }), [comprobantes]);

  const pendientesContabilizar = comprobantes.filter(c => !c.contabilizado && c.estado === 'activo');

  return (
    <ComprobantesCtx.Provider value={{ comprobantes, loading, error, crearComprobante, anularComprobante, obtenerPorId, obtenerPorPeriodo, pendientesContabilizar, recargar: cargar }}>
      {children}
    </ComprobantesCtx.Provider>
  );
}
