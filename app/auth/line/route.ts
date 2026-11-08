import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { LINE_COOKIE, lineAuthorizeUrl, lineConfig } from "@/auth/line";
import { safeNextPath, withSignInResult } from "@/lib/auth/redirect";

/** Starts LINE Login (D101): off to LINE with a fresh state and nonce. */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const config = lineConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL(withSignInResult(next, "failed"), origin),
    );
  }
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  (await cookies()).set(LINE_COOKIE, JSON.stringify({ state, nonce, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/line",
    maxAge: 600,
  });
  return NextResponse.redirect(
    lineAuthorizeUrl(
      config.channelId,
      `${origin}/auth/line/callback`,
      state,
      nonce,
    ),
  );
}
