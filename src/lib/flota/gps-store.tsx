/**
 * KESA ERP - Flota → GPS Store
 * Monitoreo GPS: últimas posiciones por vehículo + historial
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { dbGpsPosiciones } from '../supabase/helpers';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export interface UltimaPos {
  vehiculoId: string;
  vehiculoCodigo: string;
  vehiculoPlaca: string;
  vehiculoMarca?: string;
  vehiculoModelo?: string;
  latitud: number;
  longitud: number;
  velocidad: number;
  ignicion: boolean;
  evento?: string;
  fechaDispositivo: string;
  // computed
  estaMoviendo: boolean;      // velocidad > 5
  minutosDesdeUltima: number;
  sinSenal: boolean;          // > 30 min sin señal
}

export interface HistorialPunto {
  latitud: number;
  longitud: number;
  velocidad?: number;
  evento?: string;
  fechaDispositivo: string;
}

interface GPSContextValue {
  ultimasPosiciones: UltimaPos[];
  loading: boolean;
  lastSync: string | null;
  cargarPosiciones: () => Promise<void>;
  cargarHistorial: (vehiculoId: string, desde: string, hasta: string) => Promise<HistorialPunto[]>;
}

// ============================================================================
// HELPERS
// ============================================================================

function minutosDesde(fechaISO: string): number {
  const diff = Date.now() - new Date(fechaISO).getTime();
  return Math.floor(diff / 60000);
}

// ============================================================================
// CONTEXT
// ============================================================================

const GPSContext = createContext<GPSContextValue | null>(null);

export function GPSProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useAuth();
  const [ultimasPosiciones, setUltimasPosiciones] = useState<UltimaPos[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const cargarPosiciones = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await dbGpsPosiciones.listUltimasPorVehiculo(tenantId);
      if (error) {
        console.error('[gps-store] cargarPosiciones:', error.message);
        return;
      }

      // Agrupar por vehiculo_id → tomar la más reciente (ya viene ordenado DESC)
      const mapaVehiculos = new Map<string, UltimaPos>();
      for (const row of (data ?? [])) {
        if (mapaVehiculos.has(row.vehiculo_id)) continue;
        const mins = minutosDesde(row.fecha_dispositivo);
        const velocidad = row.velocidad ?? 0;
        const pos: UltimaPos = {
          vehiculoId: row.vehiculo_id,
          vehiculoCodigo: row.vehiculo?.codigo ?? '',
          vehiculoPlaca: row.vehiculo?.placa ?? '',
          vehiculoMarca: row.vehiculo?.marca ?? undefined,
          vehiculoModelo: row.vehiculo?.modelo ?? undefined,
          latitud: Number(row.latitud),
          longitud: Number(row.longitud),
          velocidad: velocidad,
          ignicion: row.ignicion ?? false,
          evento: row.evento ?? undefined,
          fechaDispositivo: row.fecha_dispositivo,
          estaMoviendo: velocidad > 5,
          minutosDesdeUltima: mins,
          sinSenal: mins > 30,
        };
        mapaVehiculos.set(row.vehiculo_id, pos);
      }
      setUltimasPosiciones(Array.from(mapaVehiculos.values()));
      setLastSync(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const cargarHistorial = useCallback(async (
    vehiculoId: string,
    desde: string,
    hasta: string,
  ): Promise<HistorialPunto[]> => {
    const { data, error } = await dbGpsPosiciones.listHistorial(vehiculoId, desde, hasta);
    if (error) {
      console.error('[gps-store] cargarHistorial:', error.message);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      latitud: Number(r.latitud),
      longitud: Number(r.longitud),
      velocidad: r.velocidad != null ? Number(r.velocidad) : undefined,
      evento: r.evento ?? undefined,
      fechaDispositivo: r.fecha_dispositivo,
    }));
  }, []);

  return (
    <GPSContext.Provider value={{ ultimasPosiciones, loading, lastSync, cargarPosiciones, cargarHistorial }}>
      {children}
    </GPSContext.Provider>
  );
}

export function useGPSStore(): GPSContextValue {
  const ctx = useContext(GPSContext);
  if (!ctx) throw new Error('useGPSStore must be used within GPSProvider');
  return ctx;
}
