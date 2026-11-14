import { cookies } from "next/headers";
import { getAdminSupabase } from "@/auth/admin";
import { getSignedInUser } from "@/auth/session";
import { VISITOR_COOKIE } from "@/lib/intent";
import { PLAN_PRICES } from "@/lib/payments/pricing";
import {
  effectivePrices,
  parseExperiment,
  priceView,
  type PriceExperiment,
  type PriceOverride,
  type PriceView,
} from "@/lib/price-experiments";

/**
 * The prices people see (D174): the code's prices, an admin's applied
 * price per plan (price_overrides), and the running experiment's variant
 * for this account or browser. Kept in memory for 30 s per server
 * instance; an admin's change is seen everywhere within that time.
 */
const TTL_MS = 30_000;

type State = { experiments: PriceExperiment[]; overrides: PriceOverride[] };
let cache: { value: State; at: number } | null = null;

/** Forget the cached state (after an admin's change in this instance). */
export function resetPriceCache() {
  cache = null;
}

async function readState(): Promise<State> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const admin = getAdminSupabase();
  if (!admin) return { experiments: [], overrides: [] };
  const [experiments, overrides] = await Promise.all([
    admin
      .from("price_experiments")
      .select("id, plan, variants, status, winner")
      .eq("status", "running"),
    admin.from("price_overrides").select("plan, monthly"),
  ]);
  // A failed read shows the code's prices: never a broken page.
  const value: State = {
    experiments: (experiments.data ?? [])
      .map(parseExperiment)
      .filter((e): e is PriceExperiment => e !== null),
    overrides: (overrides.data ?? []) as PriceOverride[],
  };
  if (!experiments.error && !overrides.error) {
    cache = { value, at: Date.now() };
  }
  return value;
}

/**
 * Who sees a variant: the account when signed in, else the browser's
 * visitor id (set by the proxy on pricing pages; D174). Null when neither.
 */
export async function priceSubject(): Promise<string | null> {
  const user = await getSignedInUser();
  if (user) return `u:${user.id}`;
  const visitor = (await cookies()).get(VISITOR_COOKIE)?.value;
  return visitor && /^[a-f0-9-]{8,64}$/.test(visitor) ? `v:${visitor}` : null;
}

/** The prices this visitor sees, and the experiment behind them. */
export async function getPriceView(
  subject?: string | null,
): Promise<PriceView> {
  const [state, who] = await Promise.all([
    readState(),
    subject === undefined ? priceSubject() : Promise.resolve(subject),
  ]);
  return priceView(
    effectivePrices(PLAN_PRICES, state.overrides),
    state.experiments,
    who,
  );
}
