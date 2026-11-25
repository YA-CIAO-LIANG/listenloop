import type { Role } from "./accounts";
import { secondsToWords, wordsToSeconds } from "./units";

/**
 * Plan limits (roadmap f, D54, D72): what each plan may do, in one place.
 * The code asks `can(plan, action)` and never checks a role or a number
 * itself, so changing what a plan includes means editing PLANS only.
 *
 * - free: every official material and feature, a preview of shared
 *   materials (D106), and 300 words of their own practices a week
 *   (D143: two minutes; D209: counted in words);
 * - paid: Plus (set by an admin until payments exist; the price shows
 *   "coming soon");
 * - student: Plus at a student price (D144) with its own, smaller AI
 *   writing allowances (D207): what the student price's floor allows;
 * - admin: no limits.
 *
 * null means unlimited. Technical ceilings that protect the service
 * (PRACTICE_LIMITS in lib/custom-practice/draft.ts) still apply on top.
 */
export const PLAN_IDS = ["free", "paid", "student", "pro", "admin"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/**
 * The plans an admin can put an account on (profiles.plan). "paid" is
 * Plus (its id predates Pro, D102), "student" is the student plan (D207),
 * "pro" is Pro.
 */
export const ACCOUNT_PLANS = ["free", "paid", "student", "pro"] as const;

/** Every plan someone pays for (D207): Plus's features and more. */
export const isPayingPlan = (plan: PlanId | AccountPlan | undefined) =>
  plan === "paid" || plan === "student" || plan === "pro";
export type AccountPlan = (typeof ACCOUNT_PLANS)[number];

export const isAccountPlan = (value: unknown): value is AccountPlan =>
  (ACCOUNT_PLANS as readonly unknown[]).includes(value);

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

/** Plus (D102): 6,000 words (40 minutes) a month. */
const PLUS: PlanLimits = {
  createPractices: true,
  sharedPractices: true,
  activePractices: null,
  practicesTotal: null,
  practicesPerMonth: null,
  wordsPerMonth: 6_000,
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
  fullStats: true,
  priority: false,
  batchPdf: false,
  // Clearly more than free (D207); Pro still has more of each.
  writingReviewsPerWeek: 5,
  writingWords: 600,
  chatMessagesPerWeek: 30,
  backChecksPerWeek: 10,
};

export const PLANS: Readonly<Record<PlanId, PlanLimits>> = {
  // Free (D143, D209): 300 words (2 minutes) a week, up to 2 minutes each.
  free: {
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
    fullStats: false,
    priority: false,
    batchPdf: false,
    writingReviewsPerWeek: 2,
    writingWords: 400,
    chatMessagesPerWeek: 10,
    backChecksPerWeek: 7,
  },
  paid: PLUS,
  /**
   * The student plan (D144, D207): Plus at a student price, so its AI
   * writing allowances are what that price's floor leaves room for
   * (D185): a little more than free, less than Plus.
   */
  student: {
    ...PLUS,
    writingReviewsPerWeek: 3,
    chatMessagesPerWeek: 10,
    backChecksPerWeek: 9,
  },
  // Pro (D102): 18,000 words (120 minutes) a month, up to 10 minutes each.
  pro: {
    createPractices: true,
    sharedPractices: true,
    activePractices: null,
    practicesTotal: null,
    practicesPerMonth: null,
    wordsPerMonth: 18_000,
    wordsPerWeek: null,
    charsPerPractice: 10_000,
    customRules: true,
    maxPracticeSeconds: 600,
    youtubePractices: true,
    uploadAudio: true,
    uploadMegabytes: 200,
    storageMegabytes: 500,
    revisesPerDay: 100,
    playbackSpeed: true,
    fullStats: true,
    priority: true,
    batchPdf: true,
    writingReviewsPerWeek: 6,
    writingWords: 1_000,
    chatMessagesPerWeek: 40,
    // 14 until the corrected sentences' meanings (D206) took the room.
    backChecksPerWeek: 11,
  },
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
