import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;

/**
 * Cliente Supabase EXCLUSIVO del Portal de Talleres (Fase C).
 * storageKey propio → la sesión del taller vive separada de la del ERP y de la
 * del portal de proveedores en el mismo navegador (mismo motivo que
 * portal-client.ts: sin esto, un portal pisaría la sesión del personal).
 * Solo se carga en rutas /taller (import lazy del componente).
 */
export const tallerSupabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // El enlace de contraseña redirige a /taller/clave con tokens en el hash;
    // los consume ESTE cliente (el del ERP los ignora en /taller, ver client.ts).
    detectSessionInUrl: true,
    flowType: 'implicit',
    storageKey: 'memphis-taller-auth',
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return fn();
    },
  },
});
