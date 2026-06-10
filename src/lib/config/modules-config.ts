/**
 * Configuración de módulos habilitados/deshabilitados
 * Persiste en Supabase (tenants.modules_config). localStorage como fallback offline.
 */
import { supabase } from '../supabase/client';

export interface ModuleConfig {
  id: string;
  label: string;
  descripcion: string;
  enabled: boolean;
}

export const MODULES_DEFAULT: ModuleConfig[] = [
  { id: 'dashboard',   label: 'Dashboard',      descripcion: 'Panel principal con KPIs globales',      enabled: true },
  { id: 'flota',       label: 'Flota',           descripcion: 'Gestión de vehículos y mantenimientos',  enabled: true },
  { id: 'biomedico',   label: 'Biomédico',       descripcion: 'Gestión de equipos biomédicos',          enabled: true },
  { id: 'compras',     label: 'Compras',         descripcion: 'Requerimientos, cotizaciones y órdenes', enabled: true },
  { id: 'proveedores', label: 'Proveedores',     descripcion: 'Directorio, contratos y evaluaciones',   enabled: true },
  { id: 'inventario',  label: 'Inventario',      descripcion: 'Artículos, almacenes y movimientos',     enabled: true },
  { id: 'finanzas',    label: 'Finanzas',        descripcion: 'Transacciones, presupuestos y reportes', enabled: true },
  { id: 'proyectos',   label: 'Proyectos',       descripcion: 'Gestión de proyectos y tareas',          enabled: true },
  { id: 'crm',         label: 'CRM',             descripcion: 'Clientes, oportunidades y actividades',  enabled: true },
  { id: 'bi',          label: 'BI & Reportería', descripcion: 'Dashboard cruzado de inteligencia',      enabled: true },
];

const STORAGE_KEY = 'kesa_modules_config';
const ALWAYS_ON = new Set(['dashboard', 'admin']);

// ── Helpers locales (fallback offline) ───────────────────────────────────────

function mergeWithDefaults(overrides: { id: string; enabled: boolean }[]): ModuleConfig[] {
  return MODULES_DEFAULT.map(m => {
    const o = overrides.find(s => s.id === m.id);
    return o ? { ...m, enabled: o.enabled } : m;
  });
}

const LEGACY_STORAGE_KEY = 'memphis_modules_config';

export function loadModulesConfig(): ModuleConfig[] {
  try {
    // Leer de la clave nueva primero
    let raw = localStorage.getItem(STORAGE_KEY);
    // Migración: si existe la clave antigua, migrar y eliminar
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        raw = legacy;
      }
    }
    if (!raw) return MODULES_DEFAULT;
    return mergeWithDefaults(JSON.parse(raw));
  } catch {
    return MODULES_DEFAULT;
  }
}

export function saveModulesConfig(modules: ModuleConfig[]): void {
  const toSave = modules.map(m => ({ id: m.id, enabled: m.enabled }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* almacenamiento no disponible — ignorar */ }
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
): Promise<{ ok: boolean; dbSaved: boolean; error?: string }> {
  const toSave = modules.map(m => ({ id: m.id, enabled: m.enabled }));
  // Always save to localStorage first (works offline / as fallback)
  saveModulesConfig(modules);

  const { error } = await supabase
    .from('tenants')
    .update({ modules_config: toSave })
    .eq('id', tenantId);

  if (error) {
    console.warn('[modules] DB save failed (localStorage OK):', error.message);
    return { ok: true, dbSaved: false, error: error.message };
  }
  return { ok: true, dbSaved: true };
}

export function isModuleEnabled(moduleId: string): boolean {
  if (ALWAYS_ON.has(moduleId)) return true;
  const config = loadModulesConfig();
  return config.find(c => c.id === moduleId)?.enabled ?? false;
}
