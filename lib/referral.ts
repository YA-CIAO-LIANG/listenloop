import { parseActivity } from "./activity";
import { cleanInviteCode, newInviteCode } from "./beta";
import { isLocalDate, type LocalDate } from "./dates";
import type { PlanLimits } from "./plans";
import { parseProgress } from "./progress";

/**
 * The referral program (D177): each account has its own link. A friend
 * who signs up through it and finishes Day 1 gives both accounts bonus
 * minutes for making their own practices. Every number is here; the
 * pure rules are tested (tests/referral.test.ts), and auth/referral.ts
 * reads and writes the database with them.
 *
 * Bonus minutes are a one-time pool on top of the plan's weekly (free)
 * or monthly (paid) minutes: what a week or month uses beyond the plan
 * comes out of the pool, earliest-expiring grant first, and each grant
 * can be used for REFERRAL_VALID_DAYS.
 */
export const REFERRAL_BONUS_MINUTES = 2;
/** Days a grant of bonus minutes can be used. */
export const REFERRAL_VALID_DAYS = 90;
/** Days a friend has to finish Day 1 after signing up. */
export const REFERRAL_QUALIFY_DAYS = 30;
/**
 * Sign-ups through one link in 24 hours from which they stop counting:
 * the third and later in a day are turned down.
 */
export const REFERRAL_BURST = 3;
/** Rewards a referrer can earn in 30 days (bounds the AI cost). */
export const REFERRAL_REFERRER_MONTHLY = 10;

/** Cookie holding a referral code until the first sign-in, 30 days. */
export const REFERRAL_COOKIE = "ll-ref";
export const REFERRAL_COOKIE_SECONDS = 30 * 24 * 3600;

/** Codes look like invite codes: 8 characters, no look-alikes. */
export const newReferralCode = newInviteCode;
export const cleanReferralCode = cleanInviteCode;

/** A referral link, on this site. */
export const referralUrl = (origin: string, code: string) =>
  `${origin}/r/${code}`;

export type ReferralStatus = "pending" | "qualified" | "rejected" | "expired";
export type RejectReason = "self" | "same-ip" | "same-device" | "burst";

export type ReferralFacts = {
  referrerId: string;
  refereeId: string;
  /** When the friend signed up (ISO). */
  createdAt: string;
  /** Both accounts signed up from the same IP (hashed). */
  sameIp: boolean;
  /** Both accounts practiced on the same device (ll-device:v1). */
  sameDevice: boolean;
  /**
   * Sign-ups through this link in the 24 hours up to and including this
   * one.
   */
  burst: number;
  /** The friend finished Day 1 since signing up (cloud progress). */
  day1: boolean;
  /** Rewards the referrer earned in the last 30 days. */
  referrerRecentRewards: number;
  now: Date;
};

export type ReferralVerdict =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "rejected"; reason: RejectReason }
  | { status: "qualified"; referrerMinutes: number; refereeMinutes: number };

/**
 * What to do with a pending referral. Turned down: the same person on
 * both sides (same account, IP, or device), or a burst of sign-ups
 * through one link. Otherwise it waits for the friend's Day 1, for
 * REFERRAL_QUALIFY_DAYS. A referrer past the monthly cap earns nothing
 * more; the friend still does.
 */
export function referralVerdict(facts: ReferralFacts): ReferralVerdict {
  if (facts.referrerId === facts.refereeId) {
    return { status: "rejected", reason: "self" };
  }
  if (facts.sameIp) return { status: "rejected", reason: "same-ip" };
  if (facts.sameDevice) return { status: "rejected", reason: "same-device" };
  if (facts.burst >= REFERRAL_BURST) {
    return { status: "rejected", reason: "burst" };
  }
  if (!facts.day1) {
    const age = facts.now.getTime() - Date.parse(facts.createdAt);
    return age > REFERRAL_QUALIFY_DAYS * 86_400_000
      ? { status: "expired" }
      : { status: "pending" };
  }
  return {
    status: "qualified",
    referrerMinutes:
      facts.referrerRecentRewards >= REFERRAL_REFERRER_MONTHLY
        ? 0
        : REFERRAL_BONUS_MINUTES,
    refereeMinutes: REFERRAL_BONUS_MINUTES,
  };
}

/**
 * The earliest local date a Day 1 may count from: the day before the
 * sign-up (UTC), so a friend in any time zone isn't cut off.
 */
export function day1Cutoff(createdAt: string): LocalDate {
  return new Date(Date.parse(createdAt) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Whether any of these cloud progress rows (progress.data) has Day 1
 * finished on or after `since`: this week's, or a finished week's.
 */
export function finishedDay1Since(
  rows: readonly unknown[],
  since: LocalDate,
): boolean {
  return rows.some((row) => {
    const progress = parseProgress(row);
    if (!progress) return false;
    const day1 = progress.days["1"];
    if (day1?.done && isLocalDate(day1.date) && day1.date >= since) {
      return true;
    }
    // A finished week had its Day 1 done, in or after the week it began.
    return progress.history.some((week) => week.startedAt >= since);
  });
}

/** The devices (ll-device:v1) an activity log has practice time from. */
export function activityDevices(activity: unknown): Set<string> {
  const parsed = parseActivity(activity);
  const devices = new Set<string>();
  for (const day of Object.values(parsed?.days ?? {})) {
    for (const device of Object.keys(day?.time ?? {})) devices.add(device);
  }
  return devices;
}

export const sharesDevice = (a: Set<string>, b: Set<string>) =>
  [...a].some((device) => b.has(device));

/** A grant of bonus minutes. */
export type ReferralGrant = {
  minutes: number;
  grantedAt: string;
  expiresAt: string;
};

/** A practice made, by its estimated length (practice_creations). */
export type CreationRecord = { seconds: number; createdAt: string };

/**
 * The bonus pool at `now`: how many seconds are left in grants still in
 * force, and how many the current period (week or month) may use beyond
 * the plan (what's left plus what this period already took from the
 * pool). `periodOf` names the period of an instant (its start).
 */
export function bonusPool({
  grants,
  creations,
  baseSeconds,
  periodOf,
  now,
}: {
  grants: readonly ReferralGrant[];
  creations: readonly CreationRecord[];
  /** The plan's seconds per period, with an admin's changes. */
  baseSeconds: number;
  periodOf: (iso: string) => string;
  now: Date;
}): { leftSeconds: number; extraSeconds: number } {
  const pool = grants
    .map((g) => ({
      ...g,
      from: Date.parse(g.grantedAt),
      until: Date.parse(g.expiresAt),
      left: g.minutes * 60,
    }))
    .sort((a, b) => a.until - b.until);
  const current = periodOf(now.toISOString());
  const used = new Map<string, number>();
  let takenNow = 0;
  for (const c of [...creations].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )) {
    const at = Date.parse(c.createdAt);
    const period = periodOf(c.createdAt);
    const before = used.get(period) ?? 0;
    const after = before + c.seconds;
    used.set(period, after);
    let over =
      Math.max(0, after - baseSeconds) - Math.max(0, before - baseSeconds);
    for (const g of pool) {
      if (over <= 0) break;
      if (g.from > at || g.until <= at || g.left <= 0) continue;
      const take = Math.min(g.left, over);
      g.left -= take;
      over -= take;
      if (period === current) takenNow += take;
    }
  }
  const t = now.getTime();
  const leftSeconds = pool
    .filter((g) => g.from <= t && g.until > t)
    .reduce((sum, g) => sum + g.left, 0);
  return { leftSeconds, extraSeconds: leftSeconds + takenNow };
}

/** Which allowance bonus minutes add to: the week's, else the month's. */
export function bonusLimit(
  limits: PlanLimits,
): "minutesPerWeek" | "minutesPerMonth" | null {
  if (limits.minutesPerWeek !== null) return "minutesPerWeek";
  if (limits.minutesPerMonth !== null) return "minutesPerMonth";
  return null;
}

/** The limits with `extraSeconds` of bonus added to that allowance. */
export function withBonus(
  limits: PlanLimits,
  extraSeconds: number,
): PlanLimits {
  const limit = bonusLimit(limits);
  if (limit === null || extraSeconds <= 0) return limits;
  return { ...limits, [limit]: limits[limit]! + extraSeconds / 60 };
}

/** What "My quota" shows about the program. */
export type ReferralSummary = {
  code: string | null;
  /** Friends who signed up through the link. */
  invited: number;
  /** Of them, the ones whose Day 1 earned the reward. */
  qualified: number;
  /** Minutes earned in all (as referrer and as the friend). */
  earnedMinutes: number;
  /** Bonus minutes left now. */
  leftMinutes: number;
};

export function summarizeReferrals(
  referrals: readonly { status: string }[],
  rewards: readonly { minutes: number }[],
): Pick<ReferralSummary, "invited" | "qualified" | "earnedMinutes"> {
  return {
    invited: referrals.length,
    qualified: referrals.filter((r) => r.status === "qualified").length,
    earnedMinutes: rewards.reduce((sum, r) => sum + r.minutes, 0),
  };
}
