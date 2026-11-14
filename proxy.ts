import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/auth/proxy-session";
import { getSiteSwitches } from "@/auth/site-switches";
import { openInMaintenance } from "@/lib/site-switches";
import { clarityProjectId } from "@/lib/analytics-consent";
import { contentSecurityPolicy, createNonce } from "@/lib/security/csp";
import { turnstileSiteKey } from "@/lib/turnstile";
import { VISITOR_COOKIE, VISITOR_COOKIE_OPTIONS } from "@/lib/intent";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  isLocale,
  LOCALE_OVERRIDE_HEADER,
  LOCALE_PARAM,
} from "@/lib/i18n/config";

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
  // `?hl=en` shows this one request in that language (D167), so search
  // engines can fetch each language; only we may set the header.
  const hl = request.nextUrl.searchParams.get(LOCALE_PARAM);
  if (isLocale(hl)) requestHeaders.set(LOCALE_OVERRIDE_HEADER, hl);
  else requestHeaders.delete(LOCALE_OVERRIDE_HEADER);
  // Pricing pages: a browser without a visitor id gets one now (D174), so
  // a price experiment can show it the same price on every visit; the
  // page sees it in this very request.
  const visitor = newVisitorFor(request);
  if (visitor) {
    // On the request too (the session refresh rebuilds the header from it).
    request.cookies.set(VISITOR_COOKIE, visitor);
    requestHeaders.set("cookie", request.cookies.toString());
  }
  const { response, isAdmin } = await updateSession(request, requestHeaders);
  response.headers.set("content-security-policy", policy);
  if (visitor) {
    response.cookies.set(VISITOR_COOKIE, visitor, VISITOR_COOKIE_OPTIONS);
  }
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

/** A new visitor id when a pricing page is opened without one (D174). */
function newVisitorFor(request: NextRequest): string | null {
  if (!request.nextUrl.pathname.startsWith("/pricing")) return null;
  const current = request.cookies.get(VISITOR_COOKIE)?.value;
  return current && /^[a-f0-9-]{8,64}$/.test(current)
    ? null
    : crypto.randomUUID();
}

export const config = {
  // Pages only: skip build assets, images, and files with an extension.
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
