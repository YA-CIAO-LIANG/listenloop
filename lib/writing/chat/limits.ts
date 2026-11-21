/**
 * The chat's server-side limits (D197), so one chat can't cost more than
 * its minutes allow even if the page is changed.
 */
/** Messages the learner may send a minute, at most (on average). */
export const MESSAGES_PER_MINUTE = 2;
/** Extra time after the chosen length to send a last message. */
export const GRACE_SECONDS = 60;
/** The longest message, in characters. */
export const MAX_MESSAGE = 400;
/** Turns of the conversation sent with each message (both sides). */
export const HISTORY_TURNS = 10;
/** A custom situation, in characters. */
export const MAX_SITUATION = 200;

export const maxMessages = (minutes: number) =>
  Math.ceil(minutes * MESSAGES_PER_MINUTE);

/** Minutes used from start to now, rounded up, at least 1. */
export const usedMinutes = (startedAt: string, now: Date = new Date()) =>
  Math.max(1, Math.ceil((now.getTime() - Date.parse(startedAt)) / 60_000));
