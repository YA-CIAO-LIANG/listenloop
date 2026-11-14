/**
 * The Van Westendorp price sensitivity survey (D174): four prices a
 * month, in NT$, at which a person finds the plan too cheap to trust,
 * a bargain, getting expensive, and too expensive to consider. Asked
 * once, after Day 7 or a while on the pricing page; skippable.
 */
export const PRICE_SURVEY_QUESTIONS = [
  "tooExpensive",
  "expensive",
  "bargain",
  "tooCheap",
] as const;
export type PriceQuestion = (typeof PRICE_SURVEY_QUESTIONS)[number];

export type PriceAnswers = Record<PriceQuestion, number>;

export const PRICE_SURVEY = {
  /** NT$ a month an answer may be. */
  max: 5_000,
  /** Seconds on the pricing page before it's offered there. */
  pricingDwellSeconds: 30,
  /** Answers before the curves are worth reading. */
  minResponses: 30,
} as const;

export const PRICE_SURVEY_CONTEXTS = ["day7", "pricing"] as const;
export type PriceSurveyContext = (typeof PRICE_SURVEY_CONTEXTS)[number];

/**
 * Answers as typed: whole NT$ 0–max, in order (too cheap ≤ bargain ≤
 * expensive ≤ too expensive, the first below the last). Null otherwise:
 * the form then says which order it expects.
 */
export function cleanPriceAnswers(input: unknown): PriceAnswers | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const out: Partial<PriceAnswers> = {};
  for (const q of PRICE_SURVEY_QUESTIONS) {
    const value =
      typeof raw[q] === "string" && (raw[q] as string).trim() !== ""
        ? Number(raw[q])
        : raw[q];
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > PRICE_SURVEY.max
    ) {
      return null;
    }
    out[q] = value;
  }
  const a = out as PriceAnswers;
  const ordered =
    a.tooCheap <= a.bargain &&
    a.bargain <= a.expensive &&
    a.expensive <= a.tooExpensive &&
    a.tooCheap < a.tooExpensive;
  return ordered ? a : null;
}

export type CurvePoint = {
  price: number;
  tooCheap: number;
  bargain: number;
  expensive: number;
  tooExpensive: number;
};

/**
 * The four cumulative curves at each price (shares 0–1): "too cheap" and
 * "a bargain" fall as the price rises (share whose answer is ≥ price);
 * "expensive" and "too expensive" rise (share whose answer is ≤ price).
 */
export function priceCurves(
  answers: readonly PriceAnswers[],
  steps = 60,
): CurvePoint[] {
  if (answers.length === 0) return [];
  const all = answers.flatMap((a) => PRICE_SURVEY_QUESTIONS.map((q) => a[q]));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const n = answers.length;
  const share = (pred: (a: PriceAnswers) => boolean) =>
    answers.filter(pred).length / n;
  const points: CurvePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const price = hi === lo ? lo : lo + ((hi - lo) * i) / steps;
    points.push({
      price,
      tooCheap: share((a) => a.tooCheap >= price),
      bargain: share((a) => a.bargain >= price),
      expensive: share((a) => a.expensive <= price),
      tooExpensive: share((a) => a.tooExpensive <= price),
    });
  }
  return points;
}

/** Where f − g changes sign first, interpolated; null if it never does. */
function crossing(
  points: readonly CurvePoint[],
  f: (p: CurvePoint) => number,
  g: (p: CurvePoint) => number,
): number | null {
  for (let i = 1; i < points.length; i++) {
    const d0 = f(points[i - 1]) - g(points[i - 1]);
    const d1 = f(points[i]) - g(points[i]);
    if (d0 === 0) return points[i - 1].price;
    if ((d0 > 0 && d1 <= 0) || (d0 < 0 && d1 >= 0)) {
      const t = d0 / (d0 - d1);
      const { price: p0 } = points[i - 1];
      return p0 + (points[i].price - p0) * t;
    }
  }
  return null;
}

export type PriceRange = {
  /** Point of marginal cheapness: below it, too many doubt the quality. */
  low: number | null;
  /** Optimal price point: as many find it too cheap as too expensive. */
  optimal: number | null;
  /** Indifference price point: as many find it a bargain as expensive. */
  indifference: number | null;
  /** Point of marginal expensiveness: above it, too many won't consider it. */
  high: number | null;
};

/**
 * The usual Van Westendorp reading: the acceptable range runs from where
 * "too cheap" meets "not a bargain" to where "too expensive" meets "not
 * expensive"; the optimal point is "too cheap" × "too expensive"; the
 * indifference point "a bargain" × "expensive". Rounded to whole NT$.
 */
export function priceRange(points: readonly CurvePoint[]): PriceRange {
  const round = (n: number | null) => (n === null ? null : Math.round(n));
  return {
    low: round(
      crossing(
        points,
        (p) => p.tooCheap,
        (p) => 1 - p.bargain,
      ),
    ),
    optimal: round(
      crossing(
        points,
        (p) => p.tooCheap,
        (p) => p.tooExpensive,
      ),
    ),
    indifference: round(
      crossing(
        points,
        (p) => p.bargain,
        (p) => p.expensive,
      ),
    ),
    high: round(
      crossing(
        points,
        (p) => 1 - p.expensive,
        (p) => p.tooExpensive,
      ),
    ),
  };
}
