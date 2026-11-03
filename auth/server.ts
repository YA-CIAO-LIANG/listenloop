import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Supabase } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The Supabase client for Server Components, Server Actions, and Route
 * Handlers, acting as the signed-in user (session from cookies). Lives
 * outside lib/ because it reads and writes cookies. Null when accounts
 * aren't configured.
 */
export async function getServerSupabase(): Promise<Supabase | null> {
  if (!supabaseConfig) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't set cookies; the proxy (b2) refreshes
            // the session on every request instead.
          }
        },
      },
    },
  );
}
