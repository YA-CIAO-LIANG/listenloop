import {
  lineHasListening,
  lineHasWriting,
  LISTENING_TIERS,
  PLAN_LINES,
  PLAN_TIERS,
  WRITING_TIERS,
  type PlanLine,
  type PlanTier,
} from "../plans";
import { WORDS_PER_MINUTE } from "../units";
import { PLAN_MONTHLY, YEARLY_MONTHS_CHARGED } from "./pricing";

/**
 * What the AI and voice behind each plan cost, and how much of its price
 * that may be (D210, Joe 2026-11-24). One place for the unit costs, the
 * caps, and the table in docs/quotas.md; tests/plan-costs.test.ts checks
 * every plan against its cap.
 *
 * Payment fees and tax are not in these costs (Joe's rule 1).
 */

/** Joe's exchange rate for these figures. */
export const TWD_PER_USD = 32.5;

/**
 * The live site's usage log (api_calls, 2026-11-06 to 2026-11-24, evals
 * left out): every step that makes a listening practice, over the 78 text
 * practices made in that time (20,540 English words, 135 minutes of
 * audio). Re-measure with scripts/cost-report.mts.
 */
export const MEASURED_LISTENING = {
  words: 20_540,
  /** US$ by step (gpt-5-mini): notes are nearly all of it. */
  languageUsd: {
    annotate: 1.786711,
    translate: 0.102772,
    segment: 0.075333,
    compose: 0.063006,
    revise: 0.003648,
    describe: 0.002434,
  },
  /** Characters sent to text to speech (Azure neural voices). */
  speechChars: 147_686,
} as const;

/**
 * Voice prices when the free tiers run out (US$, Azure retail prices API,
 * 2026-11-24): neural text to speech per million characters (S1), and
 * speech to text per hour (S0, for uploaded recordings). Azure's F0 tier
 * gives 0.5 million characters and 5 hours a month free for the whole
 * site; it's shared by everyone, so a plan's cost is reckoned at the
 * paid price and the free tier is a saving on top (D210).
 */
export const VOICE_PRICES = {
  ttsUsdPerMillionChars: 15,
  sttUsdPerHour: 1,
  f0FreeCharsPerMonth: 500_000,
  f0FreeSttHoursPerMonth: 5,
} as const;

/**
 * One essay review (D187) with its corrected sentences' meanings (D206),
 * one AI check of a set of extra practice (D200), and one chat message
 * (D197), in tokens on gpt-5-mini (US$0.25 / US$2.00 a million). Each is
 * the eval's recorded average with room for the largest case the plans
 * allow (a 1,000-word essay, a set of 6 answers, 10 turns of history):
 * the recordings averaged 1,044 / 1,089 tokens per review, 592 / 91 per
 * check, and 748 / 178 per message.
 */
export const WRITING_TOKENS = {
  essay: { input: 1_800 + 400, output: 1_600 + 200 },
  backCheck: { input: 900, output: 500 },
  chatMessage: { input: 1_050, output: 250 },
} as const;
const GPT5_MINI = { inputPerM: 0.25, outputPerM: 2.0 } as const;

/** Joe's own estimates before measuring (NT$), for the comparison. */
export const JOE_ESTIMATES = {
  listeningPerMinute: 1.86,
  essay: 0.1,
  backCheck: 0.05,
  chatMessage: 0.03,
} as const;

const tokensUsd = (t: { input: number; output: number }) =>
  (t.input * GPT5_MINI.inputPerM + t.output * GPT5_MINI.outputPerM) / 1_000_000;

/** NT$ per unit, from the measurements above (D210). */
export const UNIT_COSTS = (() => {
  const m = MEASURED_LISTENING;
  const language =
    Object.values(m.languageUsd).reduce((a, b) => a + b, 0) / m.words;
  const tts =
    ((m.speechChars / m.words) * VOICE_PRICES.ttsUsdPerMillionChars) /
    1_000_000;
  // An uploaded recording is heard instead of voiced: per word at
  // WORDS_PER_MINUTE. The dearer of the two is the voice's cost.
  const stt = VOICE_PRICES.sttUsdPerHour / 60 / WORDS_PER_MINUTE;
  return {
    /** A word of one's own practice: AI text (notes, translation…). */
    listeningTextPerWord: language * TWD_PER_USD,
    /** A word of one's own practice: its voice (or hearing a recording). */
    listeningVoicePerWord: Math.max(tts, stt) * TWD_PER_USD,
    essay: tokensUsd(WRITING_TOKENS.essay) * TWD_PER_USD,
    backCheck: tokensUsd(WRITING_TOKENS.backCheck) * TWD_PER_USD,
    chatMessage: tokensUsd(WRITING_TOKENS.chatMessage) * TWD_PER_USD,
  } as const;
})();

/** NT$ for a minute (WORDS_PER_MINUTE words) of one's own practice. */
export const listeningCostPerMinute = () =>
  (UNIT_COSTS.listeningTextPerWord + UNIT_COSTS.listeningVoicePerWord) *
  WORDS_PER_MINUTE;

/** Weeks in a month, for weekly allowances. */
export const WEEKS_PER_MONTH = 52 / 12;

/**
 * The most AI and voice may cost of a plan's yearly price a month (Joe's
 * rule 1): Plus and class plans 30%; students 40% (verified, and they
 * seldom use everything); Pro 45% (who pays most seldom uses all of it).
 */
export const COST_CAPS: Readonly<Record<PlanTier | "class", number>> = {
  student: 0.4,
  plus: 0.3,
  pro: 0.45,
  class: 0.3,
};

/** "Typical use" in the tables: this share of every allowance. */
export const TYPICAL_USE = [0.3, 0.5] as const;

/** What a plan allows a month, for its cost. */
export type MonthlyAllowance = {
  words: number;
  essaysPerWeek: number;
  backChecksPerWeek: number;
  chatMessagesPerWeek: number;
};

/** NT$ a month when `share` of every allowance is used. */
export function allowanceCost(a: MonthlyAllowance, share = 1): number {
  const u = UNIT_COSTS;
  const listening =
    a.words * (u.listeningTextPerWord + u.listeningVoicePerWord);
  const writing =
    WEEKS_PER_MONTH *
    (a.essaysPerWeek * u.essay +
      a.backChecksPerWeek * u.backCheck +
      a.chatMessagesPerWeek * u.chatMessage);
  return (listening + writing) * share;
}

/**
 * What a paid plan adds over free, a month (D210): its line's parts.
 * The free plan's own allowances are everyone's cost, like the free plan.
 */
export function planAllowance(
  line: PlanLine,
  tier: PlanTier,
): MonthlyAllowance {
  const listening = LISTENING_TIERS[tier];
  const writing = WRITING_TIERS[tier];
  return {
    words: lineHasListening(line) ? (listening.wordsPerMonth ?? 0) : 0,
    essaysPerWeek: lineHasWriting(line)
      ? (writing.writingReviewsPerWeek ?? 0)
      : 0,
    backChecksPerWeek: lineHasWriting(line)
      ? (writing.backChecksPerWeek ?? 0)
      : 0,
    chatMessagesPerWeek: lineHasWriting(line)
      ? (writing.chatMessagesPerWeek ?? 0)
      : 0,
  };
}

/** A yearly price's month: monthly × 10 ÷ 12 (Joe's rule 1). */
export const yearlyMonthAverage = (monthly: number) =>
  (monthly * YEARLY_MONTHS_CHARGED) / 12;

export type CostRow = {
  /** "all-plus", "class-small-writing"… */
  id: string;
  kind: "personal" | "class";
  line: PlanLine;
  /** The tier, or the class size. */
  tier: PlanTier | "small" | "standard" | "large";
  monthly: number;
  /** The yearly price's month, what the cap is a share of. */
  base: number;
  cap: number;
  fullCost: number;
  fullShare: number;
  /** Cost and share at each TYPICAL_USE. */
  typical: { use: number; cost: number; share: number }[];
};

function row(
  id: string,
  kind: CostRow["kind"],
  line: PlanLine,
  tier: CostRow["tier"],
  monthly: number,
  cap: number,
  allowance: MonthlyAllowance,
): CostRow {
  const base = yearlyMonthAverage(monthly);
  const fullCost = allowanceCost(allowance);
  return {
    id,
    kind,
    line,
    tier,
    monthly,
    base,
    cap,
    fullCost,
    fullShare: fullCost / base,
    typical: TYPICAL_USE.map((use) => ({
      use,
      cost: fullCost * use,
      share: (fullCost * use) / base,
    })),
  };
}

/** Every personal plan (D210). */
export function personalCostRows(): CostRow[] {
  return PLAN_LINES.flatMap((line) =>
    PLAN_TIERS.map((tier) =>
      row(
        `${line}-${tier}`,
        "personal",
        line,
        tier,
        PLAN_MONTHLY[line][tier],
        COST_CAPS[tier],
        planAllowance(line, tier),
      ),
    ),
  );
}

/** A class plan's allowances by line (lib/classroom.ts). */
export type ClassAllowanceTier = {
  id: "small" | "standard" | "large";
  seats: number;
  monthly: Readonly<Record<PlanLine, number>>;
  words: number;
  perStudent: {
    essaysPerWeek: number;
    backChecksPerWeek: number;
    chatMessagesPerWeek: number;
  };
};

/** A class plan's month: the teacher's words, each student's writing. */
export function classAllowance(
  tier: ClassAllowanceTier,
  line: PlanLine,
): MonthlyAllowance {
  const s = tier.perStudent;
  const writing = lineHasWriting(line);
  return {
    words: lineHasListening(line) ? tier.words : 0,
    essaysPerWeek: writing ? s.essaysPerWeek * tier.seats : 0,
    backChecksPerWeek: writing ? s.backChecksPerWeek * tier.seats : 0,
    chatMessagesPerWeek: writing ? s.chatMessagesPerWeek * tier.seats : 0,
  };
}

export function classCostRows(tiers: readonly ClassAllowanceTier[]): CostRow[] {
  return tiers.flatMap((tier) =>
    PLAN_LINES.map((line) =>
      row(
        `class-${tier.id}-${line}`,
        "class",
        line,
        tier.id,
        tier.monthly[line],
        COST_CAPS.class,
        classAllowance(tier, line),
      ),
    ),
  );
}

/**
 * NT$ per unit of each allowance on a line (price ÷ allowance, D210):
 * Pro must be lowest, then the student tier, then Plus, on every line
 * (tests/plan-lines.test.ts). Units the line doesn't include are left out.
 */
export function unitPrices(
  line: PlanLine,
): Partial<Record<keyof MonthlyAllowance, Record<PlanTier, number>>> {
  const out: Partial<Record<keyof MonthlyAllowance, Record<PlanTier, number>>> =
    {};
  const keys: (keyof MonthlyAllowance)[] = [
    "words",
    "essaysPerWeek",
    "backChecksPerWeek",
    "chatMessagesPerWeek",
  ];
  for (const key of keys) {
    const per = Object.fromEntries(
      PLAN_TIERS.map((tier) => {
        const amount = planAllowance(line, tier)[key];
        return [tier, amount > 0 ? PLAN_MONTHLY[line][tier] / amount : 0];
      }),
    ) as Record<PlanTier, number>;
    if (PLAN_TIERS.every((tier) => per[tier] > 0)) out[key] = per;
  }
  return out;
}
