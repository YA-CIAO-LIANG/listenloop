/**
 * The Beta test (D165, docs/beta-test-plan.md): each tester's progress in
 * brief, who needs a nudge, and when to interview them. Pure, so every
 * rule is tested; auth/beta-test.ts reads the rows.
 */
export const BETA_TEST = {
  /** "Needs follow-up" after this many days without practice. */
  idleDays: 2,
  /** Not started a day after joining: worth a message. */
  notStartedDays: 1,
  /** Interview windows, in days since joining. */
  interviews: { day3: [3, 6], day14: [14, 20] },
} as const;

export type TesterProgress = {
  video: string;
  week: number;
  status: string | null;
  /** Days done this week (1–7). */
  done: number[];
  /** Weeks finished before this one. */
  weeks: number;
  updated: string;
};

export type TesterRow = {
  userId: string;
  number: number | null;
  inviteId: string;
  inviteNote: string | null;
  joinedAt: string;
  lastSignInAt: string | null;
  lastActivity: string | null;
  progress: TesterProgress[];
};

export type FollowUp = "notStarted" | "idle";
export type Interview = "day3" | "day14";

export type TesterSummary = {
  materials: number;
  /** The most recently practised material's week and last day done. */
  current: { video: string; week: number; day: number } | null;
  startedDay1: boolean;
  finishedWeek: boolean;
  /** Last practice (progress or activity saved), else null. */
  lastPractice: string | null;
  daysSinceJoin: number;
  daysIdle: number | null;
  followUp: FollowUp | null;
  interview: Interview | null;
};

const DAY = 86_400_000;

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** The RPC's rows (beta_tester_activity) into typed rows; bad ones skipped. */
export function parseTesterRows(raw: unknown): TesterRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): TesterRow[] => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    if (typeof r.user_id !== "string" || typeof r.joined_at !== "string")
      return [];
    const progress = Array.isArray(r.progress) ? r.progress : [];
    return [
      {
        userId: r.user_id,
        number: r.number == null ? null : asNumber(r.number, 0),
        inviteId: String(r.invite_id ?? ""),
        inviteNote: typeof r.invite_note === "string" ? r.invite_note : null,
        joinedAt: r.joined_at,
        lastSignInAt:
          typeof r.last_sign_in_at === "string" ? r.last_sign_in_at : null,
        lastActivity:
          typeof r.last_activity === "string" ? r.last_activity : null,
        progress: progress.flatMap((p): TesterProgress[] => {
          if (!p || typeof p !== "object") return [];
          const g = p as Record<string, unknown>;
          return [
            {
              video: String(g.video ?? ""),
              week: asNumber(g.week, 1),
              status: typeof g.status === "string" ? g.status : null,
              done: Array.isArray(g.done)
                ? g.done.map((d) => asNumber(d, 0)).filter((d) => d >= 1)
                : [],
              weeks: asNumber(g.weeks, 0),
              updated: String(g.updated ?? ""),
            },
          ];
        }),
      },
    ];
  });
}

export function summarizeTester(row: TesterRow, now: Date): TesterSummary {
  const latest = [...row.progress].sort((a, b) =>
    b.updated.localeCompare(a.updated),
  )[0];
  const startedDay1 = row.progress.some(
    (p) => p.done.includes(1) || p.weeks > 0,
  );
  const finishedWeek = row.progress.some(
    (p) => p.weeks > 0 || p.done.includes(7) || p.status === "passed",
  );
  const daysSinceJoin = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(row.joinedAt)) / DAY),
  );
  const lastPractice = row.lastActivity;
  const daysIdle = lastPractice
    ? Math.max(0, Math.floor((now.getTime() - Date.parse(lastPractice)) / DAY))
    : null;
  let followUp: FollowUp | null = null;
  if (!startedDay1) {
    if (daysSinceJoin >= BETA_TEST.notStartedDays) followUp = "notStarted";
  } else if (daysIdle !== null && daysIdle >= BETA_TEST.idleDays) {
    followUp = "idle";
  }
  const within = ([from, to]: readonly [number, number]) =>
    daysSinceJoin >= from && daysSinceJoin <= to;
  const interview: Interview | null = within(BETA_TEST.interviews.day3)
    ? "day3"
    : within(BETA_TEST.interviews.day14)
      ? "day14"
      : null;
  return {
    materials: row.progress.length,
    current: latest
      ? {
          video: latest.video,
          week: latest.week,
          day: latest.done.length ? Math.max(...latest.done) : 0,
        }
      : null,
    startedDay1,
    finishedWeek,
    lastPractice,
    daysSinceJoin,
    daysIdle,
    followUp,
    interview,
  };
}

export type CohortSummary = {
  testers: number;
  startedDay1: number;
  finishedWeek: number;
  /** Practised in the last 2 days. */
  activeRecently: number;
  followUps: number;
};

export function summarizeCohort(
  summaries: readonly TesterSummary[],
): CohortSummary {
  return {
    testers: summaries.length,
    startedDay1: summaries.filter((s) => s.startedDay1).length,
    finishedWeek: summaries.filter((s) => s.finishedWeek).length,
    activeRecently: summaries.filter(
      (s) => s.daysIdle !== null && s.daysIdle < BETA_TEST.idleDays,
    ).length,
    followUps: summaries.filter((s) => s.followUp).length,
  };
}
