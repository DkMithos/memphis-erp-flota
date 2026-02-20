/**
 * MÓDULO COMPRAS - Dashboard y Routing
 * Punto de entrada del módulo de gestión de compras
 */

import { useEffect } from 'react';

interface ComprasProps {
  onNavigate?: (route: string) => void;
}

export function Compras({ onNavigate }: ComprasProps) {
  // Redirigir automáticamente a requerimientos (primera pantalla del módulo)
  useEffect(() => {
    onNavigate?.('/compras/requerimientos');
  }, [onNavigate]);

  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Cargando módulo de compras...</p>
      </div>
    </div>
  );
}

// Exportar componentes reales del módulo
export * from './compras/RequerimientosLista';
export * from './compras/RequerimientoDetalle';
export * from './compras/RequerimientoForm';
export * from './compras/CotizacionesLista';
export * from './compras/CotizacionDetalle';
export * from './compras/CotizacionForm';
export * from './compras/OrdenesLista';
export * from './compras/OrdenDetalle';
export * from './compras/OrdenForm';
export * from './compras/RecepcionesLista';
export * from './compras/RecepcionDetalle';
export * from './compras/RecepcionForm';