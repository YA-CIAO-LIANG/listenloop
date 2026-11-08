import type { BillingInterval } from "./pricing";

/**
 * Payments (D85) talk to one provider through this interface, so the
 * fake one (development and tests) and a real one (Lemon Squeezy, Paddle,
 * …; docs/payments.md) are swapped by configuration, not code changes.
 */

export type SubscriptionStatus = "active" | "past_due" | "expired";

/**
 * What a provider tells us, in our own words. Every real provider's
 * webhook is translated into these before anything is applied.
 */
export type PaymentEvent = {
  /** The provider's event id: the same event twice is applied once. */
  id: string;
  /** When it happened at the provider (ISO 8601), for ordering. */
  occurredAt: string;
  /** Made with the fake provider: never real money. */
  test: boolean;
} & (
  | {
      type: "subscription.updated";
      userId: string;
      subscriptionId: string;
      status: SubscriptionStatus;
      interval: BillingInterval;
      /** When the paid period ends (and renews, unless cancelled). */
      periodEnd: string;
      cancelAtPeriodEnd: boolean;
    }
  | {
      type: "payment.succeeded";
      userId: string;
      paymentId: string;
      /** In the currency's smallest unit (lib/payments/pricing.ts). */
      amount: number;
      currency: string;
      interval: BillingInterval | null;
    }
  | { type: "payment.refunded"; paymentId: string }
);

export type CheckoutInput = {
  userId: string;
  email: string | null;
  interval: BillingInterval;
  /** Absolute URLs the provider sends the buyer back to. */
  successUrl: string;
  cancelUrl: string;
};

/** A stored subscription, as providers need it for changes. */
export type SubscriptionRef = {
  subscriptionId: string;
  userId: string;
  interval: BillingInterval;
  periodEnd: string;
};

export interface PaymentProvider {
  /** Stored with each subscription and payment ("fake", "lemonsqueezy"…). */
  readonly id: string;
  /** True for the fake provider: pages say "test", nothing is charged. */
  readonly test: boolean;
  /** Where to send the buyer to pay. */
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  /**
   * The event in a webhook request, or null when its signature doesn't
   * verify (wrong secret, changed body, or too old: a replay).
   */
  parseWebhook(
    rawBody: string,
    headers: Headers,
    now: Date,
  ): Promise<PaymentEvent | null>;
  /** Stop (or resume) renewing at the end of the paid period. */
  setCancelAtPeriodEnd(
    subscription: SubscriptionRef,
    cancel: boolean,
  ): Promise<void>;
  /** Give a payment's money back in full. */
  refund(paymentId: string): Promise<void>;
}
