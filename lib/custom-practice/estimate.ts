/**
 * How long getting a practice ready takes (D95): notes and audio, per
 * sentence. Until this device has made a practice, the defaults (measured
 * on the live site, Azure, in November 2026) are the guess; after that,
 * the average this device actually saw.
 */
export const GENERATION_SPEED = {
  /** Seconds per sentence for notes plus audio, before any measurement. */
  secondsPerSentence: 2.5,
  /** Measurements kept in the average (newer ones weigh the same). */
  samples: 10,
} as const;

/** Beyond this, suggest leaving the page while it finishes (D95). */
export const LONG_JOB_SECONDS = 60;

/** Where this device keeps its measured speed. */
export const SPEED_STORAGE_KEY = "ll-gen-speed:v1";

export type MeasuredSpeed = { secondsPerSentence: number; samples: number };

export function parseSpeed(value: unknown): MeasuredSpeed | null {
  if (typeof value !== "object" || value === null) return null;
  const { secondsPerSentence, samples } = value as Record<string, unknown>;
  return typeof secondsPerSentence === "number" &&
    secondsPerSentence > 0 &&
    secondsPerSentence < 120 &&
    Number.isInteger(samples) &&
    (samples as number) > 0
    ? { secondsPerSentence, samples: samples as number }
    : null;
}

/** Seconds per sentence: this device's average, or the default. */
export function secondsPerSentence(measured: MeasuredSpeed | null): number {
  return measured?.secondsPerSentence ?? GENERATION_SPEED.secondsPerSentence;
}

/** The average with one more measurement (a whole job's seconds). */
export function addMeasurement(
  measured: MeasuredSpeed | null,
  seconds: number,
  sentences: number,
): MeasuredSpeed | null {
  if (sentences <= 0 || !(seconds > 0)) return measured;
  const sample = seconds / sentences;
  const count = Math.min(measured?.samples ?? 0, GENERATION_SPEED.samples - 1);
  const previous = measured?.secondsPerSentence ?? sample;
  return {
    secondsPerSentence: (previous * count + sample) / (count + 1),
    samples: count + 1,
  };
}

/** The whole job, before it starts. */
export function estimateSeconds(
  sentences: number,
  perSentence: number,
): number {
  return Math.max(5, Math.round(sentences * perSentence));
}

/**
 * What's left of a running job: from its own pace once a bit is done
 * (it knows the service's speed today), else from the estimate.
 */
export function remainingSeconds(
  fractionDone: number,
  elapsedSeconds: number,
  estimate: number,
): number {
  const done = Math.min(Math.max(fractionDone, 0), 1);
  if (done >= 1) return 0;
  if (done >= 0.1 && elapsedSeconds >= 3) {
    return Math.round((elapsedSeconds * (1 - done)) / done);
  }
  return Math.max(0, Math.round(estimate * (1 - done)));
}

/** Rounded for people: 10-second steps under a minute, else whole minutes. */
export function roundForDisplay(seconds: number): {
  minutes: number;
  seconds: number;
} {
  if (seconds < 55) {
    return { minutes: 0, seconds: Math.max(10, Math.ceil(seconds / 10) * 10) };
  }
  return { minutes: Math.ceil(seconds / 60), seconds: 0 };
}
