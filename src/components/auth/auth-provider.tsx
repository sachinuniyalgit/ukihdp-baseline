"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isDemoMode, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/survey/types";

export interface UserProfile {
  id: string;
  displayName: string;
  role: AppRole;
  active: boolean;
}

interface AuthContextValue {
  configured: boolean;
  demoMode: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadProfile = useCallback(async (user: User | null) => {
    if (!client || !user) {
      setProfile(null);
      return;
    }
    const { data } = await client.from("profiles").select("id, display_name, role, active").eq("id", user.id).maybeSingle();
    setProfile(data ? { id: data.id, displayName: data.display_name, role: data.role as AppRole, active: data.active } : null);
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let mounted = true;
    client.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session?.user ?? null);
      if (mounted) setLoading(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      window.setTimeout(() => loadProfile(nextSession?.user ?? null).then(() => setLoading(false)), 0);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [client, loadProfile]);

  const value: AuthContextValue = {
    configured: isSupabaseConfigured,
    demoMode: isDemoMode,
    loading,
    session,
    user: session?.user ?? null,
    profile,
    refreshProfile: () => loadProfile(session?.user ?? null),
    signOut: async () => { if (client) await client.auth.signOut(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
