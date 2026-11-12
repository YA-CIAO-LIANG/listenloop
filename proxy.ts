import type { NextRequest } from "next/server";
import { updateSession } from "@/auth/proxy-session";
import { clarityProjectId } from "@/lib/analytics-consent";
import { contentSecurityPolicy, createNonce } from "@/lib/security/csp";
import { supabaseConfig } from "@/lib/supabase/config";

/**
 * Every page request: a fresh CSP nonce (D63), passed to the page in the
 * request headers (Next.js reads it from the CSP header and adds it to
 * its scripts) and sent with the response; then the Supabase session.
 */
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const policy = contentSecurityPolicy({
    nonce,
    supabaseUrl: supabaseConfig?.url ?? null,
    development: process.env.NODE_ENV === "development",
    clarity: clarityProjectId() !== null,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);
  const response = await updateSession(request, requestHeaders);
  response.headers.set("content-security-policy", policy);
  return response;
}

export const config = {
  // Pages only: skip build assets, images, and files with an extension.
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
