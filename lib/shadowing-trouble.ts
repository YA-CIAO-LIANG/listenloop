/**
 * When shadowing one sentence keeps failing (D52): after TROUBLE_ATTEMPTS
 * attempts in a row below TROUBLE_COVERAGE, the learner is offered tips
 * and a way to skip the sentence. Each attempt's coverage and recognized
 * text go into the report, never a recording.
 */
export const TROUBLE_ATTEMPTS = 5;
export const TROUBLE_COVERAGE = 0.5;

export type TroubleAttempt = { coverage: number; heard: string };

/** Whether the last TROUBLE_ATTEMPTS attempts were all below TROUBLE_COVERAGE. */
export function isStuck(attempts: readonly TroubleAttempt[]): boolean {
  const recent = attempts.slice(-TROUBLE_ATTEMPTS);
  return (
    recent.length === TROUBLE_ATTEMPTS &&
    recent.every((attempt) => attempt.coverage < TROUBLE_COVERAGE)
  );
}

/** Longest recognized text kept per attempt (what was heard, not audio). */
export const HEARD_MAX = 300;

/**
 * A short browser and system name for the report, e.g. "Chrome 140 ·
 * macOS", from the user agent; no version beyond the major one.
 */
export function browserLabel(userAgent: string): string {
  const ua = userAgent;
  const version = (pattern: RegExp) => pattern.exec(ua)?.[1] ?? "";
  const browser = /Edg\//.test(ua)
    ? `Edge ${version(/Edg\/(\d+)/)}`
    : /Firefox\//.test(ua)
      ? `Firefox ${version(/Firefox\/(\d+)/)}`
      : /OPR\//.test(ua)
        ? `Opera ${version(/OPR\/(\d+)/)}`
        : /Chrome\//.test(ua)
          ? `Chrome ${version(/Chrome\/(\d+)/)}`
          : /Safari\//.test(ua)
            ? `Safari ${version(/Version\/(\d+)/)}`
            : "Other";
  const system = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "Other";
  return `${browser.trim()} · ${system}`;
}

export type TroubleReport = {
  videoId: string;
  /** A created practice's version (D44); null for built-in videos. */
  materialVersion: number | null;
  sentenceIndex: number;
  attempts: { coverage: number; heard: string }[];
  browser: string;
  skipped: boolean;
};

/** The report checked and trimmed, or null if it's malformed. */
export function cleanTroubleReport(raw: unknown): TroubleReport | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const attempts = Array.isArray(r.attempts) ? r.attempts.slice(-20) : [];
  const cleanAttempts = attempts.flatMap((a) => {
    const { coverage, heard } = (a ?? {}) as Record<string, unknown>;
    return typeof coverage === "number" &&
      coverage >= 0 &&
      coverage <= 1 &&
      typeof heard === "string"
      ? [{ coverage, heard: heard.slice(0, HEARD_MAX) }]
      : [];
  });
  if (
    typeof r.videoId !== "string" ||
    r.videoId.length < 1 ||
    r.videoId.length > 80 ||
    !Number.isInteger(r.sentenceIndex) ||
    (r.sentenceIndex as number) < 0 ||
    !(
      r.materialVersion === null ||
      (Number.isInteger(r.materialVersion) && (r.materialVersion as number) > 0)
    ) ||
    typeof r.skipped !== "boolean" ||
    cleanAttempts.length === 0 ||
    cleanAttempts.length !== attempts.length
  ) {
    return null;
  }
  return {
    videoId: r.videoId,
    materialVersion: r.materialVersion as number | null,
    sentenceIndex: r.sentenceIndex as number,
    attempts: cleanAttempts,
    browser: typeof r.browser === "string" ? r.browser.slice(0, 60) : "",
    skipped: r.skipped,
  };
}
