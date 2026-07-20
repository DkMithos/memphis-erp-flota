import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Reintento para lecturas idempotentes (GET): un blip de red o un 5xx transitorio
// no debe dejar un store cacheado con listas vacías hasta recargar la página.
// Las escrituras (POST/PATCH/DELETE) NO se reintentan aquí — no son idempotentes.
const fetchConReintento: typeof fetch = async (input, init) => {
  const method = (init?.method ?? "GET").toUpperCase();
  const maxIntentos = method === "GET" ? 3 : 1;
  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const res = await fetch(input, init);
      if (
        method === "GET" &&
        intento < maxIntentos &&
        (res.status === 429 || res.status >= 500)
      ) {
        await new Promise((r) => setTimeout(r, 400 * intento));
        continue;
      }
      return res;
    } catch (err) {
      if (intento < maxIntentos) {
        await new Promise((r) => setTimeout(r, 400 * intento));
        continue;
      }
      throw err;
    }
  }
  // inalcanzable — el loop siempre retorna o lanza
  throw new Error("fetchConReintento: sin intentos");
};

export const supabase = createClient<Database>(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // En rutas /portal el hash de la URL (enlace de contraseña del proveedor)
    // pertenece al cliente del portal (portal-client.ts) — este cliente NO debe
    // consumirlo, o la sesión del proveedor pisaría la del personal del ERP.
    detectSessionInUrl: !window.location.pathname.startsWith('/portal'),
    flowType: 'implicit',
    // navigator.locks DESHABILITADO (no-op): con el lock activo, las consultas
    // que corren mientras el auth client sostiene el lock (login, refresh) se
    // quedan colgadas — verificado: usePermissions moría por timeout y la carga
    // en frío tardaba >14s y aterrizaba sin data. El riesgo multi-pestaña que el
    // lock mitigaba (dos pestañas rotando el mismo refresh token → Supabase lo
    // revoca por reuso → sesión anónima → módulos "sin data") se cubre con el
    // listener de 'storage' del AuthProvider, que adopta el token renovado por
    // otra pestaña en vez de renovar uno ya rotado.
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return fn();
    },
  },
  global: { fetch: fetchConReintento },
});
