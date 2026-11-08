import type { Role } from "./accounts";

/**
 * Plan limits (roadmap f, D54, D72): what each plan may do, in one place.
 * The code asks `can(plan, action)` and never checks a role or a number
 * itself, so changing what a plan includes means editing PLANS only.
 *
 * - free: every official material and feature, and one practice of
 *   their own to try creating;
 * - paid: 30 practices a month of up to 2,000 characters (set by an
 *   admin until payments exist; the price shows "coming soon");
 * - admin: no limits.
 *
 * null means unlimited. Technical ceilings that protect the service
 * (PRACTICE_LIMITS in lib/custom-practice/draft.ts) still apply on top.
 */
export const PLAN_IDS = ["free", "paid", "admin"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** The plans an admin can put an account on (profiles.plan). */
export const ACCOUNT_PLANS = ["free", "paid"] as const;
export type AccountPlan = (typeof ACCOUNT_PLANS)[number];

export const isAccountPlan = (value: unknown): value is AccountPlan =>
  (ACCOUNT_PLANS as readonly unknown[]).includes(value);

export type PlanLimits = {
  /** May create practices with the paid voice and AI APIs. */
  createPractices: boolean;
  /** Practices in progress at once (built-in videos and created ones). */
  activePractices: number | null;
  /** Practices ever created (deleting one doesn't give it back): a trial. */
  practicesTotal: number | null;
  /** New practices created per calendar month (Taiwan time). */
  practicesPerMonth: number | null;
  /** Characters of text per created practice. */
  charsPerPractice: number | null;
  /** May set each practice's own pass rules (D92); otherwise the defaults. */
  customRules: boolean;
};

export const PLANS: Readonly<Record<PlanId, PlanLimits>> = {
  free: {
    createPractices: true,
    activePractices: null,
    practicesTotal: 1,
    practicesPerMonth: null,
    charsPerPractice: 2_000,
    customRules: false,
  },
  paid: {
    createPractices: true,
    activePractices: null,
    practicesTotal: null,
    practicesPerMonth: 30,
    charsPerPractice: 2_000,
    customRules: true,
  },
  admin: {
    createPractices: true,
    activePractices: null,
    practicesTotal: null,
    practicesPerMonth: null,
    charsPerPractice: null,
    customRules: true,
  },
};

/** The plan an account is on; signed out is "free". */
export function planFor(
  user: { role: Role; plan?: AccountPlan } | null,
): PlanId {
  if (user?.role === "admin") return "admin";
  return user?.plan === "paid" ? "paid" : "free";
}

/** What's being checked, with the counts it depends on. */
export type PlanAction =
  | {
      kind: "create-practice";
      createdThisMonth?: number;
      createdTotal?: number;
    }
  | { kind: "start-practice"; active?: number }
  | { kind: "practice-chars"; chars: number }
  | { kind: "custom-rules" };

/** Why an action isn't allowed: a translation key under plans.limits. */
export type PlanBlock = {
  limit: keyof PlanLimits;
  /** The number reached, for the message; absent for yes/no limits. */
  max?: number;
};

export type PlanCheck = { ok: true } | ({ ok: false } & PlanBlock);

/**
 * Whether `plan` allows `action`. A count that isn't given is treated as
 * zero, so callers only need to count when `needsCount` says the plan
 * has a limit to count against.
 */
export function can(
  plan: PlanId,
  action: PlanAction,
  plans: Readonly<Record<PlanId, PlanLimits>> = PLANS,
): PlanCheck {
  const limits = plans[plan];
  const over = (limit: keyof PlanLimits, max: number | null, used: number) =>
    max !== null && used >= max
      ? ({ ok: false, limit, max } as const)
      : ({ ok: true } as const);
  switch (action.kind) {
    case "create-practice":
      if (!limits.createPractices) {
        return { ok: false, limit: "createPractices" };
      }
      if (
        limits.practicesTotal !== null &&
        (action.createdTotal ?? 0) >= limits.practicesTotal
      ) {
        return {
          ok: false,
          limit: "practicesTotal",
          max: limits.practicesTotal,
        };
      }
      return over(
        "practicesPerMonth",
        limits.practicesPerMonth,
        action.createdThisMonth ?? 0,
      );
    case "start-practice":
      return over(
        "activePractices",
        limits.activePractices,
        action.active ?? 0,
      );
    case "custom-rules":
      return limits.customRules
        ? { ok: true }
        : { ok: false, limit: "customRules" };
    case "practice-chars":
      return limits.charsPerPractice !== null &&
        action.chars > limits.charsPerPractice
        ? {
            ok: false,
            limit: "charsPerPractice",
            max: limits.charsPerPractice,
          }
        : { ok: true };
  }
}

/** Whether checking `kind` needs a count (only when the plan limits it). */
export function needsCount(
  plan: PlanId,
  kind: "create-practice" | "start-practice",
  plans: Readonly<Record<PlanId, PlanLimits>> = PLANS,
): boolean {
  const limits = plans[plan];
  return kind === "create-practice"
    ? limits.practicesPerMonth !== null
    : limits.activePractices !== null;
}
