import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase/client";
import type { Profile } from "../lib/supabase/types";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantLogoUrl: string | null;
  tenantColor: string | null;
  loading: boolean;

  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithAzure: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [tenantColor, setTenantColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const profileLoadedRef = useRef(false);

  // Carga de perfil usando el cliente Supabase (funciona cuando auth está sano)
  async function loadProfile(userId: string) {
    try {
      // maybeSingle: las cuentas del portal de proveedores NO tienen profile
      // interno por diseño (N21) — sin fila no es un error.
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("[auth.loadProfile]", error.message);
        setProfile(null);
        setTenantName(null);
        setTenantLogoUrl(null);
        setTenantColor(null);
        return;
      }

      setProfile(data);
      profileLoadedRef.current = true;
      // Cargar nombre del tenant (query resiliente — no bloquea auth si falla)
      if (data?.tenant_id) {
        try {
          // Intentar con logo_url primero
          let tenantResult = await supabase
            .from("tenants")
            .select("nombre, logo_url")
            .eq("id", data.tenant_id)
            .single();
          // Si falla (columna no existe), reintentar solo con nombre
          if (tenantResult.error) {
            console.warn('[auth] Tenant query con logo_url falló, reintentando sin logo_url:', tenantResult.error.message);
            tenantResult = await supabase
              .from("tenants")
              .select("nombre")
              .eq("id", data.tenant_id)
              .single();
          }
          if (tenantResult.data) {
            setTenantName(tenantResult.data.nombre ?? null);
            setTenantLogoUrl((tenantResult.data as any)?.logo_url ?? null);
          }
          setTenantColor(null);
        } catch (tenantErr) {
          console.warn('[auth] Error cargando tenant (no bloquea auth):', tenantErr);
          setTenantColor(null);
        }
      }
    } catch (err) {
      console.error('[auth.loadProfile] Unexpected error:', err);
      // No limpiar profile si ya se cargó exitosamente (lock error en otro tab)
      if (!profileLoadedRef.current) {
        setProfile(null);
        setTenantName(null);
        setTenantLogoUrl(null);
        setTenantColor(null);
      }
    }
  }

  // Carga de perfil usando fetch() directo — bypasea navigator.locks del Supabase client
  // Se usa SOLO cuando el Supabase client está colgado y recuperamos sesión de localStorage
  async function loadProfileDirect(userId: string, accessToken: string) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const headers = {
      'apikey': anonKey,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    try {
      // Cargar perfil
      const profileRes = await fetch(
        `${url}/rest/v1/profiles?id=eq.${userId}&select=*`,
        { headers, method: 'GET' }
      );
      if (!profileRes.ok) {
        console.error('[auth.loadProfileDirect] Profile fetch failed:', profileRes.status);
        setProfile(null);
        return;
      }
      const profiles = await profileRes.json();
      if (!profiles || profiles.length === 0) {
        console.error('[auth.loadProfileDirect] No profile found for', userId);
        setProfile(null);
        return;
      }
      const profileData = profiles[0];
      setProfile(profileData);
      profileLoadedRef.current = true;
      console.log('[auth] Profile cargado via fetch directo:', profileData.full_name || userId);

      // Cargar tenant (resiliente — no bloquea auth si falla)
      if (profileData?.tenant_id) {
        try {
          let tenantRes = await fetch(
            `${url}/rest/v1/tenants?id=eq.${profileData.tenant_id}&select=nombre,logo_url`,
            { headers, method: 'GET' }
          );
          // Si falla (columna logo_url no existe o RLS), reintentar solo con nombre
          if (!tenantRes.ok) {
            console.warn('[auth] Tenant fetch con logo_url falló (status', tenantRes.status, '), reintentando sin logo_url');
            tenantRes = await fetch(
              `${url}/rest/v1/tenants?id=eq.${profileData.tenant_id}&select=nombre`,
              { headers, method: 'GET' }
            );
          }
          if (tenantRes.ok) {
            const tenants = await tenantRes.json();
            if (tenants && tenants.length > 0) {
              setTenantName(tenants[0]?.nombre ?? null);
              setTenantLogoUrl(tenants[0]?.logo_url ?? null);
              setTenantColor(null);
            }
          } else {
            console.warn('[auth] Tenant fetch falló completamente (no bloquea auth)');
          }
        } catch (tenantErr) {
          console.warn('[auth] Error cargando tenant via fetch (no bloquea auth):', tenantErr);
        }
      }
    } catch (err) {
      console.error('[auth.loadProfileDirect] Error:', err);
      if (!profileLoadedRef.current) {
        setProfile(null);
        setTenantName(null);
        setTenantLogoUrl(null);
        setTenantColor(null);
      }
    }
  }

  // Sincroniza grupos de Entra ID → roles ERP vía Edge Function ms-user-sync.
  // Resiliente: nunca bloquea el login si falla (el usuario entra con sus roles actuales).
  async function syncMicrosoftRoles(accessToken: string, providerToken: string) {
    try {
      const { error } = await supabase.functions.invoke('ms-user-sync', {
        body: { providerToken },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) {
        console.warn('[auth] ms-user-sync error (no bloquea login):', error.message);
      } else {
        console.log('[auth] Roles Microsoft sincronizados');
        // Recargar perfil para reflejar roles recién asignados
        const { data } = await supabase.auth.getUser();
        if (data?.user) await loadProfile(data.user.id);
      }
    } catch (err) {
      console.warn('[auth] ms-user-sync excepción (no bloquea login):', err);
    }
  }

  useEffect(() => {
    let mounted = true;

    // Fallback: leer sesión directamente de localStorage cuando getSession() cuelga
    function recoverSessionFromStorage() {
      try {
        // Buscar la key de Supabase en localStorage
        const keys = Object.keys(localStorage);
        const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (!sbKey) return null;
        const raw = localStorage.getItem(sbKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.access_token || !parsed?.user) return null;
        // Verificar que no esté expirado
        const exp = parsed.expires_at;
        if (exp && exp * 1000 < Date.now()) return null;
        return parsed as Session;
      } catch {
        return null;
      }
    }

    // Timeout de seguridad: si Supabase tarda >5s, recuperar sesión de localStorage.
    // CRÍTICO: cada await va con Promise.race + timeout, y setLoading(false) en
    // finally — así la UI nunca queda atrapada en "Iniciando sesión..." aunque
    // los locks de Supabase/IndexedDB estén colgados.
    const raceWithTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
      Promise.race<T>([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))])
        .catch(() => fallback);

    const safetyTimer = setTimeout(async () => {
      if (!(mounted && loading)) return;
      console.warn('[auth] getSession timeout — recuperando sesión de localStorage');
      try {
        const recovered = recoverSessionFromStorage();
        if (recovered?.user && recovered.access_token && recovered.refresh_token) {
          console.log('[auth] Sesión recuperada de localStorage para', recovered.user.email);

          // 1) Sincronizar el Supabase client ANTES de publicar la sesión en React.
          //    Si publicamos con el cliente aún anónimo, los stores (gateados por
          //    tenantId) disparan sus consultas sin JWT y RLS les devuelve listas
          //    vacías SIN error → módulos "sin data" que no se recuperan hasta
          //    recargar la página. Reintentamos hasta 4 veces (~14s peor caso).
          let clienteSano = false;
          for (let intento = 1; intento <= 4 && mounted; intento++) {
            const setResult = await raceWithTimeout(
              supabase.auth.setSession({
                access_token: recovered.access_token,
                refresh_token: recovered.refresh_token,
              }),
              2000,
              { data: null, error: { message: 'setSession timeout' } } as any,
            );
            if (!setResult?.error) { clienteSano = true; break; }
            console.warn(`[auth] setSession intento ${intento}/4 falló:`, setResult.error.message);
            await new Promise(r => setTimeout(r, 1500));
          }
          if (!mounted) return;

          // 2) Publicar la sesión (desbloquea la UI) y cargar el profile
          setSession(recovered as any);
          if (clienteSano) {
            await raceWithTimeout(loadProfile(recovered.user.id), 3000, undefined as any);
          } else {
            // Modo degradado (cliente colgado >15s, muy raro): perfil por fetch
            // directo para no dejar la UI atrapada en "Iniciando sesión...".
            console.warn('[auth] Supabase client no sincronizó — perfil via fetch directo (modo degradado)');
            await raceWithTimeout(
              loadProfileDirect(recovered.user.id, recovered.access_token),
              3000,
              undefined as any,
            );
          }
        }
      } catch (err) {
        console.warn('[auth] safety timer error:', err);
      } finally {
        if (mounted) setLoading(false); // SIEMPRE — nunca dejar la UI colgada
      }
    }, 5000);

    async function initAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          // Si es un error de lock, reintentar una vez después de un breve delay
          if (error.message?.includes('Lock') || error.message?.includes('AbortError')) {
            console.warn('[auth] Lock error en getSession, reintentando...');
            await new Promise(r => setTimeout(r, 500));
            const retry = await supabase.auth.getSession();
            if (!mounted) return;
            const s2 = retry.data.session ?? null;
            setSession(s2);
            if (s2?.user) await loadProfile(s2.user.id);
          } else {
            console.error("[auth.getSession]", error);
          }
        } else {
          const s = data.session ?? null;
          setSession(s);
          if (s?.user) await loadProfile(s.user.id);
        }
      } catch (err: any) {
        // Manejar AbortError de navigator.locks (múltiples tabs)
        if (err?.name === 'AbortError' || err?.message?.includes('Lock')) {
          console.warn('[auth] Lock contention, reintentando getSession...');
          if (!mounted) return;
          await new Promise(r => setTimeout(r, 800));
          try {
            const retry = await supabase.auth.getSession();
            if (!mounted) return;
            const s = retry.data.session ?? null;
            setSession(s);
            if (s?.user) await loadProfile(s.user.id);
          } catch (retryErr) {
            console.error('[auth] Retry also failed:', retryErr);
          }
        } else {
          console.error('[auth] Unexpected error in getSession:', err);
        }
      } finally {
        clearTimeout(safetyTimer);
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    // Multi-tab sin navigator.locks: cuando OTRA pestaña renueva el token y lo
    // persiste en localStorage, esta pestaña lo adopta en vez de renovar el suyo
    // (ya rotado). Sin esto, Supabase detecta el reuso del refresh token viejo y
    // revoca la sesión de TODAS las pestañas → consultas anónimas → RLS devuelve
    // listas vacías sin error → módulos "sin data" hasta re-login.
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith('sb-') || !e.key.endsWith('-auth-token') || !e.newValue) return;
      try {
        const incoming = JSON.parse(e.newValue);
        if (!incoming?.access_token || !incoming?.refresh_token) return;
        void supabase.auth.getSession().then(({ data }) => {
          const actual = data.session;
          const esMasNuevo = (incoming.expires_at ?? 0) > (actual?.expires_at ?? 0);
          if (!actual || (incoming.access_token !== actual.access_token && esMasNuevo)) {
            void supabase.auth.setSession({
              access_token: incoming.access_token,
              refresh_token: incoming.refresh_token,
            });
          }
        });
      } catch { /* JSON inválido en storage — ignorar */ }
    };
    window.addEventListener('storage', onStorage);

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      try {
        if (newSession?.user) {
          await loadProfile(newSession.user.id);
          // Tras login con Microsoft, sincronizar grupos Entra ID → roles ERP.
          // provider_token solo está presente justo después del OAuth de Azure.
          if (newSession.provider_token) {
            void syncMicrosoftRoles(newSession.access_token, newSession.provider_token);
          }
        } else {
          setProfile(null);
          setTenantName(null);
          profileLoadedRef.current = false;
        }
      } catch (err: any) {
        // Ignorar errores de Lock en onAuthStateChange si el profile ya se cargó
        if (err?.name === 'AbortError' || err?.message?.includes('Lock')) {
          console.warn('[auth] Lock error en onAuthStateChange (ignorando, profile ya cargado)');
        } else {
          console.error('[auth] Error en onAuthStateChange:', err);
          if (!profileLoadedRef.current) {
            setProfile(null);
            setTenantName(null);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      window.removeEventListener('storage', onStorage);
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    tenantId: profile?.tenant_id ?? null,
    tenantName,
    tenantLogoUrl,
    tenantColor,
    loading,

    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },

    // SSO con Microsoft Entra ID (Azure AD).
    // Requiere el provider "azure" habilitado en Supabase Dashboard → Authentication → Providers.
    // Los scopes solicitan el perfil básico + lectura de grupos (para el mapeo grupo→rol en ms-user-sync).
    signInWithAzure: async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email openid profile User.Read GroupMember.Read.All',
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    },

    signOut: async () => {
      try {
        // scope 'local': borra la sesión local sin depender de la llamada de red
        // de revocación (que puede colgarse y dejar el token en localStorage).
        // Race con timeout para no quedar bloqueados si signOut nunca resuelve.
        await Promise.race([
          supabase.auth.signOut({ scope: 'local' }),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch (err) {
        console.warn('[auth] signOut API error (ignorando):', err);
      } finally {
        // Garantizar limpieza del token aunque signOut falle/cuelgue.
        // Sin esto, getSession() restauraría la sesión al recargar (el bug de
        // "limpiar caché varias veces para cerrar sesión").
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
            .forEach((k) => localStorage.removeItem(k));
        } catch { /* modo privado / storage bloqueado */ }

        profileLoadedRef.current = false;
        setSession(null);
        setProfile(null);
        setTenantName(null);
        setTenantLogoUrl(null);
        setTenantColor(null);
        // Hard reset para garantizar estado limpio
        window.location.href = '/';
      }
    },
  }), [session, profile, tenantName, tenantLogoUrl, tenantColor, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
