import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/auth/proxy-session";
import { getSiteSwitches } from "@/auth/site-switches";
import { openInMaintenance } from "@/lib/site-switches";
import { clarityProjectId } from "@/lib/analytics-consent";
import { contentSecurityPolicy, createNonce } from "@/lib/security/csp";
import { turnstileSiteKey } from "@/lib/turnstile";
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
    turnstile: turnstileSiteKey() !== null,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);
  const { response, isAdmin } = await updateSession(request, requestHeaders);
  response.headers.set("content-security-policy", policy);
  // Maintenance mode (D155): everyone but admins sees the maintenance
  // page (503, so search engines come back later); the session cookies
  // just refreshed are kept.
  if (
    !openInMaintenance(request.nextUrl.pathname) &&
    (await getSiteSwitches()).maintenance &&
    !(await isAdmin())
  ) {
    const page = NextResponse.rewrite(new URL("/maintenance", request.url), {
      status: 503,
      request: { headers: requestHeaders },
    });
    for (const cookie of response.cookies.getAll()) page.cookies.set(cookie);
    page.headers.set("content-security-policy", policy);
    page.headers.set("retry-after", "600");
    page.headers.set("cache-control", "no-store");
    return page;
  }
  return response;
}

export const config = {
  // Pages only: skip build assets, images, and files with an extension.
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
