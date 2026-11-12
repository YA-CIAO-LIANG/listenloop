/**
 * The line for work a free-tier service can only do so fast (D133):
 * Azure Speech F0 voices about 20 sentences a minute and writes down one
 * recording at a time, so practices are made one after another instead
 * of all failing as "busy" together. Pro plans go first (D102).
 */
export type QueueResource = "speech" | "transcribe";

export const QUEUE = {
  /** How many jobs of each kind work at once. */
  slots: { speech: 1, transcribe: 1 } satisfies Record<QueueResource, number>,
  /** A ticket not seen for this long (the page was closed) drops out. */
  staleSeconds: 90,
  /** How often a waiting page asks again. */
  pollSeconds: 5,
  /** A page stops waiting after this long and says to try later. */
  maxWaitSeconds: 30 * 60,
} as const;

/** Each job's ticket: one per practice's audio, one per recording. */
export const queueTicket = (resource: QueueResource, id: string) =>
  `${resource}:${id}`;
