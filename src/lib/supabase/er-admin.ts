import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedErAdminClient: SupabaseClient | null = null;

export function isErSupabaseConfigured() {
  return Boolean(
    process.env.ER_SUPABASE_URL?.trim() &&
      process.env.ER_SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function getErSupabaseAdmin() {
  const supabaseUrl = process.env.ER_SUPABASE_URL;
  const serviceRoleKey = process.env.ER_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  cachedErAdminClient ??= createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedErAdminClient;
}
