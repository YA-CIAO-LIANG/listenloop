import { lineHasListening, planParts, PLANS, type PlanId } from "./plans";
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
  /**
   * Fair priority (D162): each level of priority counts as having joined
   * this many seconds earlier. Pro (2) is treated as 6 minutes ahead,
   * Plus (1) 3 minutes, free (0) as it is; so a free job that has waited
   * over 6 minutes goes before a Pro job that just arrived, and nobody
   * waits for ever.
   */
  headStartSeconds: 180,
} as const;

/**
 * Priority by plan (D162, D210): free 0; a paid plan with listening 1;
 * Pro's listening (its "priority") and admins 2. The queue is for making
 * practices, so the writing line waits like the free plan.
 */
export function queuePriority(plan: PlanId): 0 | 1 | 2 {
  if (plan === "admin" || PLANS[plan].priority) return 2;
  const parts = planParts(plan);
  return parts && lineHasListening(parts.line) ? 1 : 0;
}

/**
 * Where a job stands in line (D162), the same rule as queue_position in
 * the database: the earlier its key, the sooner its turn.
 */
export function queueKey(enqueuedAtMs: number, priority: number): number {
  return enqueuedAtMs - priority * QUEUE.headStartSeconds * 1000;
}

/** Each job's ticket: one per practice's audio, one per recording. */
export const queueTicket = (resource: QueueResource, id: string) =>
  `${resource}:${id}`;
