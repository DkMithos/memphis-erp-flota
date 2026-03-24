/**
 * Configuración de módulos habilitados/deshabilitados
 * Persiste en Supabase (tenants.modules_config). localStorage como fallback offline.
 * Memphis Maquinarias ERP
 */
import { supabase } from '../supabase/client';

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

const STORAGE_KEY = 'memphis_modules_config';
const ALWAYS_ON = new Set(['dashboard', 'admin']);

// ── Helpers locales (fallback offline) ───────────────────────────────────────

function mergeWithDefaults(overrides: { id: string; enabled: boolean }[]): ModuleConfig[] {
  return MODULES_DEFAULT.map(m => {
    const o = overrides.find(s => s.id === m.id);
    return o ? { ...m, enabled: o.enabled } : m;
  });
}

export function loadModulesConfig(): ModuleConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return MODULES_DEFAULT;
    return mergeWithDefaults(JSON.parse(raw));
  } catch {
    return MODULES_DEFAULT;
  }
}

export function saveModulesConfig(modules: ModuleConfig[]): void {
  const toSave = modules.map(m => ({ id: m.id, enabled: m.enabled }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

// ── Supabase (fuente de verdad) ───────────────────────────────────────────────

export async function loadModulesConfigFromDB(tenantId: string): Promise<ModuleConfig[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('modules_config')
    .eq('id', tenantId)
    .single();

  if (error || !data?.modules_config) return loadModulesConfig(); // fallback local

  const overrides = data.modules_config as { id: string; enabled: boolean }[];
  const merged = mergeWithDefaults(Array.isArray(overrides) ? overrides : []);
  // Sincronizar localStorage para acceso offline rápido
  saveModulesConfig(merged);
  return merged;
}

export async function saveModulesConfigToDB(
  tenantId: string,
  modules: ModuleConfig[]
): Promise<void> {
  const toSave = modules.map(m => ({ id: m.id, enabled: m.enabled }));
  // Optimistic local update
  saveModulesConfig(modules);
  await supabase
    .from('tenants')
    .update({ modules_config: toSave })
    .eq('id', tenantId);
}

export function isModuleEnabled(moduleId: string): boolean {
  if (ALWAYS_ON.has(moduleId)) return true;
  const config = loadModulesConfig();
  return config.find(c => c.id === moduleId)?.enabled ?? false;
}
