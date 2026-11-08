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
export const PLAN_IDS = ["free", "paid", "pro", "admin"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/**
 * The plans an admin can put an account on (profiles.plan). "paid" is
 * Plus (its id predates Pro, D102), "pro" is Pro.
 */
export const ACCOUNT_PLANS = ["free", "paid", "pro"] as const;
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
  /**
   * Minutes of practices made per calendar month (D102), by their
   * estimated length; resets each month, even on a yearly plan.
   */
  minutesPerMonth: number | null;
  /** Characters of text per created practice. */
  charsPerPractice: number | null;
  /** May set each practice's own pass rules (D92); otherwise the defaults. */
  customRules: boolean;
  /** The longest practice the AI may write, in seconds (D94). */
  maxPracticeSeconds: number | null;
  /** May make practices from YouTube videos (D97). */
  youtubePractices: boolean;
  /** Slower and faster playback of audio practices (D73, D102). */
  playbackSpeed: boolean;
  /** Every chart on the stats page; otherwise the basics (D102). */
  fullStats: boolean;
  /** Its practices are made first when many wait (D102; not yet queued). */
  priority: boolean;
  /** Several handouts as one PDF (D102; coming soon). */
  batchPdf: boolean;
};

export const PLANS: Readonly<Record<PlanId, PlanLimits>> = {
  free: {
    createPractices: true,
    activePractices: null,
    practicesTotal: 1,
    practicesPerMonth: null,
    minutesPerMonth: null,
    charsPerPractice: 2_000,
    customRules: false,
    maxPracticeSeconds: 30,
    youtubePractices: false,
    playbackSpeed: false,
    fullStats: false,
    priority: false,
    batchPdf: false,
  },
  // Plus (D102): 40 minutes a month.
  paid: {
    createPractices: true,
    activePractices: null,
    practicesTotal: null,
    practicesPerMonth: null,
    minutesPerMonth: 40,
    charsPerPractice: 2_000,
    customRules: true,
    maxPracticeSeconds: 300,
    youtubePractices: true,
    playbackSpeed: true,
    fullStats: true,
    priority: false,
    batchPdf: false,
  },
  // Pro (D102): 120 minutes a month, up to 10 minutes each, and Plus.
  pro: {
    createPractices: true,
    activePractices: null,
    practicesTotal: null,
    practicesPerMonth: null,
    minutesPerMonth: 120,
    charsPerPractice: 10_000,
    customRules: true,
    maxPracticeSeconds: 600,
    youtubePractices: true,
    playbackSpeed: true,
    fullStats: true,
    priority: true,
    batchPdf: true,
  },
  admin: {
    createPractices: true,
    activePractices: null,
    practicesTotal: null,
    practicesPerMonth: null,
    minutesPerMonth: null,
    charsPerPractice: null,
    customRules: true,
    maxPracticeSeconds: null,
    youtubePractices: true,
    playbackSpeed: true,
    fullStats: true,
    priority: true,
    batchPdf: true,
  },
};

/** The plan an account is on; signed out is "free". */
export function planFor(
  user: { role: Role; plan?: AccountPlan } | null,
): PlanId {
  if (user?.role === "admin") return "admin";
  return user?.plan === "paid" || user?.plan === "pro" ? user.plan : "free";
}

/** What's being checked, with the counts it depends on. */
export type PlanAction =
  | {
      kind: "create-practice";
      createdThisMonth?: number;
      createdTotal?: number;
      /** Seconds of practices made this month (D102). */
      secondsThisMonth?: number;
    }
  | { kind: "start-practice"; active?: number }
  | { kind: "practice-chars"; chars: number }
  | { kind: "custom-rules" }
  | { kind: "feature"; feature: "playbackSpeed" | "fullStats" | "batchPdf" }
  | { kind: "youtube-practice" }
  | { kind: "practice-seconds"; seconds: number };

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
      if (
        limits.minutesPerMonth !== null &&
        (action.secondsThisMonth ?? 0) >= limits.minutesPerMonth * 60
      ) {
        return {
          ok: false,
          limit: "minutesPerMonth",
          max: limits.minutesPerMonth,
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
    case "practice-seconds":
      return limits.maxPracticeSeconds !== null &&
        action.seconds > limits.maxPracticeSeconds
        ? {
            ok: false,
            limit: "maxPracticeSeconds",
            max: limits.maxPracticeSeconds,
          }
        : { ok: true };
    case "youtube-practice":
      return limits.youtubePractices
        ? { ok: true }
        : { ok: false, limit: "youtubePractices" };
    case "feature":
      return limits[action.feature]
        ? { ok: true }
        : { ok: false, limit: action.feature };
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
    ? limits.practicesPerMonth !== null || limits.minutesPerMonth !== null
    : limits.activePractices !== null;
}
