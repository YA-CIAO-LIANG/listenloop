import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
import type { Database } from "./database.types";

export type Supabase = SupabaseClient<Database>;

let client: Supabase | null = null;

/**
 * The Supabase client for Client Components (one per page load; the
 * session lives in cookies shared with the server). Null when accounts
 * aren't configured.
 */
export function getBrowserSupabase(): Supabase | null {
  if (!supabaseConfig) return null;
  client ??= createBrowserClient<Database>(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
  );
  return client;
}
