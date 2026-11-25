import { unitPrices } from "./payments/costs";
import {
  averagePerMonth,
  PLAN_PRICES,
  type BillingPeriod,
} from "./payments/pricing";
import { planParts, type PlanId, type PlanLine, type PlanTier } from "./plans";
import { WORDS_PER_SHORT_TEXT } from "./units";
import { maxMessages } from "./writing/chat/limits";

/**
 * The numbers the pricing page shows beside each price (D210), all made
 * from the price and plan tables so they can't drift:
 * - "all": what it saves a month against buying listening and writing;
 * - student: how much cheaper than Plus on the same line;
 * - Pro: how much less each unit of allowance costs than on Plus;
 * - friendly conversions: words as short texts, messages as chats.
 */

/** A plan's price a month for `period`: a yearly one ÷ 12, rounded. */
export function pricePerMonth(
  line: PlanLine,
  tier: PlanTier,
  period: BillingPeriod,
): number {
  const total = PLAN_PRICES[line][tier][period].amount;
  return period === "year" ? averagePerMonth(total) : total;
}

/** NT$ a month "all" saves against listening plus writing (D210). */
export function bundleSaving(tier: PlanTier, period: BillingPeriod): number {
  return (
    pricePerMonth("listening", tier, period) +
    pricePerMonth("writing", tier, period) -
    pricePerMonth("all", tier, period)
  );
}

/** How much cheaper the student tier is than Plus on a line, 0–1. */
export function studentDiscount(line: PlanLine): number {
  const plus = PLAN_PRICES[line].plus.month.amount;
  return (plus - PLAN_PRICES[line].student.month.amount) / plus;
}

/**
 * How much less each unit of allowance costs on Pro than on Plus, 0–1:
 * the smallest saving over the line's units, so the claim holds for
 * every one of them.
 */
export function proUnitSaving(line: PlanLine): number {
  const savings = Object.values(unitPrices(line)).map(
    (per) => 1 - per.pro / per.plus,
  );
  return Math.min(...savings);
}

/** Short texts of WORDS_PER_SHORT_TEXT words in `words`. */
export const shortTexts = (words: number) =>
  Math.floor(words / WORDS_PER_SHORT_TEXT);

/** The length used to explain chat messages: a 10-minute chat. */
export const CHAT_EXAMPLE_MINUTES = 10;

/** Whole 10-minute chats in `messages` (each has up to 20 messages). */
export const chatSessions = (messages: number) =>
  Math.floor(messages / maxMessages(CHAT_EXAMPLE_MINUTES));

/** A weekly amount as a day's average, one decimal. */
export const perDay = (perWeek: number) => Math.round((perWeek / 7) * 10) / 10;

/**
 * The plan to offer someone who reached a listening limit (D210): free →
 * Plus listening; the writing line → "all" at their tier (an upgrade to
 * all-in-one); listening or "all" below Pro → Pro on the same line;
 * Pro and admins → none.
 */
export function listeningOffer(
  plan: PlanId,
): { line: PlanLine; tier: PlanTier; upsell: boolean } | null {
  if (plan === "admin") return null;
  const parts = planParts(plan);
  if (!parts) return { line: "listening", tier: "plus", upsell: false };
  if (parts.line === "writing") {
    return { line: "all", tier: parts.tier, upsell: true };
  }
  return parts.tier === "pro"
    ? null
    : { line: parts.line, tier: "pro", upsell: false };
}
