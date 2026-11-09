import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
import type { Database } from "./database.types";

export type Supabase = SupabaseClient<Database>;

let client: Promise<Supabase> | null = null;

/**
 * The Supabase client for Client Components (one per page load; the
 * session lives in cookies shared with the server), or null when accounts
 * aren't configured. Loaded on first use, not with every page (D120): the
 * library is the largest script the site has, and a signed-out visitor
 * only needs it to sign in. Rejects when the script can't be loaded.
 */
export function loadBrowserSupabase(): Promise<Supabase | null> {
  if (!supabaseConfig) return Promise.resolve(null);
  const { url, publishableKey } = supabaseConfig;
  client ??= import("@supabase/ssr").then(({ createBrowserClient }) =>
    createBrowserClient<Database>(url, publishableKey),
  );
  // Offline when it's first needed: forget the failure, so a later try
  // loads it again.
  return client.catch((error: unknown) => {
    client = null;
    throw error;
  });
}

/** Whether accounts are configured, without loading the client. */
export const accountsConfigured = supabaseConfig !== null;
