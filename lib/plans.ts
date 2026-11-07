import type { Role } from "./accounts";

/**
 * Plan limits (roadmap f, D54): what each plan may do, in one place. The
 * code asks `can(plan, action)` and never checks a role or a number
 * itself, so charging later means editing PLANS only. Today nothing is
 * limited; creating practices is for admins, as before (D5).
 *
 * null means unlimited. Technical ceilings that protect the service
 * (PRACTICE_LIMITS in lib/custom-practice/draft.ts) still apply on top.
 */
export const PLAN_IDS = ["free", "admin"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type PlanLimits = {
  /** May create practices with the paid voice and AI APIs. */
  createPractices: boolean;
  /** Practices in progress at once (built-in videos and created ones). */
  activePractices: number | null;
  /** New practices created per calendar month (Taiwan time). */
  practicesPerMonth: number | null;
  /** Characters of text per created practice. */
  charsPerPractice: number | null;
};

export const PLANS: Readonly<Record<PlanId, PlanLimits>> = {
  free: {
    createPractices: false,
    activePractices: null,
    practicesPerMonth: null,
    charsPerPractice: null,
  },
  admin: {
    createPractices: true,
    activePractices: null,
    practicesPerMonth: null,
    charsPerPractice: null,
  },
};

/** The plan an account is on; signed out is "free". */
export function planFor(user: { role: Role } | null): PlanId {
  return user?.role === "admin" ? "admin" : "free";
}

/** What's being checked, with the counts it depends on. */
export type PlanAction =
  | { kind: "create-practice"; createdThisMonth?: number }
  | { kind: "start-practice"; active?: number }
  | { kind: "practice-chars"; chars: number };

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
