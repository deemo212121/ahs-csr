'use client';

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
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
  company_id?: string;
  company_slug?: string;
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
  registerCustomerEmail: (email: string, password: string, metadata?: CustomerRegistrationMetadata) => Promise<{ confirmationRequired: boolean }>;
  // Deliberately never reveals whether the email belongs to an account —
  // tries both the customer (Supabase) and staff (Firebase) systems and
  // always resolves, so the UI can show one generic "check your email"
  // message regardless of which system (or neither) actually had a match.
  requestPasswordReset: (email: string) => Promise<void>;
  updateCustomerPassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateFilterRegions: (filterRegions: string[]) => Promise<void>;
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

  async function loadProfile(nextUser: AuthTokenUser | null): Promise<AppRole | null> {
    if (!nextUser) {
      setProfile(null);
      setRole(null);
      setHome(null);
      setLoading(false);
      return null;
    }

    if (isTestUser(nextUser)) {
      const nextProfile = createTestProfile(nextUser.role);
      setProfile(nextProfile);
      setRole(nextUser.role);
      setHome(roleHome[nextUser.role]);
      setError(null);
      setLoading(false);
      // Test accounts skip /api/me above for speed, but their saved branch
      // filter still lives server-side (keyed by the fake test firebase_uid)
      // — fetch it now so it survives a reload.
      try {
        const data = await fetchJsonWithFirebase<{ profile: AppProfile }>(nextUser, '/api/me');
        if (data.profile?.preferences) {
          setProfile((current) => current ? { ...current, preferences: data.profile.preferences } : current);
        }
      } catch {
        // Non-fatal — filter just won't be pre-loaded this session.
      }
      return nextUser.role;
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
      return data.role;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load account.');
      return null;
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
      // Despite the name, this is now also how newly-registered (Firebase)
      // customers log in — the login page tries this first regardless of
      // role, and the server resolves staff vs. customer by looking the uid
      // up (see getAuthContext). The email-verification gate only ever
      // fires for customers: staff accounts were never sent a verification
      // email in the first place, so gating on emailVerified unconditionally
      // would have locked out every existing staff account.
      loginWithStaffEmail: async (email: string, password: string) => {
        if (!firebaseAuth) {
          throw new Error('Firebase is not configured yet. Add the Firebase web app values to .env.local, then restart npm run dev.');
        }
        setStoredAuthSource('firebase');
        const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        setUser(credential.user);
        const resolvedRole = await loadProfile(credential.user);

        if (resolvedRole === 'customer' && !credential.user.emailVerified) {
          await signOut(firebaseAuth);
          setUser(null);
          setProfile(null);
          setRole(null);
          setHome(null);
          throw new Error('Please verify your email before logging in — check your inbox for the confirmation link we sent.');
        }
      },
      // Legacy path for customers who registered before the Firebase switch
      // and haven't been migrated yet — the login page falls back to this
      // only if the Firebase attempt above fails.
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
        if (!firebaseAuth) {
          throw new Error('Firebase is not configured yet. Add the Firebase web app values to .env.local, then restart npm run dev.');
        }

        const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        await sendEmailVerification(credential.user);

        // The normal /api/me flow can't resolve a profile yet — there is no
        // row until this call creates one — so this hits a dedicated
        // registration endpoint that verifies the fresh Firebase token
        // directly and writes the customer's profile row itself.
        try {
          await fetchJsonWithFirebase(credential.user, '/api/customer/register', {
            method: 'POST',
            body: JSON.stringify({
              first_name: metadata?.first_name ?? '',
              last_name: metadata?.last_name ?? '',
              phone_number: metadata?.phone_number,
              address: metadata?.address,
              region: metadata?.region,
              city: metadata?.city,
              state: metadata?.state,
              zip_code: metadata?.zip_code,
              company_id: metadata?.company_id,
              company_slug: metadata?.company_slug,
            }),
          });
        } finally {
          // Always sign back out regardless of whether the profile write
          // succeeded — they must verify their email before this account is
          // usable, matching the "confirmationRequired" UI the register page
          // already shows. (getCustomerFirebaseContext on the server would
          // also lazily create a bare-bones profile row if this write failed,
          // so nothing is unrecoverable — worst case the customer just has
          // to re-fill their profile fields after verifying.)
          await signOut(firebaseAuth);
          setUser(null);
        }

        return { confirmationRequired: true };
      },
      requestPasswordReset: async (email: string) => {
        const trimmed = email.trim();
        if (!trimmed) return;

        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          try {
            await supabase.auth.resetPasswordForEmail(trimmed, {
              redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
            });
          } catch {
            // Best-effort — never surface whether the email matched an account.
          }
        }

        if (firebaseAuth) {
          try {
            await sendPasswordResetEmail(firebaseAuth, trimmed);
          } catch {
            // Same as above — e.g. auth/user-not-found is expected and silent.
          }
        }
      },
      updateCustomerPassword: async (newPassword: string) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          throw new Error('Supabase is not configured yet.');
        }
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw new Error(updateError.message);
      },
      refreshProfile: async () => {
        await loadProfile(user);
      },
      updateFilterRegions: async (filterRegions: string[]) => {
        if (!user) return;
        setProfile((current) => current ? { ...current, preferences: { ...current.preferences, filterRegions } } : current);
        // Local state already reflects the change; if this throws, the caller
        // decides how to surface it (the filter still won't persist across
        // reloads/devices until a save succeeds).
        await fetchJsonWithFirebase(user, '/api/me/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ filterRegions }),
        });
      },
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
