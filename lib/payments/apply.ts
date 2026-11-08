import type { AccountPlan } from "../plans";
import type { PaymentEvent, SubscriptionStatus } from "./types";

/**
 * Applying a verified webhook event (D85). The store is the database in
 * the app (auth/payments.ts) and a map in tests.
 *
 * - Idempotent: an event id already claimed is skipped, so a provider's
 *   retry never pays, refunds, or changes a plan twice. An event whose
 *   changes fail is released, so the provider's retry can apply it.
 * - Ordered: a subscription update older than the one stored is skipped
 *   (webhooks can arrive out of order).
 * - profiles.plan follows the subscription: paid while it's active or
 *   past due (the provider is still retrying the card), free once it has
 *   expired. Materials are never deleted; a free account just can't add
 *   more (PLANS.free, D72).
 */
export type StoredSubscription = {
  status: SubscriptionStatus;
  updatedAt: string;
};

export interface PaymentStore {
  /** False when this event was claimed before. */
  claimEvent(provider: string, id: string, type: string): Promise<boolean>;
  releaseEvent(provider: string, id: string): Promise<void>;
  getSubscription(userId: string): Promise<StoredSubscription | null>;
  saveSubscription(row: {
    userId: string;
    provider: string;
    subscriptionId: string;
    status: SubscriptionStatus;
    interval: "month" | "year";
    periodEnd: string;
    cancelAtPeriodEnd: boolean;
    test: boolean;
    updatedAt: string;
  }): Promise<void>;
  setPlan(userId: string, plan: AccountPlan): Promise<void>;
  savePayment(row: {
    userId: string;
    provider: string;
    paymentId: string;
    amount: number;
    currency: string;
    interval: "month" | "year" | null;
    test: boolean;
    createdAt: string;
  }): Promise<void>;
  markRefunded(
    provider: string,
    paymentId: string,
    at: string,
  ): Promise<boolean>;
}

export type ApplyResult =
  | { ok: true; outcome: "applied" | "duplicate" | "stale" }
  | { ok: false; reason: "failed" | "unknown-payment" };

export const planForStatus = (status: SubscriptionStatus): AccountPlan =>
  status === "expired" ? "free" : "paid";

export async function applyPaymentEvent(
  store: PaymentStore,
  provider: string,
  event: PaymentEvent,
): Promise<ApplyResult> {
  if (!(await store.claimEvent(provider, event.id, event.type))) {
    return { ok: true, outcome: "duplicate" };
  }
  try {
    const outcome = await applyClaimed(store, provider, event);
    if (!outcome.ok) await store.releaseEvent(provider, event.id);
    return outcome;
  } catch {
    await store.releaseEvent(provider, event.id);
    return { ok: false, reason: "failed" };
  }
}

async function applyClaimed(
  store: PaymentStore,
  provider: string,
  event: PaymentEvent,
): Promise<ApplyResult> {
  switch (event.type) {
    case "subscription.updated": {
      const stored = await store.getSubscription(event.userId);
      if (
        stored &&
        Date.parse(stored.updatedAt) > Date.parse(event.occurredAt)
      ) {
        return { ok: true, outcome: "stale" };
      }
      await store.saveSubscription({
        userId: event.userId,
        provider,
        subscriptionId: event.subscriptionId,
        status: event.status,
        interval: event.interval,
        periodEnd: event.periodEnd,
        cancelAtPeriodEnd: event.cancelAtPeriodEnd,
        test: event.test,
        updatedAt: event.occurredAt,
      });
      await store.setPlan(event.userId, planForStatus(event.status));
      return { ok: true, outcome: "applied" };
    }
    case "payment.succeeded":
      await store.savePayment({
        userId: event.userId,
        provider,
        paymentId: event.paymentId,
        amount: event.amount,
        currency: event.currency,
        interval: event.interval,
        test: event.test,
        createdAt: event.occurredAt,
      });
      return { ok: true, outcome: "applied" };
    case "payment.refunded":
      return (await store.markRefunded(
        provider,
        event.paymentId,
        event.occurredAt,
      ))
        ? { ok: true, outcome: "applied" }
        : { ok: false, reason: "unknown-payment" };
  }
}
