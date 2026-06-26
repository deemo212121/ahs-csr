'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { firebaseAuth } from '@/lib/firebase/client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  clearStoredAuthSource,
  clearTestLogin,
  createSupabaseTokenUser,
  createTestProfile,
  fetchJsonWithFirebase,
  getStoredAuthSource,
  getStoredTestUser,
  isTestLoginEnabled,
  isTestUser,
  setStoredAuthSource,
  storeTestLogin,
  type AuthTokenUser,
} from '@/lib/auth/client';
import type { AppProfile, AppRole } from '@/lib/types';
import { roleHome } from '@/lib/types';


type CustomerRegistrationMetadata = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  address?: string;
  region?: string;
  city?: string;
  state?: string;
  zip_code?: string;
};

type AuthState = {
  user: AuthTokenUser | null;
  profile: AppProfile | null;
  role: AppRole | null;
  home: string | null;
  loading: boolean;
  error: string | null;
  testLoginEnabled: boolean;
  loginWithTestRole: (role: AppRole) => Promise<void>;
  loginWithStaffEmail: (email: string, password: string) => Promise<void>;
  loginWithCustomerEmail: (email: string, password: string) => Promise<void>;
  registerCustomerEmail: (email: string, password: string, metadata?: CustomerRegistrationMetadata) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthTokenUser | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [home, setHome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile(nextUser: AuthTokenUser | null) {
    if (!nextUser) {
      setProfile(null);
      setRole(null);
      setHome(null);
      setLoading(false);
      return;
    }

    if (isTestUser(nextUser)) {
      const nextProfile = createTestProfile(nextUser.role);
      setProfile(nextProfile);
      setRole(nextUser.role);
      setHome(roleHome[nextUser.role]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonWithFirebase<{
        profile: AppProfile;
        role: AppRole;
        home: string;
      }>(nextUser, '/api/me');

      setProfile(data.profile);
      setRole(data.role);
      setHome(data.home);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load account.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSupabaseSession() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      setError('Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setLoading(false);
      return;
    }

    const nextUser = createSupabaseTokenUser(data.session.user, data.session.access_token);
    setUser(nextUser);
    await loadProfile(nextUser);
  }

  useEffect(() => {
    const testUser = getStoredTestUser();
    if (testUser) {
      setUser(testUser);
      void loadProfile(testUser);
      return;
    }

    const source = getStoredAuthSource();
    if (source === 'supabase') {
      void loadSupabaseSession();
      return;
    }

    if (!firebaseAuth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(firebaseAuth, async (nextUser: FirebaseUser | null) => {
      setUser(nextUser);
      if (nextUser) setStoredAuthSource('firebase');
      await loadProfile(nextUser);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      role,
      home,
      loading,
      error,
      testLoginEnabled: isTestLoginEnabled(),
      loginWithTestRole: async (nextRole: AppRole) => {
        const testUser = storeTestLogin(nextRole);
        setUser(testUser);
        await loadProfile(testUser);
      },
      loginWithStaffEmail: async (email: string, password: string) => {
        if (!firebaseAuth) {
          throw new Error('Firebase is not configured yet. Add the Firebase web app values to .env.local, then restart npm run dev.');
        }
        setStoredAuthSource('firebase');
        const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        setUser(credential.user);
        await loadProfile(credential.user);
      },
      loginWithCustomerEmail: async (email: string, password: string) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          throw new Error('Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.');
        }
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError || !data.session) throw new Error(signInError?.message ?? 'Unable to sign in customer.');
        setStoredAuthSource('supabase');
        const nextUser = createSupabaseTokenUser(data.session.user, data.session.access_token);
        setUser(nextUser);
        await loadProfile(nextUser);
      },
      registerCustomerEmail: async (email: string, password: string, metadata?: CustomerRegistrationMetadata) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          throw new Error('Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.');
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: metadata ?? {} },
        });
        if (signUpError) throw new Error(signUpError.message);
        if (data.session) {
          setStoredAuthSource('supabase');
          const nextUser = createSupabaseTokenUser(data.session.user, data.session.access_token);
          setUser(nextUser);
          await loadProfile(nextUser);
        }
      },
      refreshProfile: () => loadProfile(user),
      logout: async () => {
        if (isTestUser(user)) {
          clearTestLogin();
          clearStoredAuthSource();
          setUser(null);
          setProfile(null);
          setRole(null);
          setHome(null);
          return;
        }

        const source = getStoredAuthSource();
        if (source === 'supabase') {
          const supabase = getSupabaseBrowserClient();
          await supabase?.auth.signOut();
        }
        if (firebaseAuth) await signOut(firebaseAuth);
        clearStoredAuthSource();
        setUser(null);
        setProfile(null);
        setRole(null);
        setHome(null);
      },
    }),
    [user, profile, role, home, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
