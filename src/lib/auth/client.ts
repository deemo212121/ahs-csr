'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { roleHome, type AppRole } from '@/lib/types';
import type { AppProfile } from '@/lib/types';

export type AuthSource = 'test' | 'firebase' | 'supabase';

export type TestAuthUser = {
  uid: string;
  email: string;
  displayName: string;
  isTestUser: true;
  source: 'test';
  role: AppRole;
  getIdToken: () => Promise<string>;
};

export type SupabaseAuthTokenUser = {
  uid: string;
  email: string;
  displayName: string;
  source: 'supabase';
  supabaseUser: SupabaseUser;
  getIdToken: () => Promise<string>;
};

export type AuthTokenUser = FirebaseUser | TestAuthUser | SupabaseAuthTokenUser;

const testSessionKey = 'ushs_test_login_role';
const authSourceKey = 'ushs_auth_source';

const testProfileIds: Record<AppRole, string> = {
  customer: '10000000-0000-4000-8000-000000000001',
  csr: '10000000-0000-4000-8000-000000000002',
  team_leader: '10000000-0000-4000-8000-000000000003',
  csr_manager: '10000000-0000-4000-8000-000000000004',
  admin: '10000000-0000-4000-8000-000000000005',
};

const testProfileNames: Record<AppRole, { first_name: string; last_name: string; email: string; phone_number?: string }> = {
  customer: { first_name: 'Bubble', last_name: 'Max', email: 'bubblemax@gmail.com', phone_number: '9248375123' },
  csr: { first_name: 'Anne', last_name: 'Murray Lorico', email: 'murray.lorico10@gmail.com' },
  team_leader: { first_name: 'Rochelle', last_name: 'Ortiz', email: 'team.leader@ushs.local' },
  csr_manager: { first_name: 'CSR', last_name: 'Manager', email: 'manager@ushs.local' },
  admin: { first_name: 'Admin', last_name: 'Hub', email: 'admin@ushs.local' },
};

const validRoles: AppRole[] = ['customer', 'csr', 'team_leader', 'csr_manager', 'admin'];

const demoCredentials: Record<string, AppRole> = {
  'admin@ushs.local': 'admin',
  'manager@ushs.local': 'csr_manager',
  'leader@ushs.local': 'team_leader',
  'csr@ushs.local': 'csr',
  'murray.lorico10@gmail.com': 'csr',
  'customer@ushs.local': 'customer',
  'bubblemax@gmail.com': 'customer',
};

export function isTestLoginEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN !== 'false';
}

export function getStoredAuthSource(): AuthSource | null {
  if (typeof window === 'undefined') return null;
  const source = window.localStorage.getItem(authSourceKey);
  return source === 'test' || source === 'firebase' || source === 'supabase' ? source : null;
}

export function setStoredAuthSource(source: AuthSource) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(authSourceKey, source);
  }
}

export function clearStoredAuthSource() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(authSourceKey);
  }
}

export function isTestUser(user: AuthTokenUser | null): user is TestAuthUser {
  return Boolean(user && 'isTestUser' in user && user.isTestUser);
}

export function isSupabaseTokenUser(user: AuthTokenUser | null): user is SupabaseAuthTokenUser {
  return Boolean(user && 'source' in user && user.source === 'supabase');
}

export function createTestUser(role: AppRole): TestAuthUser {
  const profile = testProfileNames[role];
  return {
    uid: `test-${role}`,
    email: profile.email,
    displayName: `${profile.first_name} ${profile.last_name}`,
    isTestUser: true,
    source: 'test',
    role,
    getIdToken: async () => `test:${role}`,
  };
}

export function createSupabaseTokenUser(user: SupabaseUser, accessToken: string): SupabaseAuthTokenUser {
  return {
    uid: user.id,
    email: user.email ?? '',
    displayName: user.user_metadata?.full_name ?? user.email ?? 'Customer',
    source: 'supabase',
    supabaseUser: user,
    getIdToken: async () => `supabase:${accessToken}`,
  };
}

export function createTestProfile(role: AppRole): AppProfile {
  const profile = testProfileNames[role];
  return {
    id: testProfileIds[role],
    firebase_uid: role === 'customer' ? null : `test-${role}`,
    supabase_user_id: role === 'customer' ? '20000000-0000-4000-8000-000000000001' : null,
    role,
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    phone_number: profile.phone_number ?? null,
    is_active: true,
  };
}

export function getStoredTestUser() {
  if (!isTestLoginEnabled() || typeof window === 'undefined') return null;
  const role = window.localStorage.getItem(testSessionKey) as AppRole | null;
  return role && validRoles.includes(role) ? createTestUser(role) : null;
}

export function storeTestLogin(role: AppRole) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(testSessionKey, role);
    setStoredAuthSource('test');
  }
  return createTestUser(role);
}

export function getDemoRoleForCredentials(email: string, password: string): AppRole | null {
  if (!isTestLoginEnabled()) return null;
  if (password !== 'password123') return null;
  return demoCredentials[email.trim().toLowerCase()] ?? null;
}

export function clearTestLogin() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(testSessionKey);
  }
}

export async function fetchJsonWithFirebase<T>(user: AuthTokenUser, url: string, init: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Request failed with ${response.status}`);
  }
  return data as T;
}

export function dashboardForRole(role: AppRole) {
  return roleHome[role] ?? '/customer/dashboard';
}
