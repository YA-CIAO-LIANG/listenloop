import { createClient } from "@supabase/supabase-js";
import type { Supabase } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A Supabase client with the public key and no session (D133): it sees
 * only what everyone may see, and reads no cookies, so what it reads can
 * be cached for every visitor (the library, official materials). Null
 * without Supabase.
 */
export function getPublicSupabase(): Supabase | null {
  if (!supabaseConfig) return null;
  return createClient<Database>(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
