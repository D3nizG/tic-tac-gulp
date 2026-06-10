import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function configured(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^(your-|replace-|change-me|changeme|placeholder)/i.test(trimmed)) return null;
  return trimmed;
}

export function getSupabaseServerKey(): string | null {
  return configured(process.env.SUPABASE_SECRET_KEY)
    ?? configured(process.env.SUPABASE_SERVICE_ROLE_KEY)
    ?? null;
}

/**
 * Returns the Supabase admin client, or null if env vars are not set.
 * Uses the service role key — never expose this on the frontend.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = getSupabaseServerKey();
  if (!url || !key) return null;
  if (!_client) {
    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
