/**
 * Capacity forecasts (D156): when the Azure credit runs out at the pace
 * of the last 30 days, and when Supabase's free database and storage
 * fill up at the pace of the daily samples. Pure; shown on /admin/usage
 * and in the weekly summary.
 */

const DAY_MS = 86_400_000;

export type CreditForecast = {
  /** Average spend a day over the window, micro-dollars. */
  perDayMicros: number;
  leftMicros: number;
  /** YYYY-MM-DD when the credit would be used up; null: not at this pace. */
  runsOutOn: string | null;
  /** The credit expires before it would run out. */
  expiresFirst: boolean;
  /** Days of data behind the average (fewer than 7: a rough guess). */
  days: number;
};

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function creditForecast({
  dailyMicros,
  creditMicros,
  spentMicros,
  endsOn,
  today,
}: {
  /** Spend on each recent day (any order), up to 30 days. */
  dailyMicros: number[];
  creditMicros: number;
  spentMicros: number;
  /** YYYY-MM-DD the credit expires. */
  endsOn: string;
  today: Date;
}): CreditForecast {
  const days = dailyMicros.length;
  const perDayMicros =
    days === 0 ? 0 : dailyMicros.reduce((a, b) => a + b, 0) / days;
  const leftMicros = Math.max(0, creditMicros - spentMicros);
  const expiry = Date.parse(`${endsOn}T00:00:00Z`);
  if (perDayMicros <= 0) {
    return {
      perDayMicros,
      leftMicros,
      runsOutOn: null,
      expiresFirst: true,
      days,
    };
  }
  const out = today.getTime() + Math.ceil(leftMicros / perDayMicros) * DAY_MS;
  return {
    perDayMicros,
    leftMicros,
    runsOutOn: isoDate(out),
    expiresFirst: expiry <= out,
    days,
  };
}

export type CapacitySample = {
  /** YYYY-MM-DD */
  day: string;
  bytes: number;
};

export type CapacityForecast = {
  /** Bytes a day by least squares; 0 or less: not growing. */
  perDayBytes: number;
  latestBytes: number;
  /** YYYY-MM-DD when it would reach the cap; null: not at this pace. */
  fullOn: string | null;
};

/** A straight line through the samples, and where it meets `cap`. */
export function capacityForecast(
  samples: CapacitySample[],
  cap: number,
): CapacityForecast | null {
  if (samples.length === 0) return null;
  const points = samples
    .map((s) => ({ x: Date.parse(`${s.day}T00:00:00Z`) / DAY_MS, y: s.bytes }))
    .sort((a, b) => a.x - b.x);
  const latest = points[points.length - 1];
  if (points.length < 2) {
    return { perDayBytes: 0, latestBytes: latest.y, fullOn: null };
  }
  const n = points.length;
  const meanX = points.reduce((a, p) => a + p.x, 0) / n;
  const meanY = points.reduce((a, p) => a + p.y, 0) / n;
  const sxx = points.reduce((a, p) => a + (p.x - meanX) ** 2, 0);
  const sxy = points.reduce((a, p) => a + (p.x - meanX) * (p.y - meanY), 0);
  const slope = sxx === 0 ? 0 : sxy / sxx;
  if (slope <= 0) {
    return { perDayBytes: slope, latestBytes: latest.y, fullOn: null };
  }
  const daysLeft = Math.max(0, (cap - latest.y) / slope);
  return {
    perDayBytes: slope,
    latestBytes: latest.y,
    fullOn: isoDate((latest.x + Math.ceil(daysLeft)) * DAY_MS),
  };
}
