/**
 * The activity log (P0-3, D55): what happened, by whom (a user id, never
 * an email), with only the fields needed to understand it. No practice
 * text, no recognized speech, no recordings. Kept EVENT_RETENTION_DAYS.
 */
export const EVENT_TYPES = [
  "sign_in",
  "practice_start",
  "day_complete",
  "retry",
  "practice_create",
  "practice_edit",
  "practice_delete",
  "practice_public",
  "report",
  "sentence_skip",
  "recognition_fail",
  "account_delete",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const isEventType = (value: unknown): value is EventType =>
  (EVENT_TYPES as readonly unknown[]).includes(value);

/** What the browser may record itself (the rest the server records). */
export const CLIENT_EVENT_TYPES = [
  "practice_start",
  "day_complete",
  "retry",
  "sentence_skip",
  "recognition_fail",
] as const satisfies readonly EventType[];
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

/** Days an event is kept; older ones are pruned (prune_logs). */
export const EVENT_RETENTION_DAYS = 180;

export type ActivityEvent = {
  type: EventType;
  /** The practice: a built-in video id or "p-<uuid>". */
  videoId?: string | null;
  /** The cycle day, 1–7. */
  day?: number | null;
  /** Dictation accuracy or shadowing coverage, 0–1. */
  score?: number | null;
  /** A short code: a speech error, a report reason, a visibility. */
  code?: string | null;
};

/**
 * An event from the browser, checked: a client type, a sane video id,
 * day, score, and code. Null if anything is off.
 */
export function cleanClientEvent(raw: unknown): ActivityEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!(CLIENT_EVENT_TYPES as readonly unknown[]).includes(r.type)) return null;
  const videoId = r.videoId ?? null;
  const day = r.day ?? null;
  const score = r.score ?? null;
  const code = r.code ?? null;
  if (
    !(
      videoId === null ||
      (typeof videoId === "string" && /^[\w-]{1,80}$/.test(videoId))
    ) ||
    !(
      day === null ||
      (typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 7)
    ) ||
    !(
      score === null ||
      (typeof score === "number" && score >= 0 && score <= 1)
    ) ||
    !(code === null || (typeof code === "string" && /^[\w-]{1,40}$/.test(code)))
  ) {
    return null;
  }
  return {
    type: r.type as EventType,
    videoId: videoId as string | null,
    day: day as number | null,
    score: score as number | null,
    code: code as string | null,
  };
}
