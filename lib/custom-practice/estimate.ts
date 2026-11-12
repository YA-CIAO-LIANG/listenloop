/**
 * How long getting a practice ready takes (D95, D142): notes and audio,
 * per sentence. The guess, best first: the site's median over its recent
 * practices (each one's real time is recorded, from every device); else
 * the average this device saw; else the default.
 */
export const GENERATION_SPEED = {
  /** Seconds per sentence for notes plus audio, before any measurement. */
  secondsPerSentence: 2,
  /** Measurements kept in this device's average (newer ones weigh the same). */
  samples: 10,
  /** Recent practices the site's median is taken over. */
  siteSamples: 50,
  /** Fewer measured practices than this and the site has no median yet. */
  siteMinimum: 3,
} as const;

/** One practice's measured time: seconds for its sentences. */
export type GenerationSample = { seconds: number; sentences: number };

/**
 * The site's seconds per sentence (D142): the median of recent practices'
 * own pace, so one stuck or very fast job doesn't move it. Null with too
 * few measurements.
 */
export function sitePace(samples: readonly GenerationSample[]): number | null {
  const paces = samples
    .filter((s) => s.sentences > 0 && s.seconds > 0)
    .map((s) => s.seconds / s.sentences)
    .filter((pace) => pace < 120)
    .sort((a, b) => a - b);
  if (paces.length < GENERATION_SPEED.siteMinimum) return null;
  const middle = Math.floor(paces.length / 2);
  return paces.length % 2
    ? paces[middle]
    : (paces[middle - 1] + paces[middle]) / 2;
}

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

/** Seconds per sentence: the site's median, this device's average, or the default. */
export function secondsPerSentence(
  measured: MeasuredSpeed | null,
  site: number | null = null,
): number {
  return (
    site ?? measured?.secondsPerSentence ?? GENERATION_SPEED.secondsPerSentence
  );
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

/**
 * Rounded for people: 10-second steps under a minute, else the nearest
 * whole minute (D142: rounding up made 61 seconds "2 minutes").
 */
export function roundForDisplay(seconds: number): {
  minutes: number;
  seconds: number;
} {
  if (seconds < 55) {
    return { minutes: 0, seconds: Math.max(10, Math.ceil(seconds / 10) * 10) };
  }
  return { minutes: Math.max(1, Math.round(seconds / 60)), seconds: 0 };
}
