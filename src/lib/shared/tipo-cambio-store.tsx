/**
 * TIPO DE CAMBIO GLOBAL — Memphis ERP
 * Provee el tipo de cambio PEN/USD usado en todo el sistema.
 *
 * La fuente de verdad es la tabla `tipos_cambio` de la base (un valor por día,
 * compartido por todos). Antes vivía en el localStorage de cada navegador, así
 * que cada PC podía tener un TC distinto. El localStorage queda solo como
 * respaldo sin conexión. Fijarlo a mano exige `finanzas.editar` (lo valida la
 * función `fijar_tipo_cambio` en la base); el job diario SUNAT/SBS lo alimenta.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabase/client';

// ============================================================================
// TIPOS
// ============================================================================

export interface TipoCambioState {
  PEN_USD: number;      // cuántos PEN vale 1 USD (tipo VENTA)
  fecha: string;        // día al que corresponde (AAAA-MM-DD)
  actualizadoEn: string;
  fuente: string;       // 'manual' | 'sunat' | 'sbs' | 'semilla…'
}

interface TipoCambioContextValue {
  tipoCambio: TipoCambioState;
  /** Fija el TC de HOY en la base (requiere finanzas.editar). */
  setTipoCambio: (tc: number) => Promise<void>;
  convertir: (monto: number, de: 'PEN' | 'USD', a: 'PEN' | 'USD') => number;
  formatear: (monto: number, moneda: 'PEN' | 'USD') => string;
  cargando: boolean;
}

const LS_KEY = 'memphis:tipo_cambio';
const hoyISO = () => new Date().toISOString().slice(0, 10);

function loadRespaldo(): TipoCambioState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TipoCambioState>;
      if (typeof p.PEN_USD === 'number' && p.PEN_USD > 0) {
        return { PEN_USD: p.PEN_USD, fecha: p.fecha ?? hoyISO(), actualizadoEn: p.actualizadoEn ?? '', fuente: p.fuente ?? 'manual' };
      }
    }
  } catch { /* ignore */ }
  // Mismo valor que la semilla de la base: no inventar un TC distinto sin conexión.
  return { PEN_USD: 3.40, fecha: hoyISO(), actualizadoEn: '', fuente: 'respaldo' };
}

function guardarRespaldo(tc: TipoCambioState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(tc)); } catch { /* almacenamiento no disponible */ }
}

// ============================================================================
// CONTEXT
// ============================================================================

const TipoCambioContext = createContext<TipoCambioContextValue | undefined>(undefined);

export function TipoCambioProvider({ children }: { children: React.ReactNode }) {
  const [tipoCambio, setTipoCambioState] = useState<TipoCambioState>(loadRespaldo);
  const [cargando, setCargando] = useState(true);

  // El último TC de la base manda sobre el respaldo local.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('tipos_cambio')
          .select('fecha, venta, fuente, creado_en')
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelado && !error && data) {
          const nuevo: TipoCambioState = {
            PEN_USD: Number(data.venta),
            fecha: data.fecha,
            actualizadoEn: data.creado_en ?? new Date().toISOString(),
            fuente: data.fuente ?? 'manual',
          };
          setTipoCambioState(nuevo);
          guardarRespaldo(nuevo);
        }
      } catch { /* sin conexión: queda el respaldo */ }
      if (!cancelado) setCargando(false);
    })();
    return () => { cancelado = true; };
  }, []);

  const setTipoCambio = useCallback(async (tc: number) => {
    const nuevo: TipoCambioState = { PEN_USD: tc, fecha: hoyISO(), actualizadoEn: new Date().toISOString(), fuente: 'manual' };
    setTipoCambioState(nuevo);
    guardarRespaldo(nuevo);
    const { error } = await (supabase as any).rpc('fijar_tipo_cambio', {
      p_fecha: nuevo.fecha, p_compra: tc, p_venta: tc, p_fuente: 'manual',
    });
    if (error) {
      console.warn('[TIPO CAMBIO] No se pudo guardar en la base:', error.message);
      throw new Error(error.message);
    }
  }, []);

  const convertir = useCallback((monto: number, de: 'PEN' | 'USD', a: 'PEN' | 'USD'): number => {
    if (de === a) return monto;
    if (de === 'USD' && a === 'PEN') return monto * tipoCambio.PEN_USD;
    return monto / tipoCambio.PEN_USD; // PEN → USD
  }, [tipoCambio]);

  const formatear = useCallback((monto: number, moneda: 'PEN' | 'USD'): string => {
    const simbolo = moneda === 'PEN' ? 'S/' : '$';
    return `${simbolo} ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  return (
    <TipoCambioContext.Provider value={{ tipoCambio, setTipoCambio, convertir, formatear, cargando }}>
      {children}
    </TipoCambioContext.Provider>
  );
}

export function useTipoCambio() {
  const ctx = useContext(TipoCambioContext);
  if (!ctx) throw new Error('useTipoCambio debe usarse dentro de <TipoCambioProvider>');
  return ctx;
}
