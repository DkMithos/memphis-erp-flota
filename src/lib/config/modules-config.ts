/**
 * Configuración de módulos habilitados/deshabilitados
 * Persiste en localStorage. Admin puede toggelar desde Administración.
 */

export interface ModuleConfig {
  id: string;
  label: string;
  descripcion: string;
  enabled: boolean;
}

export const MODULES_DEFAULT: ModuleConfig[] = [
  { id: 'dashboard',   label: 'Dashboard',      descripcion: 'Panel principal con KPIs globales',      enabled: true  },
  { id: 'flota',       label: 'Flota',           descripcion: 'Gestión de vehículos y mantenimientos',  enabled: true  },
  { id: 'biomedico',   label: 'Biomédico',       descripcion: 'Gestión de equipos biomédicos',          enabled: false },
  { id: 'compras',     label: 'Compras',         descripcion: 'Requerimientos, cotizaciones y órdenes', enabled: false },
  { id: 'proveedores', label: 'Proveedores',     descripcion: 'Directorio, contratos y evaluaciones',   enabled: false },
  { id: 'inventario',  label: 'Inventario',      descripcion: 'Artículos, almacenes y movimientos',     enabled: false },
  { id: 'finanzas',    label: 'Finanzas',        descripcion: 'Transacciones, presupuestos y reportes', enabled: false },
  { id: 'proyectos',   label: 'Proyectos',       descripcion: 'Gestión de proyectos y tareas',          enabled: false },
  { id: 'crm',         label: 'CRM',             descripcion: 'Clientes, oportunidades y actividades',  enabled: false },
  { id: 'bi',          label: 'BI & Reportería', descripcion: 'Dashboard cruzado de inteligencia',      enabled: false },
];

const STORAGE_KEY = 'kesa_modules_config';

export function loadModulesConfig(): ModuleConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return MODULES_DEFAULT;
    const saved: { id: string; enabled: boolean }[] = JSON.parse(raw);
    return MODULES_DEFAULT.map(m => {
      const override = saved.find(s => s.id === m.id);
      return override ? { ...m, enabled: override.enabled } : m;
    });
  } catch {
    return MODULES_DEFAULT;
  }
}

export function saveModulesConfig(modules: ModuleConfig[]): void {
  const toSave = modules.map(m => ({ id: m.id, enabled: m.enabled }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

export function isModuleEnabled(moduleId: string): boolean {
  const config = loadModulesConfig();
  const m = config.find(c => c.id === moduleId);
  // dashboard y admin siempre visibles
  if (moduleId === 'dashboard' || moduleId === 'admin') return true;
  return m?.enabled ?? false;
}
