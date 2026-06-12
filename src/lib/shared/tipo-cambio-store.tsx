/**
 * TIPO DE CAMBIO GLOBAL — Memphis ERP
 * Provee el tipo de cambio PEN/USD usado en todo el sistema.
 * Se actualiza manualmente (o en el futuro desde API del BCRP).
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

// ============================================================================
// TIPOS
// ============================================================================

export interface TipoCambioState {
  PEN_USD: number;  // cuántos PEN vale 1 USD
  actualizadoEn: string;
  fuente: 'manual' | 'bcrp';
}

interface TipoCambioContextValue {
  tipoCambio: TipoCambioState;
  setTipoCambio: (tc: number) => void;
  convertir: (monto: number, de: 'PEN' | 'USD', a: 'PEN' | 'USD') => number;
  formatear: (monto: number, moneda: 'PEN' | 'USD') => string;
}

const LS_KEY = 'memphis:tipo_cambio';

function loadTipoCambio(): TipoCambioState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as TipoCambioState;
  } catch { /* ignore */ }
  return { PEN_USD: 3.75, actualizadoEn: new Date().toISOString(), fuente: 'manual' };
}

// ============================================================================
// CONTEXT
// ============================================================================

const TipoCambioContext = createContext<TipoCambioContextValue | undefined>(undefined);

export function TipoCambioProvider({ children }: { children: React.ReactNode }) {
  const [tipoCambio, setTipoCambioState] = useState<TipoCambioState>(loadTipoCambio);

  const setTipoCambio = useCallback((tc: number) => {
    const nuevo: TipoCambioState = {
      PEN_USD: tc,
      actualizadoEn: new Date().toISOString(),
      fuente: 'manual',
    };
    setTipoCambioState(nuevo);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(nuevo));
    } catch { /* almacenamiento no disponible — ignorar */ }
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
    <TipoCambioContext.Provider value={{ tipoCambio, setTipoCambio, convertir, formatear }}>
      {children}
    </TipoCambioContext.Provider>
  );
}

export function useTipoCambio() {
  const ctx = useContext(TipoCambioContext);
  if (!ctx) throw new Error('useTipoCambio debe usarse dentro de <TipoCambioProvider>');
  return ctx;
}
