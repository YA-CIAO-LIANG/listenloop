import {
  collectFunctionsStorage,
  vercelAccess,
  type FunctionsStorage,
} from "@/lib/ops/vercel-storage";

/**
 * Vercel Functions Storage on the server (D175), for the admin overview
 * and the daily monitor. Asks the Vercel API with VERCEL_API_TOKEN at
 * most once an hour per server instance (1 + one request per
 * deployment); "unset" when the token or project isn't configured.
 */

export type FunctionsStorageStatus =
  | { status: "unset" }
  | { status: "error" }
  | ({ status: "ok"; checkedAt: string } & FunctionsStorage);

const CACHE_MS = 60 * 60 * 1000;
// A failed answer is asked again sooner.
const ERROR_CACHE_MS = 5 * 60 * 1000;
let cached: { until: number; value: FunctionsStorageStatus } | null = null;

export async function getFunctionsStorage({
  now = new Date(),
  fresh = false,
  fetchImpl = fetch,
  env = process.env,
}: {
  now?: Date;
  /** Skip the hour's cache (the daily monitor). */
  fresh?: boolean;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
} = {}): Promise<FunctionsStorageStatus> {
  const access = vercelAccess(env);
  if (!access) return { status: "unset" };
  if (!fresh && cached && now.getTime() < cached.until) {
    return cached.value;
  }
  let value: FunctionsStorageStatus;
  try {
    value = {
      status: "ok",
      checkedAt: now.toISOString(),
      ...(await collectFunctionsStorage(access, fetchImpl)),
    };
  } catch {
    value = { status: "error" };
  }
  cached = {
    until: now.getTime() + (value.status === "ok" ? CACHE_MS : ERROR_CACHE_MS),
    value,
  };
  return value;
}

/** For tests: forget the cached answer. */
export function resetFunctionsStorageCache() {
  cached = null;
}
