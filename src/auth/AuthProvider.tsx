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
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("[auth.loadProfile]", error.message);
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

    // Timeout de seguridad: si Supabase tarda >5s, intentar recuperar de localStorage
    const safetyTimer = setTimeout(async () => {
      if (mounted && loading) {
        console.warn('[auth] getSession timeout — recuperando sesión de localStorage');
        const recovered = recoverSessionFromStorage();
        if (recovered?.user && recovered.access_token && recovered.refresh_token) {
          console.log('[auth] Sesión recuperada de localStorage para', recovered.user.email);

          // CRÍTICO: setear la sesión en el Supabase client para que los queries posteriores
          // tengan el token de auth (RLS). Sin esto, supabase.from() no tiene autenticación.
          try {
            const { error: setErr } = await supabase.auth.setSession({
              access_token: recovered.access_token,
              refresh_token: recovered.refresh_token,
            });
            if (setErr) {
              console.warn('[auth] setSession falló, usando fetch directo:', setErr.message);
              // Si setSession falla (navigator.locks), usar fetch directo como fallback
              setSession(recovered as any);
              await loadProfileDirect(recovered.user.id, recovered.access_token);
            } else {
              console.log('[auth] Sesión restaurada en Supabase client exitosamente');
              // setSession + loadProfile se manejarán via onAuthStateChange callback
              // pero seteamos manualmente por si el callback no dispara
              setSession(recovered as any);
              await loadProfile(recovered.user.id);
            }
          } catch (setSessionErr) {
            console.warn('[auth] setSession excepción, usando fetch directo:', setSessionErr);
            setSession(recovered as any);
            await loadProfileDirect(recovered.user.id, recovered.access_token);
          }
        }
        if (mounted) setLoading(false);
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
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[auth] signOut API error (ignorando):', err);
      } finally {
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
