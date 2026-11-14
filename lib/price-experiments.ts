import {
  PAID_PLANS,
  yearlyFromMonthly,
  type BillingPeriod,
  type PaidPlan,
  type Price,
} from "./payments/pricing";

/**
 * Price experiments (D174): an admin tries a few monthly prices for one
 * paid plan; each visitor sees one of them, always the same one. Still a
 * fake door: nothing is charged, the price only changes what the pricing
 * page and upgrade prompts show and what the waiting list remembers.
 */

/** A variant's key: "a", "b", "c"… "a" is the control, compared against. */
export type Variant = { key: string; monthly: number };

export type PriceExperiment = {
  id: string;
  plan: PaidPlan;
  variants: Variant[];
  status: "running" | "ended";
  /** The variant whose price was applied when the experiment ended. */
  winner: string | null;
};

export const EXPERIMENT_LIMITS = {
  minVariants: 2,
  maxVariants: 4,
  /** NT$ a month, whole dollars. */
  minMonthly: 1,
  maxMonthly: 10_000,
  /** Visitors per variant before a result is worth reading. */
  minVisitorsPerVariant: 100,
} as const;

const VARIANT_KEYS = ["a", "b", "c", "d"] as const;

/** Variants from monthly prices as typed: whole NT$, distinct, 2–4. */
export function parseVariants(prices: readonly unknown[]): Variant[] | null {
  const monthly = prices.map((p) =>
    typeof p === "string" && p.trim() !== "" ? Number(p) : p,
  );
  if (
    monthly.length < EXPERIMENT_LIMITS.minVariants ||
    monthly.length > EXPERIMENT_LIMITS.maxVariants
  ) {
    return null;
  }
  const ok = monthly.every(
    (n): n is number =>
      typeof n === "number" &&
      Number.isInteger(n) &&
      n >= EXPERIMENT_LIMITS.minMonthly &&
      n <= EXPERIMENT_LIMITS.maxMonthly,
  );
  if (!ok || new Set(monthly).size !== monthly.length) return null;
  return (monthly as number[]).map((n, i) => ({
    key: VARIANT_KEYS[i],
    monthly: n,
  }));
}

/**
 * FNV-1a, 32 bits: a stable, evenly spread number from a string. Not for
 * security; only so the same visitor lands in the same group every time
 * without storing the assignment.
 */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The variant a subject sees (D174): signed in, their account id;
 * signed out, the browser's visitor id. Same subject, same experiment →
 * same variant.
 */
export function assignVariant(
  experiment: Pick<PriceExperiment, "id" | "variants">,
  subject: string,
): Variant {
  const i = hash32(`${experiment.id}:${subject}`) % experiment.variants.length;
  return experiment.variants[i];
}

/** A plan's prices from its monthly price (a year is 10 months, D105). */
export const pricesFromMonthly = (
  monthly: number,
): Record<BillingPeriod, Price> => ({
  month: { amount: monthly, currency: "TWD" },
  year: { amount: yearlyFromMonthly(monthly), currency: "TWD" },
});

export type PlanPrices = Readonly<
  Record<PaidPlan, Readonly<Record<BillingPeriod, Price>>>
>;

/** An admin's applied monthly price for a plan (price_overrides). */
export type PriceOverride = { plan: string; monthly: number };

/** The code's prices with any applied override in place (D174). */
export function effectivePrices(
  base: PlanPrices,
  overrides: readonly PriceOverride[],
): PlanPrices {
  const out = { ...base };
  for (const { plan, monthly } of overrides) {
    if (isPaidPlanId(plan) && Number.isInteger(monthly) && monthly > 0) {
      out[plan] = pricesFromMonthly(monthly);
    }
  }
  return out;
}

/** A stored experiment row, checked; null when it's malformed. */
export function parseExperiment(row: {
  id: string;
  plan: string;
  variants: unknown;
  status: string;
  winner: string | null;
}): PriceExperiment | null {
  if (!isPaidPlanId(row.plan)) return null;
  if (row.status !== "running" && row.status !== "ended") return null;
  if (!Array.isArray(row.variants)) return null;
  const variants = row.variants.filter(
    (v): v is Variant =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as Variant).key === "string" &&
      Number.isInteger((v as Variant).monthly) &&
      (v as Variant).monthly > 0,
  );
  if (variants.length < EXPERIMENT_LIMITS.minVariants) return null;
  return {
    id: row.id,
    plan: row.plan,
    variants,
    status: row.status,
    winner: row.winner,
  };
}

/** What a subject is shown: the experiment's variant replaces its plan. */
export type PriceView = {
  prices: PlanPrices;
  /** The experiment and variant behind the shown price, to record. */
  experiment: { id: string; plan: PaidPlan; variant: string } | null;
};

export function priceView(
  base: PlanPrices,
  experiments: readonly PriceExperiment[],
  subject: string | null,
): PriceView {
  const running = experiments.find((e) => e.status === "running");
  if (!running || !subject) return { prices: base, experiment: null };
  const variant = assignVariant(running, subject);
  return {
    prices: { ...base, [running.plan]: pricesFromMonthly(variant.monthly) },
    experiment: { id: running.id, plan: running.plan, variant: variant.key },
  };
}

/** One variant's funnel, from intent_events tagged with the experiment. */
export type VariantStats = {
  key: string;
  monthly: number;
  /** Distinct subjects who saw the pricing page or an upgrade prompt. */
  visitors: number;
  views: number;
  subscribers: number;
  waitlist: number;
  subscribeRate: number;
  waitlistRate: number;
};

export type ExperimentEvent = {
  variant: string;
  subject: string;
  step: string;
  /** The plan a subscribe or waiting-list step was for, if any. */
  plan: string | null;
};

/**
 * Each variant's funnel. Every tagged step counts toward visitors; only
 * subscribing to or joining the list for the tested plan counts as a
 * conversion (another plan's click says nothing about this price).
 */
export function variantStats(
  experiment: Pick<PriceExperiment, "variants" | "plan">,
  events: readonly ExperimentEvent[],
): VariantStats[] {
  return experiment.variants.map(({ key, monthly }) => {
    const mine = events.filter((e) => e.variant === key);
    const who = (step: string) =>
      new Set(
        mine
          .filter(
            (e) =>
              e.step === step &&
              (step === "pricing_view" || e.plan === experiment.plan),
          )
          .map((e) => e.subject),
      );
    const viewers = who("pricing_view");
    const visitors = new Set(mine.map((e) => e.subject)).size;
    const subscribers = who("subscribe_click").size;
    const waitlist = who("waitlist_join").size;
    const base = Math.max(visitors, viewers.size);
    return {
      key,
      monthly,
      visitors,
      views: mine.filter((e) => e.step === "pricing_view").length,
      subscribers,
      waitlist,
      subscribeRate: base ? subscribers / base : 0,
      waitlistRate: base ? waitlist / base : 0,
    };
  });
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, error < 1.5e-7). */
function normalCdf(z: number): number {
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * Two-proportion z-test (D174): is variant B's rate different from A's?
 * Returns the two-sided p-value, or null when either group is empty or
 * nobody (or everybody) converted in both.
 */
export function twoProportionP(
  a: { n: number; x: number },
  b: { n: number; x: number },
): number | null {
  if (a.n === 0 || b.n === 0) return null;
  const pooled = (a.x + b.x) / (a.n + b.n);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.n + 1 / b.n));
  if (se === 0) return null;
  const z = (b.x / b.n - a.x / a.n) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/**
 * Revenue a visitor brings, as the waiting list suggests: the price × the
 * share who joined. A higher price can win with fewer sign-ups.
 */
export const revenuePerVisitor = (s: VariantStats) =>
  s.monthly * s.waitlistRate;

export type Verdict =
  | { kind: "too-early"; needed: number }
  | { kind: "no-difference"; p: number | null }
  | { kind: "significant"; better: string; p: number };

/**
 * A plain reading of a variant against the control (D174): too few
 * visitors; no clear difference (p ≥ 0.05); or a clear difference.
 * Compared on joining the waiting list, the step closest to paying.
 */
export function verdict(control: VariantStats, other: VariantStats): Verdict {
  const min = EXPERIMENT_LIMITS.minVisitorsPerVariant;
  if (control.visitors < min || other.visitors < min) {
    return {
      kind: "too-early",
      needed: Math.max(0, min - Math.min(control.visitors, other.visitors)),
    };
  }
  const p = twoProportionP(
    { n: control.visitors, x: control.waitlist },
    { n: other.visitors, x: other.waitlist },
  );
  if (p === null || p >= 0.05) return { kind: "no-difference", p };
  return {
    kind: "significant",
    better: other.waitlistRate > control.waitlistRate ? other.key : control.key,
    p,
  };
}

/** The variant with the most revenue a visitor; ties go to the lower price. */
export function suggestedWinner(stats: readonly VariantStats[]): string | null {
  if (stats.length === 0) return null;
  return [...stats].sort(
    (x, y) =>
      revenuePerVisitor(y) - revenuePerVisitor(x) || x.monthly - y.monthly,
  )[0].key;
}

export const isPaidPlanId = (value: unknown): value is PaidPlan =>
  (PAID_PLANS as readonly unknown[]).includes(value);
