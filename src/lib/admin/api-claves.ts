/** Administración › API e integraciones: claves de la API Memphis v1 (Edge Function `api`). */
import { supabase } from '../supabase/client';

export interface ApiClave {
  id: string; tenant_id: string; nombre: string; descripcion: string | null; prefijo: string; alcances: string[]; activa: boolean;
  expira_en: string | null; ultimo_uso_en: string | null; usos: number; creado_por: string | null; creado_en: string; revocada_en: string | null;
}
export interface ApiAcceso { id: number; clave_id: string | null; metodo: string; ruta: string; estado: number; ip: string | null; duracion_ms: number | null; creado_en: string }

export const MODULOS_API: { clave: string; nombre: string; recursos: string; escribir?: boolean }[] = [
  { clave: 'proyectos', nombre: 'Proyectos', recursos: 'proyectos, financiero por proyecto, valorizaciones, correspondencia, capacitaciones, certificados', escribir: true },
  { clave: 'compras', nombre: 'Compras', recursos: 'órdenes de compra, facturas' },
  { clave: 'proveedores', nombre: 'Proveedores', recursos: 'directorio de proveedores' },
  { clave: 'finanzas', nombre: 'Finanzas', recursos: 'cuentas por pagar y cobrar, pagos, bancos, caja chica, indicadores' },
  { clave: 'inventario', nombre: 'Inventario', recursos: 'artículos, unidades con serie' },
  { clave: 'flota', nombre: 'Flota', recursos: 'vehículos' },
  { clave: 'viajes', nombre: 'Viajes', recursos: 'viajes y viáticos' },
  { clave: 'fianzas', nombre: 'Fianzas', recursos: 'cartas fianza por proyecto' },
];

export const urlBaseApi = () => `${(import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')}/functions/v1/api`;

export async function cargarClaves(): Promise<ApiClave[]> {
  const { data, error } = await supabase.from('api_claves').select('*').order('creado_en', { ascending: false });
  if (error) throw error; return (data ?? []) as ApiClave[];
}
export async function cargarAccesosRecientes(dias = 7): Promise<ApiAcceso[]> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data, error } = await supabase.from('api_accesos').select('id, clave_id, metodo, ruta, estado, ip, duracion_ms, creado_en').gte('creado_en', desde).order('creado_en', { ascending: false }).limit(2000);
  if (error) throw error; return (data ?? []) as ApiAcceso[];
}
export async function crearClave(p: { nombre: string; descripcion?: string; alcances: string[]; expira?: string | null }): Promise<{ id: string; clave: string; prefijo: string }> {
  const { data, error } = await supabase.rpc('api_clave_crear', { p_nombre: p.nombre, p_descripcion: p.descripcion ?? null, p_alcances: p.alcances, p_expira: p.expira ?? null } as never);
  if (error) throw error; return data as { id: string; clave: string; prefijo: string };
}
export async function revocarClave(id: string): Promise<void> {
  const { error } = await supabase.rpc('api_clave_revocar', { p_id: id } as never);
  if (error) throw error;
}
