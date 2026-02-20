import { Home, ChevronRight } from 'lucide-react';

interface ModuleBreadcrumbProps {
  module: string;
}

const moduleNames: Record<string, string> = {
  dashboard: 'Dashboard',
  proveedores: 'Proveedores',
  compras: 'Compras',
  inventario: 'Inventario',
  finanzas: 'Finanzas',
  proyectos: 'Proyectos',
  flota: 'Gestión de Flota',
  biomedico: 'Equipos Biomédicos',
  crm: 'CRM'
};

export function ModuleBreadcrumb({ module }: ModuleBreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      <Home className="size-4" />
      <ChevronRight className="size-4" />
      <span className="text-foreground font-medium">{moduleNames[module] || module}</span>
    </div>
  );
}
