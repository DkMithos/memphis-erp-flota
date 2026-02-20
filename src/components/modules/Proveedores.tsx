/**
 * MÓDULO PROVEEDORES - Dashboard y Routing
 * Punto de entrada del módulo de gestión de proveedores
 */

import { useEffect } from 'react';

interface ProveedoresProps {
  onNavigate?: (route: string) => void;
}

export function Proveedores({ onNavigate }: ProveedoresProps) {
  // Redirigir automáticamente al directorio (primera pantalla del módulo)
  useEffect(() => {
    onNavigate?.('/proveedores/directorio');
  }, [onNavigate]);

  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Cargando módulo de proveedores...</p>
      </div>
    </div>
  );
}

// Exportar componentes reales del módulo
export * from './proveedores/ProveedoresDirectorio';
export * from './proveedores/ProveedorDetalle';
export * from './proveedores/ProveedorForm';

// Exportar placeholders de submódulos (evaluaciones, contratos, talleres)
export { ProveedoresEvaluaciones, ProveedoresContratos, ProveedoresTalleres } from './placeholders';