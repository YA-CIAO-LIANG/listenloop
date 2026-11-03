import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Refreshes the Supabase session cookies on every page request (Server
 * Components can read cookies but not write them). Pass-through when
 * accounts aren't configured.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseConfig) return response;

  const supabase = createServerClient<Database>(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Keeps CDNs from caching one user's session for another.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );
  // Verifies the token and refreshes it when it's about to expire. Must
  // run before anything reads the session.
  await supabase.auth.getClaims();
  return response;
}
