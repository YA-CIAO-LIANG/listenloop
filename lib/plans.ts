import type { Role } from "./accounts";
import { secondsToWords, wordsToSeconds } from "./units";

/**
 * Plan limits (roadmap f, D54, D72, D210): what each plan may do, in one
 * place. The code asks `can(plan, action)` and never checks a role or a
 * number itself, so changing what a plan includes means editing the
 * tables below only.
 *
 * Paid plans come in three lines (D210, Joe 2026-11-24), each in three
 * tiers (student, Plus, Pro):
 * - listening: words of one's own practices a month and the listening
 *   features (uploads, YouTube, speed, custom pass rules…); writing as
 *   on the free plan;
 * - writing: AI essay reviews, extra practice's AI checks, and chat
 *   messages a week; listening as on the free plan;
 * - all ("聽寫全方位"): both, at full allowances (no discount).
 * Free: every official material and feature, a preview of shared
 * materials (D106), 300 words of one's own practices a week (D143,
 * D209), and a writing trial. Admin: no limits.
 *
 * null means unlimited. Technical ceilings that protect the service
 * (PRACTICE_LIMITS in lib/custom-practice/draft.ts) still apply on top.
 */
export const PLAN_LINES = ["listening", "writing", "all"] as const;
export type PlanLine = (typeof PLAN_LINES)[number];

export const PLAN_TIERS = ["student", "plus", "pro"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const isPlanLine = (value: unknown): value is PlanLine =>
  (PLAN_LINES as readonly unknown[]).includes(value);
export const isPlanTier = (value: unknown): value is PlanTier =>
  (PLAN_TIERS as readonly unknown[]).includes(value);

/** Whether a line includes listening, writing. */
export const lineHasListening = (line: PlanLine) => line !== "writing";
export const lineHasWriting = (line: PlanLine) => line !== "listening";

/**
 * The plans an account can be on (profiles.plan). The "all" line keeps
 * the ids it had before lines existed, so every account on a paid plan
 * moved to "all" without changing its row (D210): "paid" is Plus (its id
 * predates Pro, D102), "student" the student plan (D207), "pro" Pro.
 */
export const ACCOUNT_PLANS = [
  "free",
  "student",
  "paid",
  "pro",
  "listening-student",
  "listening-plus",
  "listening-pro",
  "writing-student",
  "writing-plus",
  "writing-pro",
] as const;
export type AccountPlan = (typeof ACCOUNT_PLANS)[number];
export type PaidAccountPlan = Exclude<AccountPlan, "free">;

export const PLAN_IDS = [...ACCOUNT_PLANS, "admin"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const isAccountPlan = (value: unknown): value is AccountPlan =>
  (ACCOUNT_PLANS as readonly unknown[]).includes(value);

/** The account plan for a line and tier. */
export function accountPlanFor(
  line: PlanLine,
  tier: PlanTier,
): PaidAccountPlan {
  if (line === "all") return tier === "plus" ? "paid" : tier;
  return `${line}-${tier}`;
}

/** A paid account plan's line and tier; null for free and admin. */
export function planParts(
  plan: PlanId | AccountPlan | undefined,
): { line: PlanLine; tier: PlanTier } | null {
  if (plan === "paid") return { line: "all", tier: "plus" };
  if (plan === "student" || plan === "pro") return { line: "all", tier: plan };
  const [line, tier] = (plan ?? "").split("-");
  return isPlanLine(line) && line !== "all" && isPlanTier(tier)
    ? { line, tier }
    : null;
}

/** Every plan someone pays for (D207, D210). */
export const isPayingPlan = (plan: PlanId | AccountPlan | undefined) =>
  planParts(plan) !== null;

export type PlanLimits = {
  /** May create practices with the paid voice and AI APIs. */
  createPractices: boolean;
  /**
   * May practice the materials others shared (D106); otherwise only a
   * preview. The database decides too (can_practice): keep both alike.
   */
  sharedPractices: boolean;
  /** Practices in progress at once (built-in videos and created ones). */
  activePractices: number | null;
  /** Practices ever created (deleting one doesn't give it back): a trial. */
  practicesTotal: number | null;
  /** New practices created per calendar month (Taiwan time). */
  practicesPerMonth: number | null;
  /**
   * English words of practices made per calendar month (D102, D209), by
   * their estimated length (WORDS_PER_MINUTE a minute); resets each
   * month, even on a yearly plan.
   */
  wordsPerMonth: number | null;
  /**
   * English words of practices made per week (D143, D209), from Monday
   * 00:00 Taiwan time; a new practice must fit in what's left.
   */
  wordsPerWeek: number | null;
  /** Characters of text per created practice. */
  charsPerPractice: number | null;
  /** May set each practice's own pass rules (D92); otherwise the defaults. */
  customRules: boolean;
  /** The longest practice the AI may write, in seconds (D94). */
  maxPracticeSeconds: number | null;
  /** May make practices from YouTube videos (D97). */
  youtubePractices: boolean;
  /** May make practices from their own MP3 or MP4 recording (D130). */
  uploadAudio: boolean;
  /**
   * The largest recording file that may be picked, in MB (D130); the
   * stored audio is much smaller (lib/upload-audio.ts). null: the
   * technical cap only.
   */
  uploadMegabytes: number | null;
  /**
   * All of this account's stored recordings together, in MB (D161):
   * Supabase's free plan has 1 GB for the whole site. null: no cap.
   */
  storageMegabytes: number | null;
  /** "Revise with an instruction" (D96) per Taiwan day (D161). */
  revisesPerDay: number | null;
  /** Slower and faster playback of audio practices (D73, D102). */
  playbackSpeed: boolean;
  /** Every chart on the stats page; otherwise the basics (D102). */
  fullStats: boolean;
  /** Its practices are made first when many wait (D102; not yet queued). */
  priority: boolean;
  /** Several handouts as one PDF (D102; coming soon). */
  batchPdf: boolean;
  /**
   * AI feedback on essays per week, from Monday 00:00 Taiwan time
   * (WritingLoop, D187). Every plan can finish a seven-day cycle (Day 1
   * and Day 7 are the two reviews); the cost per review is in D187, and
   * the paid plans' allowances keep the price floor (D185).
   */
  writingReviewsPerWeek: number | null;
  /** The longest essay sent for feedback, in words (D187). */
  writingWords: number | null;
  /**
   * Chat practice messages a week, from Monday 00:00 Taiwan time (D197,
   * D209): each message the learner sends counts; the length chosen
   * before a chat (5, 10, 20 minutes) only bounds that chat.
   */
  chatMessagesPerWeek: number | null;
  /**
   * AI checks of extra practice's back-translation a week, from Monday
   * 00:00 Taiwan time (D200): one check judges a whole set's answers in
   * one call. Sized like the chat: the free plan's are a free-tier cost;
   * what a paid plan adds keeps the price floor and a quarter of its
   * monthly price. Used up: the rules check alone.
   */
  backChecksPerWeek: number | null;
};

/** The limits that belong to listening (D210); the rest are writing's. */
type ListeningLimits = Omit<
  PlanLimits,
  | "writingReviewsPerWeek"
  | "writingWords"
  | "chatMessagesPerWeek"
  | "backChecksPerWeek"
  | "fullStats"
>;
type WritingLimits = Pick<
  PlanLimits,
  | "writingReviewsPerWeek"
  | "writingWords"
  | "chatMessagesPerWeek"
  | "backChecksPerWeek"
>;

/** Free (D143, D209): 300 words (2 minutes) a week, up to 2 minutes each. */
const FREE_LISTENING: ListeningLimits = {
  createPractices: true,
  sharedPractices: false,
  activePractices: null,
  practicesTotal: null,
  practicesPerMonth: null,
  wordsPerMonth: null,
  wordsPerWeek: 300,
  charsPerPractice: 2_000,
  customRules: false,
  maxPracticeSeconds: 120,
  youtubePractices: false,
  uploadAudio: false,
  uploadMegabytes: null,
  storageMegabytes: 0,
  revisesPerDay: 5,
  playbackSpeed: false,
  priority: false,
  batchPdf: false,
};

/** Free writing (D187, D197, D200): a trial of each AI step. */
const FREE_WRITING: WritingLimits = {
  writingReviewsPerWeek: 2,
  writingWords: 400,
  chatMessagesPerWeek: 10,
  backChecksPerWeek: 7,
};

/** Plus's listening features (D102), shared by the student tier (D144). */
const PLUS_LISTENING: Omit<ListeningLimits, "wordsPerMonth"> = {
  createPractices: true,
  sharedPractices: true,
  activePractices: null,
  practicesTotal: null,
  practicesPerMonth: null,
  wordsPerWeek: null,
  charsPerPractice: 2_000,
  customRules: true,
  maxPracticeSeconds: 300,
  youtubePractices: true,
  uploadAudio: true,
  uploadMegabytes: 100,
  storageMegabytes: 200,
  revisesPerDay: 30,
  playbackSpeed: true,
  priority: false,
  batchPdf: false,
};

/**
 * Listening by tier (D210): words of one's own practices a month, Joe's
 * numbers; Pro keeps Pro's longer practices, priority, and batch PDFs.
 */
export const LISTENING_TIERS: Readonly<Record<PlanTier, ListeningLimits>> = {
  student: { ...PLUS_LISTENING, wordsPerMonth: 2_400 },
  plus: { ...PLUS_LISTENING, wordsPerMonth: 3_000 },
  pro: {
    ...PLUS_LISTENING,
    wordsPerMonth: 9_000,
    charsPerPractice: 10_000,
    maxPracticeSeconds: 600,
    uploadMegabytes: 200,
    storageMegabytes: 500,
    revisesPerDay: 100,
    priority: true,
    batchPdf: true,
  },
};

/**
 * Writing by tier, a week (D210): Joe's numbers, except Pro's, raised a
 * little (18 → 19 reviews, 54 → 56 sets, 350 → 360 messages) so that
 * Pro's price per unit is the lowest on the "all" line too
 * (tests/plan-lines.test.ts); still well inside Pro's cost cap.
 */
export const WRITING_TIERS: Readonly<Record<PlanTier, WritingLimits>> = {
  student: {
    writingReviewsPerWeek: 7,
    writingWords: 600,
    chatMessagesPerWeek: 135,
    backChecksPerWeek: 21,
  },
  plus: {
    writingReviewsPerWeek: 7,
    writingWords: 600,
    chatMessagesPerWeek: 135,
    backChecksPerWeek: 21,
  },
  pro: {
    writingReviewsPerWeek: 19,
    writingWords: 1_000,
    chatMessagesPerWeek: 360,
    backChecksPerWeek: 56,
  },
};

/** A paid plan's limits: its line's parts at its tier, free elsewhere. */
export function paidPlanLimits(line: PlanLine, tier: PlanTier): PlanLimits {
  return {
    ...(lineHasListening(line) ? LISTENING_TIERS[tier] : FREE_LISTENING),
    ...(lineHasWriting(line) ? WRITING_TIERS[tier] : FREE_WRITING),
    // The stats cover both; every paid plan has them (D102, D210).
    fullStats: true,
  };
}

const paidPlans = Object.fromEntries(
  PLAN_LINES.flatMap((line) =>
    PLAN_TIERS.map((tier) => [
      accountPlanFor(line, tier),
      paidPlanLimits(line, tier),
    ]),
  ),
) as Record<PaidAccountPlan, PlanLimits>;

export const PLANS: Readonly<Record<PlanId, PlanLimits>> = {
  free: { ...FREE_LISTENING, ...FREE_WRITING, fullStats: false },
  ...paidPlans,
  admin: {
    createPractices: true,
    sharedPractices: true,
    activePractices: null,
    practicesTotal: null,
    practicesPerMonth: null,
    wordsPerMonth: null,
    wordsPerWeek: null,
    charsPerPractice: null,
    customRules: true,
    maxPracticeSeconds: null,
    youtubePractices: true,
    uploadAudio: true,
    uploadMegabytes: null,
    storageMegabytes: null,
    revisesPerDay: null,
    playbackSpeed: true,
    fullStats: true,
    priority: true,
    batchPdf: true,
    writingReviewsPerWeek: null,
    writingWords: null,
    chatMessagesPerWeek: null,
    backChecksPerWeek: null,
  },
};

/** The plan an account is on; signed out is "free". */
export function planFor(
  user: { role: Role; plan?: AccountPlan } | null,
): PlanId {
  if (user?.role === "admin") return "admin";
  return isPayingPlan(user?.plan) ? (user?.plan as PlanId) : "free";
}

/** What's being checked, with the counts it depends on. */
export type PlanAction =
  | {
      kind: "create-practice";
      createdThisMonth?: number;
      createdTotal?: number;
      /** Seconds of practices made this month (D102). */
      secondsThisMonth?: number;
      /** Seconds of practices made this week (D143). */
      secondsThisWeek?: number;
    }
  | { kind: "start-practice"; active?: number }
  | { kind: "practice-chars"; chars: number }
  | { kind: "custom-rules" }
  | { kind: "feature"; feature: "playbackSpeed" | "fullStats" | "batchPdf" }
  | { kind: "youtube-practice" }
  | { kind: "upload-audio"; bytes?: number }
  /** Storing `adding` more bytes on top of `stored` (D161). */
  | { kind: "store-audio"; stored: number; adding: number }
  /** Another essay review this week, after `thisWeek` of them (D187). */
  | { kind: "writing-review"; thisWeek: number }
  /** An essay of `words` words sent for feedback (D187). */
  | { kind: "writing-words"; words: number }
  /** Another chat message, after `thisWeek` of them (D197, D209). */
  | { kind: "chat-message"; thisWeek: number }
  /** Another AI check of extra practice, after `thisWeek` (D200). */
  | { kind: "back-check"; thisWeek: number }
  /** Another revise today, after `today` of them (D161). */
  | { kind: "revise"; today: number }
  | {
      kind: "practice-seconds";
      seconds: number;
      /** Seconds already made this week, for a weekly allowance (D143). */
      secondsThisWeek?: number;
    };

/**
 * Seconds of the weekly allowance left (D143), never negative; null when
 * the plan has none. Usage is kept in seconds; the allowance is in words
 * (D209), converted at WORDS_PER_MINUTE.
 */
export function weekSecondsLeft(
  limits: PlanLimits,
  secondsThisWeek: number,
): number | null {
  return limits.wordsPerWeek === null
    ? null
    : Math.max(
        0,
        Math.round(wordsToSeconds(limits.wordsPerWeek)) -
          Math.round(secondsThisWeek),
      );
}

/** Why an action isn't allowed: a translation key under plans.limits. */
export type PlanBlock = {
  /** A limit, or "weekWordsLeft": too long for what's left this week. */
  limit: keyof PlanLimits | "weekWordsLeft";
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
        limits.wordsPerWeek !== null &&
        (action.secondsThisWeek ?? 0) >= wordsToSeconds(limits.wordsPerWeek)
      ) {
        return {
          ok: false,
          limit: "wordsPerWeek",
          max: limits.wordsPerWeek,
        };
      }
      if (
        limits.wordsPerMonth !== null &&
        (action.secondsThisMonth ?? 0) >= wordsToSeconds(limits.wordsPerMonth)
      ) {
        return {
          ok: false,
          limit: "wordsPerMonth",
          max: limits.wordsPerMonth,
        };
      }
      return over(
        "practicesPerMonth",
        limits.practicesPerMonth,
        action.createdThisMonth ?? 0,
      );
    case "store-audio": {
      if (limits.storageMegabytes === null) return { ok: true };
      const cap = limits.storageMegabytes * 1024 * 1024;
      return action.stored + action.adding > cap
        ? { ok: false, limit: "storageMegabytes", max: limits.storageMegabytes }
        : { ok: true };
    }
    case "revise":
      return over("revisesPerDay", limits.revisesPerDay, action.today);
    case "writing-review":
      return over(
        "writingReviewsPerWeek",
        limits.writingReviewsPerWeek,
        action.thisWeek,
      );
    case "chat-message":
      return over(
        "chatMessagesPerWeek",
        limits.chatMessagesPerWeek,
        action.thisWeek,
      );
    case "back-check":
      return over(
        "backChecksPerWeek",
        limits.backChecksPerWeek,
        action.thisWeek,
      );
    case "writing-words":
      return limits.writingWords !== null && action.words > limits.writingWords
        ? { ok: false, limit: "writingWords", max: limits.writingWords }
        : { ok: true };
    case "start-practice":
      return over(
        "activePractices",
        limits.activePractices,
        action.active ?? 0,
      );
    case "practice-seconds":
      if (
        limits.maxPracticeSeconds !== null &&
        action.seconds > limits.maxPracticeSeconds
      ) {
        return {
          ok: false,
          limit: "maxPracticeSeconds",
          max: limits.maxPracticeSeconds,
        };
      }
      // It must fit in what's left of the week (D143); max: words left.
      if (limits.wordsPerWeek !== null) {
        const left = weekSecondsLeft(limits, action.secondsThisWeek ?? 0)!;
        if (action.seconds > left) {
          return {
            ok: false,
            limit: "weekWordsLeft",
            max: secondsToWords(left),
          };
        }
      }
      return { ok: true };
    case "youtube-practice":
      return limits.youtubePractices
        ? { ok: true }
        : { ok: false, limit: "youtubePractices" };
    case "upload-audio":
      if (!limits.uploadAudio) return { ok: false, limit: "uploadAudio" };
      return limits.uploadMegabytes !== null &&
        (action.bytes ?? 0) > limits.uploadMegabytes * 1024 * 1024
        ? {
            ok: false,
            limit: "uploadMegabytes",
            max: limits.uploadMegabytes,
          }
        : { ok: true };
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
    ? limits.practicesPerMonth !== null ||
        limits.wordsPerMonth !== null ||
        limits.wordsPerWeek !== null
    : limits.activePractices !== null;
}
