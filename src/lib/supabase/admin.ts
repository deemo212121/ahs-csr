import { createClient } from '@supabase/supabase-js';

// No module-level cache — Cloudflare Workers may populate process.env after
// module evaluation (via OpenNext's populateProcessEnv on first request).
// Always read env vars at call time to avoid stale undefined values.
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL. Add your Supabase URL to .env.local.');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Add your Supabase service role key to .env.local.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
