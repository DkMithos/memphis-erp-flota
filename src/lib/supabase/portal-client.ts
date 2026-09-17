import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;

/**
 * Cliente Supabase EXCLUSIVO del Portal de Proveedores.
 * storageKey propio → la sesión del proveedor vive separada de la sesión del
 * ERP en el mismo navegador. Sin esto, abrir el portal en otra pestaña PISABA
 * la sesión del personal (mismo localStorage) y el ERP quedaba con el JWT del
 * proveedor: RLS devolvía todo vacío ("módulos en cero") y el gate mostraba
 * "cuenta pendiente de aprobación".
 * Este módulo solo se carga en rutas /portal (import lazy del componente).
 */
/**
 * El error del enlace de contraseña, capturado ANTES de crear el cliente.
 *
 * Un enlace de recuperación usado o vencido no trae tokens: trae
 * `#error=...&error_code=otp_expired`. Pero `detectSessionInUrl` borra el hash
 * en cuanto el cliente arranca, así que si se lee más tarde ya no está. Se lee
 * aquí, en la carga del módulo, que ocurre antes de que el cliente pueda tocar
 * la URL. Vale '' cuando el hash no traía error (enlace bueno o sin hash).
 */
export const errorEnlacePortal: string =
  typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error_code')
       || new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error')
       || '')
    : '';

export const portalSupabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // El enlace de contraseña redirige a /portal/clave con tokens en el hash;
    // los consume ESTE cliente (el del ERP los ignora en /portal, ver client.ts).
    detectSessionInUrl: true,
    flowType: 'implicit',
    storageKey: 'memphis-portal-auth',
    // Mismo criterio que el cliente del ERP: sin navigator.locks (deadlocks).
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return fn();
    },
  },
});
