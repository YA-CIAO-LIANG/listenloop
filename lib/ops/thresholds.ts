/**
 * When monitoring calls for attention (D156). Every number the alerts
 * use is here; change them here only.
 */
export const OPS_THRESHOLDS = {
  /** Server errors in the last 15 minutes: this many at least… */
  errorBurstMin: 10,
  /** …and this many times the 15-minute average of the last 7 days. */
  errorBurstFactor: 5,
  /** Share of an allowance (AI month, speech characters, transcription). */
  quotaWarnShare: 0.8,
  /** Today's spend vs. the daily average of the previous 7 days… */
  spendSpikeFactor: 3,
  /** …but only when today is at least this much (micro-dollars, US$0.10). */
  spendSpikeMinMicros: 100_000,
  /** Supabase Free: share of the 500 MB database and 1 GB storage. */
  supabaseWarnShare: 0.8,
  /** Sign-ups or reports in the last hour. */
  signupsPerHour: 20,
  reportsPerHour: 10,
  /** The same alert isn't sent again within this many hours. */
  repeatHours: 6,
} as const;
