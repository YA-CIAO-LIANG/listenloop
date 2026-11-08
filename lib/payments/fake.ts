import { randomUUID } from "node:crypto";
import { parsePaymentEvent } from "./events";
import { PRICES, type BillingInterval } from "./pricing";
import { SIGNATURE_HEADER, signPayload, verifySignature } from "./signature";
import type {
  PaymentEvent,
  PaymentProvider,
  SubscriptionRef,
  SubscriptionStatus,
} from "./types";

/**
 * The fake payment provider (D85), for development and every test: no
 * money, no network. It behaves like a real one where it matters: its
 * checkout is a page of ours (/checkout/fake) with "pay" and "fail", and
 * every change comes back as a signed webhook event, delivered to the
 * same handler a real provider's would reach, so signatures,
 * idempotency, and plan changes are all exercised.
 */
export type FakeProvider = PaymentProvider & {
  /** The buyer paid on the fake checkout page. */
  completeCheckout(userId: string, interval: BillingInterval): Promise<void>;
  /** What a real provider does later on its own (admins test with it). */
  simulate(
    subscription: SubscriptionRef,
    change: "renew" | "past_due" | "expire",
  ): Promise<void>;
};

export type Deliver = (rawBody: string, headers: Headers) => Promise<void>;

const addInterval = (from: Date, interval: BillingInterval) => {
  const next = new Date(from);
  if (interval === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
};

export const fakeSubscriptionId = (userId: string) => `fake_sub_${userId}`;

export function fakePaymentProvider({
  secret,
  deliver,
  now = () => new Date(),
}: {
  secret: string;
  deliver: Deliver;
  now?: () => Date;
}): FakeProvider {
  async function send(event: PaymentEvent) {
    const body = JSON.stringify(event);
    await deliver(
      body,
      new Headers({ [SIGNATURE_HEADER]: signPayload(secret, body, now()) }),
    );
  }
  const base = () => ({
    id: `fake_evt_${randomUUID()}`,
    occurredAt: now().toISOString(),
    test: true,
  });
  const subscription = (
    ref: SubscriptionRef,
    status: SubscriptionStatus,
    cancelAtPeriodEnd: boolean,
    periodEnd = ref.periodEnd,
  ): PaymentEvent => ({
    ...base(),
    type: "subscription.updated",
    userId: ref.userId,
    subscriptionId: ref.subscriptionId,
    status,
    interval: ref.interval,
    periodEnd,
    cancelAtPeriodEnd,
  });
  const payment = (
    userId: string,
    interval: BillingInterval,
  ): PaymentEvent => ({
    ...base(),
    type: "payment.succeeded",
    userId,
    paymentId: `fake_pay_${randomUUID()}`,
    ...PRICES[interval],
    interval,
  });

  return {
    id: "fake",
    test: true,
    async createCheckout({ interval, successUrl }) {
      const url = new URL("/checkout/fake", successUrl);
      url.searchParams.set("interval", interval);
      return { url: url.toString() };
    },
    async parseWebhook(rawBody, headers, at) {
      if (
        !verifySignature(secret, rawBody, headers.get(SIGNATURE_HEADER), at)
      ) {
        return null;
      }
      try {
        return parsePaymentEvent(JSON.parse(rawBody));
      } catch {
        return null;
      }
    },
    async setCancelAtPeriodEnd(ref, cancel) {
      await send(subscription(ref, "active", cancel));
    },
    async refund(paymentId) {
      await send({ ...base(), type: "payment.refunded", paymentId });
    },
    async completeCheckout(userId, interval) {
      const ref = {
        subscriptionId: fakeSubscriptionId(userId),
        userId,
        interval,
        periodEnd: addInterval(now(), interval).toISOString(),
      };
      await send(subscription(ref, "active", false));
      await send(payment(userId, interval));
    },
    async simulate(ref, change) {
      if (change === "renew") {
        const periodEnd = addInterval(new Date(ref.periodEnd), ref.interval);
        await send(subscription(ref, "active", false, periodEnd.toISOString()));
        await send(payment(ref.userId, ref.interval));
      } else {
        await send(
          subscription(
            ref,
            change === "expire" ? "expired" : "past_due",
            false,
          ),
        );
      }
    },
  };
}
