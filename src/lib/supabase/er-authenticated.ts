import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthContext } from '@/lib/auth/server';

type TokenBridgeResponse = {
  token?: string;
  expiresAt?: number;
  uid?: string;
  error?: string;
};

export function isErStaffTokenBridgeConfigured() {
  return Boolean(
    process.env.ER_SUPABASE_URL?.trim() &&
      process.env.ER_SUPABASE_ANON_KEY?.trim() &&
      process.env.ER_SUPABASE_TOKEN_URL?.trim(),
  );
}

export async function getErSupabaseForStaff(context: AuthContext): Promise<SupabaseClient> {
  if (context.profileSource !== 'er' || !context.firebaseUid || !context.firebaseIdToken) {
    throw new Error('A real ER Firebase staff login is required to post tickets. Local and demo accounts cannot post to ER.');
  }

  const supabaseUrl = process.env.ER_SUPABASE_URL?.trim();
  const anonKey = process.env.ER_SUPABASE_ANON_KEY?.trim();
  const tokenUrl = process.env.ER_SUPABASE_TOKEN_URL?.trim();
  if (!supabaseUrl || !anonKey || !tokenUrl) {
    throw new Error('ER authenticated ticket posting is not configured. Add ER_SUPABASE_ANON_KEY and ER_SUPABASE_TOKEN_URL.');
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: context.firebaseIdToken }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  const result = await response.json().catch(() => ({})) as TokenBridgeResponse;
  if (!response.ok || !result.token) {
    throw new Error(result.error || `ER token exchange failed with status ${response.status}.`);
  }
  if (result.uid && result.uid !== context.firebaseUid) {
    throw new Error('ER token exchange returned a different Firebase user identity.');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${result.token}`,
      },
    },
  });
}
