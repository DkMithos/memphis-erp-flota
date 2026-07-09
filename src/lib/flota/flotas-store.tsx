/**
 * Memphis ERP - Flota → Flotas Store (rediseño 2026-07)
 * Flotas por proyecto + contratos de mantenimiento + tarifario + consumo
 * (provisión vs real por vehículo, vista v_vehiculo_consumo).
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { dbFlotas, dbVehiculoConsumo } from '../supabase/helpers';
import { useAuth } from '../../auth/AuthProvider';

// ============================================================================
// TIPOS
// ============================================================================

export interface TarifaContrato {
  id: string;
  orden: number;
  kmServicio: number;
  mesEstimado: number | null;
  costo: number;
  descripcion: string | null;
}

export interface ContratoFlota {
  id: string;
  nombre: string;
  proveedorNombre: string | null;
  moneda: 'PEN' | 'USD';
  tipoCambio: number | null;
  duracionMeses: number | null;
  kmLimite: number | null;
  cantidadServicios: number | null;
  costoTotalPorVehiculo: number | null;
  modalidadPago: 'adelantado' | 'mensual';
  montoPagado: number | null;
  fechaInicio: string | null;
  estado: string;
  notas: string | null;
  tarifas: TarifaContrato[];
}

export interface Flota {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  proyectoId: string;
  descripcion: string | null;
  estado: string;
  contratos: ContratoFlota[];
}

export interface ConsumoVehiculo {
  vehiculoId: string;
  flotaId: string | null;
  contratoId: string | null;
  moneda: string | null;
  serviciosContratados: number | null;
  provisionTotal: number | null;
  serviciosEjecutados: number;
  gastado: number;
  saldoProvision: number | null;
}

interface FlotasContextType {
  flotas: Flota[];
  consumo: ConsumoVehiculo[];
  loading: boolean;
  refetch: () => Promise<void>;
  obtenerFlota: (codigoOrId: string) => Flota | undefined;
  consumoPorVehiculo: (vehiculoId: string) => ConsumoVehiculo | undefined;
  consumoPorFlota: (flotaId: string) => {
    unidades: number;
    ejecutados: number;
    contratados: number;
    gastado: number;
    provision: number;
    saldo: number;
    moneda: string;
  };
}

const FlotasContext = createContext<FlotasContextType | undefined>(undefined);

// ============================================================================
// MAPPERS
// ============================================================================

function mapContrato(c: any): ContratoFlota {
  return {
    id: c.id,
    nombre: c.nombre,
    proveedorNombre: c.proveedor_nombre ?? null,
    moneda: (c.moneda ?? 'PEN') as ContratoFlota['moneda'],
    tipoCambio: c.tipo_cambio != null ? Number(c.tipo_cambio) : null,
    duracionMeses: c.duracion_meses ?? null,
    kmLimite: c.km_limite ?? null,
    cantidadServicios: c.cantidad_servicios ?? null,
    costoTotalPorVehiculo: c.costo_total_por_vehiculo != null ? Number(c.costo_total_por_vehiculo) : null,
    modalidadPago: (c.modalidad_pago ?? 'mensual') as ContratoFlota['modalidadPago'],
    montoPagado: c.monto_pagado != null ? Number(c.monto_pagado) : null,
    fechaInicio: c.fecha_inicio ?? null,
    estado: c.estado ?? 'activo',
    notas: c.notas ?? null,
    tarifas: (c.flota_contrato_tarifas ?? [])
      .map((t: any): TarifaContrato => ({
        id: t.id,
        orden: t.orden,
        kmServicio: t.km_servicio,
        mesEstimado: t.mes_estimado ?? null,
        costo: Number(t.costo),
        descripcion: t.descripcion ?? null,
      }))
      .sort((a: TarifaContrato, b: TarifaContrato) => a.kmServicio - b.kmServicio),
  };
}

function mapFlota(f: any): Flota {
  return {
    id: f.id,
    codigo: f.codigo,
    nombre: f.nombre,
    tipo: f.tipo ?? 'otro',
    proyectoId: f.proyecto_id,
    descripcion: f.descripcion ?? null,
    estado: f.estado ?? 'activa',
    contratos: (f.flota_contratos ?? []).map(mapContrato),
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function FlotasStoreProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useAuth();
  const [flotas, setFlotas] = useState<Flota[]>([]);
  const [consumo, setConsumo] = useState<ConsumoVehiculo[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    const [fl, co] = await Promise.all([dbFlotas.list(), dbVehiculoConsumo.list()]);
    if (fl.error) {
      console.error('[FLOTAS] Error al cargar flotas:', fl.error.message);
    } else if (fl.data) {
      setFlotas((fl.data as any[]).map(mapFlota));
    }
    if (co.error) {
      console.error('[FLOTAS] Error al cargar consumo:', co.error.message);
    } else if (co.data) {
      setConsumo((co.data as any[]).map((r): ConsumoVehiculo => ({
        vehiculoId: r.vehiculo_id,
        flotaId: r.flota_id ?? null,
        contratoId: r.contrato_id ?? null,
        moneda: r.moneda ?? null,
        serviciosContratados: r.servicios_contratados ?? null,
        provisionTotal: r.provision_total != null ? Number(r.provision_total) : null,
        serviciosEjecutados: Number(r.servicios_ejecutados ?? 0),
        gastado: Number(r.gastado ?? 0),
        saldoProvision: r.saldo_provision != null ? Number(r.saldo_provision) : null,
      })));
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { refetch(); }, [refetch]);

  const obtenerFlota = useCallback(
    (codigoOrId: string) => flotas.find(f => f.codigo === codigoOrId || f.id === codigoOrId),
    [flotas],
  );

  const consumoPorVehiculo = useCallback(
    (vehiculoId: string) => consumo.find(c => c.vehiculoId === vehiculoId),
    [consumo],
  );

  const consumoPorFlota = useCallback((flotaId: string) => {
    const filas = consumo.filter(c => c.flotaId === flotaId);
    const flota = flotas.find(f => f.id === flotaId);
    const contrato = flota?.contratos.find(c => c.estado === 'activo') ?? flota?.contratos[0];
    return {
      unidades: filas.length,
      ejecutados: filas.reduce((s, c) => s + c.serviciosEjecutados, 0),
      contratados: filas.reduce((s, c) => s + (c.serviciosContratados ?? 0), 0),
      gastado: filas.reduce((s, c) => s + c.gastado, 0),
      provision: filas.reduce((s, c) => s + (c.provisionTotal ?? 0), 0),
      saldo: filas.reduce((s, c) => s + (c.saldoProvision ?? 0), 0),
      moneda: contrato?.moneda ?? 'PEN',
    };
  }, [consumo, flotas]);

  return (
    <FlotasContext.Provider value={{ flotas, consumo, loading, refetch, obtenerFlota, consumoPorVehiculo, consumoPorFlota }}>
      {children}
    </FlotasContext.Provider>
  );
}

export function useFlotas() {
  const ctx = useContext(FlotasContext);
  if (!ctx) throw new Error('useFlotas debe usarse dentro de FlotasStoreProvider');
  return ctx;
}

// Formato de moneda del módulo (S/ o US$ con 2 decimales)
export function fmtMoneda(monto: number, moneda: string | null | undefined): string {
  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  return `${simbolo} ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
