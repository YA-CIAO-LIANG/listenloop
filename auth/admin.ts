import { createClient } from "@supabase/supabase-js";
import type { Supabase } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A Supabase client with the secret key: bypasses row level security, so
 * it is used on the server only and only for what users can't do
 * themselves (deleting their account). SUPABASE_SERVICE_ROLE_KEY is never
 * NEXT_PUBLIC_, so it can't reach the browser bundle. Null when unset.
 */
export function getAdminSupabase(): Supabase | null {
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseConfig || !secretKey) return null;
  return createClient<Database>(supabaseConfig.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
