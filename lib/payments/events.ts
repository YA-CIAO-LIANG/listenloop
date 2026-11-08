import { isBillingInterval } from "./pricing";
import type { PaymentEvent, SubscriptionStatus } from "./types";

/**
 * Checks a parsed webhook body against PaymentEvent (D85): anything the
 * app doesn't expect is refused whole, never half applied.
 */
const STATUSES: readonly SubscriptionStatus[] = [
  "active",
  "past_due",
  "expired",
];

const text = (value: unknown, max = 200): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const time = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

export function parsePaymentEvent(raw: unknown): PaymentEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (!text(e.id) || !time(e.occurredAt) || typeof e.test !== "boolean") {
    return null;
  }
  const base = { id: e.id, occurredAt: e.occurredAt, test: e.test };
  switch (e.type) {
    case "subscription.updated":
      return text(e.userId) &&
        text(e.subscriptionId) &&
        STATUSES.includes(e.status as SubscriptionStatus) &&
        isBillingInterval(e.interval) &&
        time(e.periodEnd) &&
        typeof e.cancelAtPeriodEnd === "boolean"
        ? {
            ...base,
            type: e.type,
            userId: e.userId,
            subscriptionId: e.subscriptionId,
            status: e.status as SubscriptionStatus,
            interval: e.interval,
            periodEnd: e.periodEnd,
            cancelAtPeriodEnd: e.cancelAtPeriodEnd,
          }
        : null;
    case "payment.succeeded":
      return text(e.userId) &&
        text(e.paymentId) &&
        Number.isInteger(e.amount) &&
        (e.amount as number) >= 0 &&
        typeof e.currency === "string" &&
        /^[A-Z]{3}$/.test(e.currency) &&
        (e.interval === null || isBillingInterval(e.interval))
        ? {
            ...base,
            type: e.type,
            userId: e.userId,
            paymentId: e.paymentId,
            amount: e.amount as number,
            currency: e.currency,
            interval: e.interval,
          }
        : null;
    case "payment.refunded":
      return text(e.paymentId)
        ? { ...base, type: e.type, paymentId: e.paymentId }
        : null;
    default:
      return null;
  }
}
