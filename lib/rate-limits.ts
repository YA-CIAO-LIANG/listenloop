/**
 * How often each action may run (D63), per account when signed in, else
 * per IP address (hashed). Generous for real use; there to stop scripts
 * and loops, not learners. Change the numbers here only.
 */
export const RATE_LIMITS = {
  /** Feedback from the footer's form. */
  feedback: { windowSeconds: 3600, max: 5 },
  /** Hard-sentence reports while shadowing (D52). */
  troubleReport: { windowSeconds: 3600, max: 30 },
  /** Activity events from the browser (D55). */
  event: { windowSeconds: 3600, max: 300 },
  /** Reporting a public practice (D31; also a daily cap). */
  report: { windowSeconds: 3600, max: 10 },
  /** Every AI step: splitting, translating, notes, audio, writing. */
  ai: { windowSeconds: 3600, max: 600 },
  /** Downloading your data. */
  export: { windowSeconds: 3600, max: 10 },
  /** Starting a checkout or changing a subscription (D85). */
  billing: { windowSeconds: 3600, max: 20 },
  /** Steps toward paying, from the fake doors (D93). */
  intent: { windowSeconds: 3600, max: 120 },
} as const;

export type RateLimitedAction = keyof typeof RATE_LIMITS;
