import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/auth/server";
import { safeNextPath, withSignInResult } from "@/lib/auth/redirect";

/**
 * Where Google sign-in returns (through Supabase): swaps the one-time code
 * for a session (cookies), then goes back to the page the learner started
 * from. A cancelled or failed sign-in returns there with ?signin=… so the
 * page can say what happened.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const back = (path: string) => NextResponse.redirect(new URL(path, origin));

  const error = searchParams.get("error");
  if (error) {
    return back(
      withSignInResult(
        next,
        error === "access_denied" ? "cancelled" : "failed",
      ),
    );
  }

  const code = searchParams.get("code");
  const supabase = await getServerSupabase();
  if (!code || !supabase) return back(withSignInResult(next, "failed"));

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  return back(exchangeError ? withSignInResult(next, "failed") : next);
}
