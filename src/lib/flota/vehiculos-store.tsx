/**
 * Memphis ERP - Flota → Vehículos Store
 * v4.0.0 - Conectado a Supabase (reemplaza localStorage/mock)
 * Mantiene la misma interfaz de contexto → sin cambios en componentes UI
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import type { VehiculoDB, VehiculoDocumentoDB } from '../supabase/types';
import {
  type Vehiculo,
  type EstadoVehiculo,
  type TipoVehiculo,
  type VehiculoVinculoContrato,
  type PlanPreventivoContratado,
  type VehiculoDocumento,
  type TipoContratoFlota,
  type TipoPlanPreventivo,
  type TipoDocumentoVehiculo,
  generateVehiculoId,
  normalizePlaca,
  validarVehiculo,
  validarMotivoInactivacion,
  validarVinculoContrato,
  validarPlanPreventivo,
  validarDocumento,
  logDebug,
} from './vehiculos-config';

// ============================================================================
// TYPES
// ============================================================================

interface CrudResult {
  exito: boolean;
  errores?: string[];
}

interface VehiculosContextType {
  vehiculos: Vehiculo[];
  loading: boolean;
  crearVehiculo: (data: Omit<Vehiculo, 'id' | 'creadoPor' | 'creadoEn' | 'estado'>) => Promise<{ exito: boolean; vehiculoId?: string; errores?: string[] }>;
  actualizarVehiculo: (id: string, data: Partial<Vehiculo>) => Promise<CrudResult>;
  inactivarVehiculo: (id: string, motivo: string) => Promise<CrudResult>;
  activarVehiculo: (id: string) => Promise<CrudResult>;
  obtenerVehiculo: (id: string) => Vehiculo | undefined;
  obtenerVehiculoPorToken: (token: string) => Vehiculo | undefined;
  obtenerVehiculosPorEstado: (estado: EstadoVehiculo) => Vehiculo[];
  obtenerVehiculosPorTipo: (tipo: TipoVehiculo) => Vehiculo[];
  obtenerVehiculosPorProyecto: (proyectoId: string) => Vehiculo[];
  buscarVehiculos: (query: string) => Vehiculo[];
  ensurePublicToken: (id: string) => void;
  actualizarVinculoContrato: (vehiculoId: string, vinculo: VehiculoVinculoContrato) => Promise<CrudResult>;
  actualizarPlanPreventivo: (vehiculoId: string, plan: PlanPreventivoContratado) => Promise<CrudResult>;
  agregarDocumentoVehiculo: (vehiculoId: string, documento: Omit<VehiculoDocumento, 'id' | 'creadoPor' | 'creadoEn'>) => Promise<{ exito: boolean; documentoId?: string; errores?: string[] }>;
  actualizarDocumentoVehiculo: (vehiculoId: string, documentoId: string, data: Partial<VehiculoDocumento>) => Promise<CrudResult>;
  eliminarDocumentoVehiculo: (vehiculoId: string, documentoId: string) => Promise<CrudResult>;
  obtenerDocumentosVehiculo: (vehiculoId: string) => VehiculoDocumento[];
}

const VehiculosContext = createContext<VehiculosContextType | undefined>(undefined);

// ============================================================================
// MAPPERS DB ↔ FRONTEND
// El frontend usa "id" = VH-001 (código). La DB usa UUID + columna "codigo".
// ============================================================================

function mapDocFromDB(d: VehiculoDocumentoDB): VehiculoDocumento {
  return {
    id: d.codigo,
    tipo: d.tipo as TipoDocumentoVehiculo,
    nombre: d.nombre,
    numero: d.numero ?? undefined,
    fechaEmision: d.fecha_emision ?? undefined,
    fechaVencimiento: d.fecha_vencimiento,
    archivoNombre: d.archivo_nombre ?? undefined,
    observaciones: d.observaciones ?? undefined,
    creadoPor: d.creado_por ?? undefined,
    creadoEn: d.creado_en,
    modificadoPor: d.modificado_por ?? undefined,
    modificadoEn: d.modificado_en ?? undefined,
  };
}

function mapFromDB(v: VehiculoDB, docs: VehiculoDocumentoDB[]): Vehiculo {
  return {
    id: v.codigo,
    placa: v.placa,
    vin: v.vin ?? undefined,
    tipo: v.tipo as TipoVehiculo,
    marca: v.marca,
    modelo: v.modelo,
    año: v.anio,
    color: v.color,
    motor: v.motor ?? undefined,
    combustible: v.combustible as Vehiculo['combustible'],
    capacidad: v.capacidad ?? undefined,
    kilometraje: v.kilometraje,
    ubicacionActual: v.ubicacion_actual,
    estado: v.estado as EstadoVehiculo,
    ultimoMantenimiento: v.ultimo_mantenimiento ?? undefined,
    proximoMantenimiento: v.proximo_mantenimiento ?? undefined,
    publicViewEnabled: v.public_view_enabled,
    publicToken: v.public_token ?? undefined,
    proyectoId: v.proyecto_id ?? null,
    tipoFlota: v.tipo_flota ?? null,
    vinculoContrato: v.contrato_cliente_nombre ? {
      clienteNombre: v.contrato_cliente_nombre,
      proyectoNombre: v.contrato_proyecto_nombre ?? '',
      contratoNombre: v.contrato_nombre ?? '',
      tipoContrato: (v.contrato_tipo ?? 'otro') as TipoContratoFlota,
      fechaInicio: v.contrato_fecha_inicio ?? '',
      fechaFin: v.contrato_fecha_fin ?? '',
    } : undefined,
    planPreventivoContratado: v.plan_preventivo_habilitado ? {
      habilitado: v.plan_preventivo_habilitado,
      tipoPlan: (v.plan_preventivo_tipo ?? 'por_km') as TipoPlanPreventivo,
      totalPreventivosContratados: v.plan_preventivo_total_contratados ?? 0,
      intervaloKm: v.plan_preventivo_intervalo_km ?? undefined,
      intervaloMeses: v.plan_preventivo_intervalo_meses ?? undefined,
      costoTotal: v.plan_preventivo_costo_total ?? 0,
      costoPorServicio: v.plan_preventivo_costo_por_servicio ?? 0,
    } : undefined,
    // Adquisición y depreciación
    precioAdquisicion: v.precio_adquisicion ?? 0,
    fechaAdquisicion: v.fecha_adquisicion ?? null,
    valorResidual: v.valor_residual ?? 0,
    monedaAdquisicion: v.moneda_adquisicion ?? 'PEN',
    documentosVehiculo: docs.map(mapDocFromDB),
    documentos: [],  // legacy — vacío, se usa documentosVehiculo
    creadoPor: v.creado_por ?? 'sistema',
    creadoEn: v.creado_en,
    modificadoPor: v.modificado_por ?? undefined,
    modificadoEn: v.modificado_en ?? undefined,
    inactivadoPor: v.inactivado_por ?? undefined,
    inactivadoEn: v.inactivado_en ?? undefined,
    motivoInactivacion: v.motivo_inactivacion ?? undefined,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function VehiculosStoreProvider({ children }: { children: ReactNode }) {
  const { tenantId, user } = useAuth();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);

  // Carga inicial desde Supabase
  const fetchVehiculos = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('vehiculos')
        .select('*, docs:vehiculo_documentos(*)')
        .order('creado_en', { ascending: false });

      if (error) {
        console.error('[VEHICULOS] Error al cargar:', error.message, error);
      } else if (data) {
        const mapped = data.map((v: any) => mapFromDB(v, v.docs ?? []));
        setVehiculos(mapped);
        logDebug('Vehículos cargados desde Supabase:', mapped.length);
      }
    } catch (err) {
      console.error('[VEHICULOS] Error inesperado:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchVehiculos();
  }, [fetchVehiculos]);

  // ============================================================================
  // CRUD
  // ============================================================================

  const crearVehiculo = async (
    data: Omit<Vehiculo, 'id' | 'creadoPor' | 'creadoEn' | 'estado'>
  ): Promise<{ exito: boolean; vehiculoId?: string; errores?: string[] }> => {
    if (!tenantId || !user) return { exito: false, errores: ['Sin sesión activa'] };

    const placasExistentes = vehiculos.map(v => normalizePlaca(v.placa));
    const vinsExistentes = vehiculos.filter(v => v.vin).map(v => v.vin!.trim().toUpperCase());
    const validacion = validarVehiculo(data, placasExistentes, vinsExistentes);

    if (!validacion.valido) return { exito: false, errores: validacion.errores };

    const nuevoCodigo = generateVehiculoId(vehiculos);

    const { data: inserted, error } = await supabase
      .from('vehiculos')
      .insert({
        tenant_id: tenantId,
        codigo: nuevoCodigo,
        placa: normalizePlaca(data.placa),
        vin: data.vin ? data.vin.trim().toUpperCase() : null,
        tipo: data.tipo,
        marca: data.marca,
        modelo: data.modelo,
        anio: data.año,
        color: data.color,
        motor: data.motor ?? null,
        combustible: data.combustible,
        capacidad: data.capacidad ?? null,
        kilometraje: data.kilometraje,
        ubicacion_actual: data.ubicacionActual,
        estado: 'activo',
        public_view_enabled: data.publicViewEnabled ?? true,
        // Proyecto y tipo flota
        proyecto_id: data.proyectoId ?? null,
        tipo_flota: data.tipoFlota ?? null,
        // Adquisición
        precio_adquisicion: data.precioAdquisicion ?? 0,
        fecha_adquisicion: data.fechaAdquisicion ?? null,
        valor_residual: data.valorResidual ?? 0,
        moneda_adquisicion: data.monedaAdquisicion ?? 'PEN',
        // Contrato
        contrato_cliente_nombre: data.vinculoContrato?.clienteNombre ?? null,
        contrato_proyecto_nombre: data.vinculoContrato?.proyectoNombre ?? null,
        contrato_nombre: data.vinculoContrato?.contratoNombre ?? null,
        contrato_tipo: data.vinculoContrato?.tipoContrato ?? null,
        contrato_fecha_inicio: data.vinculoContrato?.fechaInicio ?? null,
        contrato_fecha_fin: data.vinculoContrato?.fechaFin ?? null,
        // Plan preventivo
        plan_preventivo_habilitado: data.planPreventivoContratado?.habilitado ?? false,
        plan_preventivo_tipo: data.planPreventivoContratado?.tipoPlan ?? null,
        plan_preventivo_total_contratados: data.planPreventivoContratado?.totalPreventivosContratados ?? 0,
        plan_preventivo_intervalo_km: data.planPreventivoContratado?.intervaloKm ?? null,
        plan_preventivo_intervalo_meses: data.planPreventivoContratado?.intervaloMeses ?? null,
        plan_preventivo_costo_total: data.planPreventivoContratado?.costoTotal ?? 0,
        plan_preventivo_costo_por_servicio: data.planPreventivoContratado?.costoPorServicio ?? 0,
        creado_por: user.id,
      })
      .select('*, docs:vehiculo_documentos(*)')
      .single();

    if (error) {
      console.error('[VEHICULOS] Error al crear:', error.message);
      return { exito: false, errores: [error.message] };
    }

    const nuevo = mapFromDB(inserted as any, (inserted as any).docs ?? []);
    setVehiculos(prev => [nuevo, ...prev]);
    logDebug('Vehículo creado:', nuevoCodigo);
    return { exito: true, vehiculoId: nuevoCodigo };
  };

  const actualizarVehiculo = async (
    id: string,
    data: Partial<Vehiculo>
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const vehiculoExistente = vehiculos.find(v => v.id === id);
    if (!vehiculoExistente) return { exito: false, errores: ['Vehículo no encontrado'] };

    if (data.placa && normalizePlaca(data.placa) !== normalizePlaca(vehiculoExistente.placa)) {
      return { exito: false, errores: ['No se permite cambiar la placa del vehículo'] };
    }

    const vehiculoActualizado = { ...vehiculoExistente, ...data };
    const placasExistentes = vehiculos.filter(v => v.id !== id).map(v => normalizePlaca(v.placa));
    const vinsExistentes = vehiculos.filter(v => v.id !== id && v.vin).map(v => v.vin!.trim().toUpperCase());
    const validacion = validarVehiculo(vehiculoActualizado, placasExistentes, vinsExistentes, id);
    if (!validacion.valido) return { exito: false, errores: validacion.errores };

    const { error } = await supabase
      .from('vehiculos')
      .update({
        tipo: data.tipo,
        marca: data.marca,
        modelo: data.modelo,
        anio: data.año,
        color: data.color,
        motor: data.motor ?? null,
        combustible: data.combustible,
        capacidad: data.capacidad ?? null,
        kilometraje: data.kilometraje,
        ubicacion_actual: data.ubicacionActual,
        public_view_enabled: data.publicViewEnabled,
        proyecto_id: data.proyectoId !== undefined ? (data.proyectoId ?? null) : undefined,
        tipo_flota: data.tipoFlota !== undefined ? (data.tipoFlota ?? null) : undefined,
        // Adquisición
        precio_adquisicion: data.precioAdquisicion !== undefined ? data.precioAdquisicion : undefined,
        fecha_adquisicion: data.fechaAdquisicion !== undefined ? (data.fechaAdquisicion ?? null) : undefined,
        valor_residual: data.valorResidual !== undefined ? data.valorResidual : undefined,
        moneda_adquisicion: data.monedaAdquisicion !== undefined ? data.monedaAdquisicion : undefined,
        contrato_cliente_nombre: data.vinculoContrato?.clienteNombre ?? null,
        contrato_proyecto_nombre: data.vinculoContrato?.proyectoNombre ?? null,
        contrato_nombre: data.vinculoContrato?.contratoNombre ?? null,
        contrato_tipo: data.vinculoContrato?.tipoContrato ?? null,
        contrato_fecha_inicio: data.vinculoContrato?.fechaInicio ?? null,
        contrato_fecha_fin: data.vinculoContrato?.fechaFin ?? null,
        plan_preventivo_habilitado: data.planPreventivoContratado?.habilitado ?? false,
        plan_preventivo_tipo: data.planPreventivoContratado?.tipoPlan ?? null,
        plan_preventivo_total_contratados: data.planPreventivoContratado?.totalPreventivosContratados ?? 0,
        plan_preventivo_intervalo_km: data.planPreventivoContratado?.intervaloKm ?? null,
        plan_preventivo_intervalo_meses: data.planPreventivoContratado?.intervaloMeses ?? null,
        plan_preventivo_costo_total: data.planPreventivoContratado?.costoTotal ?? 0,
        plan_preventivo_costo_por_servicio: data.planPreventivoContratado?.costoPorServicio ?? 0,
        modificado_por: user.id,
        modificado_en: new Date().toISOString(),
      })
      .eq('codigo', id);

    if (error) {
      console.error('[VEHICULOS] Error al actualizar:', error.message);
      return { exito: false, errores: [error.message] };
    }

    setVehiculos(prev =>
      prev.map(v => v.id === id ? { ...v, ...data, modificadoEn: new Date().toISOString() } : v)
    );
    return { exito: true };
  };

  const inactivarVehiculo = async (id: string, motivo: string): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const v = vehiculos.find(v => v.id === id);
    if (!v) return { exito: false, errores: ['Vehículo no encontrado'] };
    if (v.estado === 'inactivo') return { exito: false, errores: ['El vehículo ya está inactivo'] };

    const validacion = validarMotivoInactivacion(motivo);
    if (!validacion.valido) return { exito: false, errores: validacion.errores };

    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from('vehiculos')
      .update({
        estado: 'inactivo',
        motivo_inactivacion: motivo,
        inactivado_por: user.id,
        inactivado_en: ahora,
        modificado_por: user.id,
        modificado_en: ahora,
      })
      .eq('codigo', id);

    if (error) return { exito: false, errores: [error.message] };

    setVehiculos(prev =>
      prev.map(v => v.id === id
        ? { ...v, estado: 'inactivo', motivoInactivacion: motivo, inactivadoPor: user.id, inactivadoEn: ahora }
        : v
      )
    );
    return { exito: true };
  };

  const activarVehiculo = async (id: string): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const v = vehiculos.find(v => v.id === id);
    if (!v) return { exito: false, errores: ['Vehículo no encontrado'] };
    if (v.estado !== 'inactivo') return { exito: false, errores: ['El vehículo no está inactivo'] };

    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from('vehiculos')
      .update({
        estado: 'activo',
        motivo_inactivacion: null,
        inactivado_por: null,
        inactivado_en: null,
        modificado_por: user.id,
        modificado_en: ahora,
      })
      .eq('codigo', id);

    if (error) return { exito: false, errores: [error.message] };

    setVehiculos(prev =>
      prev.map(v => v.id === id
        ? { ...v, estado: 'activo', motivoInactivacion: undefined, inactivadoPor: undefined, inactivadoEn: undefined }
        : v
      )
    );
    return { exito: true };
  };

  // ============================================================================
  // QUERIES (síncronas — operan sobre estado local ya cargado)
  // ============================================================================

  const obtenerVehiculo = (id: string) => vehiculos.find(v => v.id === id);

  const obtenerVehiculoPorToken = (token: string) => vehiculos.find(v => v.publicToken === token);

  const obtenerVehiculosPorEstado = (estado: EstadoVehiculo) => vehiculos.filter(v => v.estado === estado);

  const obtenerVehiculosPorTipo = (tipo: TipoVehiculo) => vehiculos.filter(v => v.tipo === tipo);

  const obtenerVehiculosPorProyecto = (proyectoId: string) => vehiculos.filter(v => v.proyectoId === proyectoId);

  const buscarVehiculos = (query: string) => {
    if (!query.trim()) return vehiculos;
    const q = query.toLowerCase().trim();
    return vehiculos.filter(v =>
      v.placa.toLowerCase().includes(q) ||
      v.vin?.toLowerCase().includes(q) ||
      v.marca.toLowerCase().includes(q) ||
      v.modelo.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q)
    );
  };

  // Con Supabase el token se genera en la DB automáticamente; esta función
  // es no-op pero se mantiene para compatibilidad con los componentes.
  const ensurePublicToken = (_id: string) => {};

  // ============================================================================
  // CONTRATO Y PLAN PREVENTIVO
  // ============================================================================

  const actualizarVinculoContrato = async (
    vehiculoId: string,
    vinculo: VehiculoVinculoContrato
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const validacion = validarVinculoContrato(vinculo);
    if (!validacion.valido) return { exito: false, errores: validacion.errores };

    const { error } = await supabase
      .from('vehiculos')
      .update({
        contrato_cliente_nombre: vinculo.clienteNombre,
        contrato_proyecto_nombre: vinculo.proyectoNombre,
        contrato_nombre: vinculo.contratoNombre,
        contrato_tipo: vinculo.tipoContrato,
        contrato_fecha_inicio: vinculo.fechaInicio,
        contrato_fecha_fin: vinculo.fechaFin,
        modificado_por: user.id,
        modificado_en: new Date().toISOString(),
      })
      .eq('codigo', vehiculoId);

    if (error) return { exito: false, errores: [error.message] };

    setVehiculos(prev =>
      prev.map(v => v.id === vehiculoId ? { ...v, vinculoContrato: vinculo } : v)
    );
    return { exito: true };
  };

  const actualizarPlanPreventivo = async (
    vehiculoId: string,
    plan: PlanPreventivoContratado
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const validacion = validarPlanPreventivo(plan);
    if (!validacion.valido) return { exito: false, errores: validacion.errores };

    const { error } = await supabase
      .from('vehiculos')
      .update({
        plan_preventivo_habilitado: plan.habilitado,
        plan_preventivo_tipo: plan.tipoPlan,
        plan_preventivo_total_contratados: plan.totalPreventivosContratados,
        plan_preventivo_intervalo_km: plan.intervaloKm ?? null,
        plan_preventivo_intervalo_meses: plan.intervaloMeses ?? null,
        plan_preventivo_costo_total: plan.costoTotal ?? 0,
        plan_preventivo_costo_por_servicio: plan.costoPorServicio ?? 0,
        modificado_por: user.id,
        modificado_en: new Date().toISOString(),
      })
      .eq('codigo', vehiculoId);

    if (error) return { exito: false, errores: [error.message] };

    setVehiculos(prev =>
      prev.map(v => v.id === vehiculoId ? { ...v, planPreventivoContratado: plan } : v)
    );
    return { exito: true };
  };

  // ============================================================================
  // DOCUMENTOS
  // ============================================================================

  const agregarDocumentoVehiculo = async (
    vehiculoId: string,
    documento: Omit<VehiculoDocumento, 'id' | 'creadoPor' | 'creadoEn'>
  ): Promise<{ exito: boolean; documentoId?: string; errores?: string[] }> => {
    if (!tenantId || !user) return { exito: false, errores: ['Sin sesión activa'] };

    const vehiculoExistente = vehiculos.find(v => v.id === vehiculoId);
    if (!vehiculoExistente) return { exito: false, errores: ['Vehículo no encontrado'] };

    const validacion = validarDocumento(documento);
    if (!validacion.valido) return { exito: false, errores: validacion.errores };

    // Obtener UUID de la DB a partir del codigo
    const { data: vRow, error: vErr } = await supabase
      .from('vehiculos')
      .select('id')
      .eq('codigo', vehiculoId)
      .single();

    if (vErr || !vRow) return { exito: false, errores: ['Vehículo no encontrado en DB'] };

    const docsExistentes = vehiculoExistente.documentosVehiculo ?? [];
    const nuevoCodigo = `DOC-${Date.now().toString(36).toUpperCase()}`;

    const { data: inserted, error } = await supabase
      .from('vehiculo_documentos')
      .insert({
        tenant_id: tenantId,
        vehiculo_id: vRow.id,
        codigo: nuevoCodigo,
        tipo: documento.tipo,
        nombre: documento.nombre,
        numero: documento.numero ?? null,
        fecha_emision: documento.fechaEmision ?? null,
        fecha_vencimiento: documento.fechaVencimiento,
        archivo_nombre: documento.archivoNombre ?? null,
        observaciones: documento.observaciones ?? null,
        creado_por: user.id,
      })
      .select()
      .single();

    if (error) return { exito: false, errores: [error.message] };

    const nuevoDoc = mapDocFromDB(inserted as VehiculoDocumentoDB);
    setVehiculos(prev =>
      prev.map(v => v.id === vehiculoId
        ? { ...v, documentosVehiculo: [...(v.documentosVehiculo ?? []), nuevoDoc] }
        : v
      )
    );
    return { exito: true, documentoId: nuevoCodigo };
  };

  const actualizarDocumentoVehiculo = async (
    vehiculoId: string,
    documentoId: string,
    data: Partial<VehiculoDocumento>
  ): Promise<CrudResult> => {
    if (!user) return { exito: false, errores: ['Sin sesión activa'] };

    const vehiculoExistente = vehiculos.find(v => v.id === vehiculoId);
    if (!vehiculoExistente) return { exito: false, errores: ['Vehículo no encontrado'] };

    const docExistente = vehiculoExistente.documentosVehiculo?.find(d => d.id === documentoId);
    if (!docExistente) return { exito: false, errores: ['Documento no encontrado'] };

    const validacion = validarDocumento({ ...docExistente, ...data });
    if (!validacion.valido) return { exito: false, errores: validacion.errores };

    const { error } = await supabase
      .from('vehiculo_documentos')
      .update({
        tipo: data.tipo,
        nombre: data.nombre,
        numero: data.numero ?? null,
        fecha_emision: data.fechaEmision ?? null,
        fecha_vencimiento: data.fechaVencimiento,
        observaciones: data.observaciones ?? null,
        modificado_por: user.id,
        modificado_en: new Date().toISOString(),
      })
      .eq('codigo', documentoId);

    if (error) return { exito: false, errores: [error.message] };

    setVehiculos(prev =>
      prev.map(v => v.id === vehiculoId
        ? {
            ...v,
            documentosVehiculo: (v.documentosVehiculo ?? []).map(d =>
              d.id === documentoId ? { ...d, ...data } : d
            )
          }
        : v
      )
    );
    return { exito: true };
  };

  const eliminarDocumentoVehiculo = async (
    vehiculoId: string,
    documentoId: string
  ): Promise<CrudResult> => {
    const vehiculoExistente = vehiculos.find(v => v.id === vehiculoId);
    if (!vehiculoExistente) return { exito: false, errores: ['Vehículo no encontrado'] };

    const { error } = await supabase
      .from('vehiculo_documentos')
      .delete()
      .eq('codigo', documentoId);

    if (error) return { exito: false, errores: [error.message] };

    setVehiculos(prev =>
      prev.map(v => v.id === vehiculoId
        ? { ...v, documentosVehiculo: (v.documentosVehiculo ?? []).filter(d => d.id !== documentoId) }
        : v
      )
    );
    return { exito: true };
  };

  const obtenerDocumentosVehiculo = (vehiculoId: string): VehiculoDocumento[] =>
    vehiculos.find(v => v.id === vehiculoId)?.documentosVehiculo ?? [];

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: VehiculosContextType = {
    vehiculos,
    loading,
    crearVehiculo,
    actualizarVehiculo,
    inactivarVehiculo,
    activarVehiculo,
    obtenerVehiculo,
    obtenerVehiculoPorToken,
    obtenerVehiculosPorEstado,
    obtenerVehiculosPorTipo,
    obtenerVehiculosPorProyecto,
    buscarVehiculos,
    ensurePublicToken,
    actualizarVinculoContrato,
    actualizarPlanPreventivo,
    agregarDocumentoVehiculo,
    actualizarDocumentoVehiculo,
    eliminarDocumentoVehiculo,
    obtenerDocumentosVehiculo,
  };

  return (
    <VehiculosContext.Provider value={value}>
      {children}
    </VehiculosContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useVehiculos() {
  const context = useContext(VehiculosContext);
  if (context === undefined) {
    throw new Error('useVehiculos debe usarse dentro de VehiculosStoreProvider');
  }
  return context;
}
