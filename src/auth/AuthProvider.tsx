import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
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
      // Cargar nombre del tenant
      if (data?.tenant_id) {
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("nombre, logo_url, primary_color")
          .eq("id", data.tenant_id)
          .single();
        setTenantName(tenantData?.nombre ?? null);
        setTenantLogoUrl((tenantData as any)?.logo_url ?? null);
        setTenantColor((tenantData as any)?.primary_color ?? null);
      }
    } catch (err) {
      console.error('[auth.loadProfile] Unexpected error:', err);
      setProfile(null);
      setTenantName(null);
      setTenantLogoUrl(null);
      setTenantColor(null);
    }
  }

  useEffect(() => {
    let mounted = true;

    // Timeout de seguridad: si Supabase tarda >3s, desbloquear la app
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn('[auth] getSession timeout — unblocking app');
        setLoading(false);
      }
    }, 3000);

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) console.error("[auth.getSession]", error);

        const s = data.session ?? null;
        setSession(s);
        if (s?.user) await loadProfile(s.user.id);
      } catch (err) {
        console.error('[auth] Unexpected error in getSession:', err);
      } finally {
        clearTimeout(safetyTimer);
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      try {
        if (newSession?.user) {
          await loadProfile(newSession.user.id);
        } else {
          setProfile(null);
          setTenantName(null);
        }
      } catch (err) {
        console.error('[auth] Error en onAuthStateChange:', err);
        setProfile(null);
        setTenantName(null);
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

    signOut: async () => {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[auth] signOut API error (ignorando):', err);
      } finally {
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
