import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Returns the Supabase admin client, or null if env vars are not set.
 * Uses the service role key — never expose this on the frontend.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!_client) {
    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
