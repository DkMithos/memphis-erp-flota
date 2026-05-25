import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    // Deshabilitar navigator.locks — causa deadlock en ciertos navegadores/tabs
    // El no-op lock es seguro: solo pierde coordinación cross-tab (aceptable)
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return fn();
    },
  }
});
