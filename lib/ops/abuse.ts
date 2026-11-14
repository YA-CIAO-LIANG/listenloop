/**
 * Abuse detection (D162): from the database's counts, which accounts to
 * flag, and which to pause AI for until an admin looks. Pure, so every
 * rule is tested; auth/abuse.ts runs it with the monitor (D156).
 *
 * - many accounts from one IP in a day: flag only (a school or a
 *   dormitory shares one address);
 * - very many AI calls in an hour: flag and pause AI (no person creating
 *   materials gets near it);
 * - near the daily AI cap three days running: flag only (heavy, but
 *   within the plan);
 * - public practices reported by 3+ different people in 30 days: flag
 *   and pause AI;
 * - referrals (D177): a referrer with 2+ referrals turned down in 30 days
 *   (same IP, same device, or a burst), or 3+ sign-ups through their link
 *   in 24 hours: flag only (the turned-down ones already earn nothing).
 *   The database's abuse_signals uses the same two numbers.
 */
export const ABUSE = {
  signupsPerIp: 3,
  heavyCallsPerHour: 150,
  cappedShare: 0.9,
  cappedDays: 3,
  reporters: 3,
  referralsRejected: 2,
  referralsPerDay: 3,
} as const;

export type AbuseKind =
  "multi-signup" | "heavy-use" | "capped-days" | "reported" | "referral-farm";

export type AbuseFlag = {
  userId: string;
  kind: AbuseKind;
  detail: Record<string, number | string>;
  /** Pause this account's AI until an admin decides. */
  suspend: boolean;
};

export type AbuseSignals = {
  signups: { ip: string; users: string[] }[];
  heavy: { user: string; calls: number }[];
  days: { user: string; day: string; micros: number }[];
  reported: { user: string; reporters: number }[];
  /** Referrers: referrals turned down in 30 days, sign-ups in 24 hours. */
  referrals: { user: string; rejected: number; day: number }[];
};

export function parseAbuseSignals(raw: unknown): AbuseSignals {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = (key: string) =>
    Array.isArray(r[key]) ? (r[key] as unknown[]) : [];
  const obj = (x: unknown) =>
    x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  return {
    signups: list("signups").map((x) => ({
      ip: String(obj(x).ip ?? ""),
      users: Array.isArray(obj(x).users)
        ? (obj(x).users as unknown[]).map(String)
        : [],
    })),
    heavy: list("heavy").map((x) => ({
      user: String(obj(x).user ?? ""),
      calls: Number(obj(x).calls) || 0,
    })),
    days: list("days").map((x) => ({
      user: String(obj(x).user ?? ""),
      day: String(obj(x).day ?? ""),
      micros: Number(obj(x).micros) || 0,
    })),
    reported: list("reported").map((x) => ({
      user: String(obj(x).user ?? ""),
      reporters: Number(obj(x).reporters) || 0,
    })),
    referrals: list("referrals").map((x) => ({
      user: String(obj(x).user ?? ""),
      rejected: Number(obj(x).rejected) || 0,
      day: Number(obj(x).day) || 0,
    })),
  };
}

export function detectAbuse(
  signals: AbuseSignals,
  /** Each account's daily AI limit in micro-dollars; admins left out. */
  dailyLimit: (userId: string) => number | null,
): AbuseFlag[] {
  const flags: AbuseFlag[] = [];
  const exempt = (userId: string) => dailyLimit(userId) === null;

  for (const group of signals.signups) {
    if (group.users.length < ABUSE.signupsPerIp) continue;
    for (const userId of group.users) {
      if (exempt(userId)) continue;
      flags.push({
        userId,
        kind: "multi-signup",
        detail: { accounts: group.users.length },
        suspend: false,
      });
    }
  }
  for (const h of signals.heavy) {
    if (h.calls < ABUSE.heavyCallsPerHour || exempt(h.user)) continue;
    flags.push({
      userId: h.user,
      kind: "heavy-use",
      detail: { callsPerHour: h.calls },
      suspend: true,
    });
  }
  const capped = new Map<string, number>();
  for (const d of signals.days) {
    const limit = dailyLimit(d.user);
    if (limit === null || limit <= 0) continue;
    if (d.micros >= limit * ABUSE.cappedShare) {
      capped.set(d.user, (capped.get(d.user) ?? 0) + 1);
    }
  }
  for (const [userId, days] of capped) {
    if (days < ABUSE.cappedDays) continue;
    flags.push({
      userId,
      kind: "capped-days",
      detail: { days },
      suspend: false,
    });
  }
  for (const r of signals.reported) {
    if (r.reporters < ABUSE.reporters || exempt(r.user)) continue;
    flags.push({
      userId: r.user,
      kind: "reported",
      detail: { reporters: r.reporters },
      suspend: true,
    });
  }
  for (const r of signals.referrals) {
    if (exempt(r.user)) continue;
    if (r.rejected < ABUSE.referralsRejected && r.day < ABUSE.referralsPerDay) {
      continue;
    }
    flags.push({
      userId: r.user,
      kind: "referral-farm",
      detail: { rejected: r.rejected, signupsPerDay: r.day },
      suspend: false,
    });
  }
  return flags;
}
