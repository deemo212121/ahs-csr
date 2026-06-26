import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// No module-level cache — read env vars at call time for Cloudflare Workers
// compatibility (OpenNext populates process.env on first request, not at module load).
export function isErSupabaseConfigured() {
  return Boolean(
    process.env.ER_SUPABASE_URL?.trim() &&
      process.env.ER_SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function getErSupabaseAdmin(): SupabaseClient | null {
  const supabaseUrl = process.env.ER_SUPABASE_URL;
  const serviceRoleKey = process.env.ER_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
