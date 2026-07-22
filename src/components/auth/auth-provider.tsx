"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isDemoMode, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/survey/types";
import { findTestAccount, getTestAccountByRole, testLoginEnabled, type TestAccount } from "@/lib/test-accounts";

export interface UserProfile {
  id: string;
  displayName: string;
  role: AppRole;
  active: boolean;
}

interface AuthContextValue {
  configured: boolean;
  demoMode: boolean;
  testMode: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  signInForTesting: (email: string, password: string) => TestAccount | null;
  signOut: () => Promise<void>;
}

interface TestIdentity {
  user: User;
  profile: UserProfile;
}

const TEST_ROLE_STORAGE_KEY = "ukihdp-test-role";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [testIdentity, setTestIdentity] = useState<TestIdentity | null>(null);
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
    if (!testLoginEnabled) return;
    const timer = window.setTimeout(() => {
      const savedRole = window.localStorage.getItem(TEST_ROLE_STORAGE_KEY);
      const account = savedRole
        ? getTestAccountByRole(savedRole as AppRole)
        : null;
      if (account) {
        setTestIdentity(createTestIdentity(account));
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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

  const signInForTesting = useCallback((email: string, password: string) => {
    const account = findTestAccount(email, password);
    if (!account) return null;
    window.localStorage.setItem(TEST_ROLE_STORAGE_KEY, account.role);
    setTestIdentity(createTestIdentity(account));
    setLoading(false);
    return account;
  }, []);

  const activeUser = testIdentity?.user ?? session?.user ?? null;
  const activeProfile = testIdentity?.profile ?? profile;

  const value: AuthContextValue = {
    configured: isSupabaseConfigured,
    demoMode: isDemoMode,
    testMode: Boolean(testIdentity),
    loading,
    session,
    user: activeUser,
    profile: activeProfile,
    refreshProfile: () => testIdentity ? Promise.resolve() : loadProfile(session?.user ?? null),
    signInForTesting,
    signOut: async () => {
      window.localStorage.removeItem(TEST_ROLE_STORAGE_KEY);
      setTestIdentity(null);
      if (client) await client.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

function createTestIdentity(account: TestAccount): TestIdentity {
  const id = `local-test-${account.role}`;
  return {
    user: {
      id,
      aud: "authenticated",
      role: "authenticated",
      email: account.email,
      app_metadata: { provider: "test", providers: ["test"] },
      user_metadata: { display_name: account.displayName, test_role: account.role },
      identities: [],
      created_at: new Date(0).toISOString(),
    } as User,
    profile: {
      id,
      displayName: account.displayName,
      role: account.role,
      active: true,
    },
  };
}
