import { headers } from "next/headers";
import { RATE_LIMITS, type RateLimitedAction } from "@/lib/rate-limits";
import { sha256Hex } from "@/lib/custom-practice/hash";
import { getAdminSupabase } from "./admin";

/**
 * This request's IP, hashed (D63): only the hash is ever stored, never
 * the address. Also used to spot many sign-ups from one place (D162).
 */
export async function requestIpHash(): Promise<string> {
  const list = (await headers()).get("x-forwarded-for") ?? "";
  const ip = list.split(",")[0]?.trim() || "unknown";
  return (await sha256Hex(`listenloop:${ip}`)).slice(0, 32);
}

/** Who's asking, as a rate-limit key part: the account, or the IP hashed. */
async function requester(userId: string | null): Promise<string> {
  if (userId) return `u:${userId}`;
  return `ip:${await requestIpHash()}`;
}

/**
 * Whether `action` may run once more for this account (or IP) within
 * its window (lib/rate-limits.ts), counting this attempt. Fails open: if
 * the limiter can't be reached, the action runs (and the failure is
 * logged), so a database hiccup never locks learners out.
 */
export async function allowAction(
  action: RateLimitedAction,
  userId: string | null,
): Promise<boolean> {
  try {
    const admin = getAdminSupabase();
    if (!admin) return true;
    const { windowSeconds, max } = RATE_LIMITS[action];
    const { data, error } = await admin.rpc("hit_rate_limit", {
      limit_key: `${action}:${await requester(userId)}`,
      window_seconds: windowSeconds,
      max_hits: max,
    });
    if (error) throw new Error(error.message);
    return data !== false;
  } catch (error) {
    console.error(
      `[rate-limit] ${action} not checked: ${error instanceof Error ? error.message : String(error)}`,
    );
    return true;
  }
}
