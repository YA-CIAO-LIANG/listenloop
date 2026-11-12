import { describe, expect, it } from "vitest";
import {
  applyPaymentEvent,
  planForStatus,
  type PaymentStore,
} from "@/lib/payments/apply";
import { parsePaymentEvent } from "@/lib/payments/events";
import { fakePaymentProvider, fakeSubscriptionId } from "@/lib/payments/fake";
import { formatPrice, averagePerMonth, PRICES } from "@/lib/payments/pricing";
import {
  SIGNATURE_HEADER,
  signPayload,
  verifySignature,
} from "@/lib/payments/signature";
import type { PaymentEvent } from "@/lib/payments/types";
import { getPaymentProvider } from "@/auth/payments";
import { can } from "@/lib/plans";

const SECRET = "test-secret";
const NOW = new Date("2026-11-09T00:00:00Z");

/** A PaymentStore in memory, recording what was written. */
function memoryStore() {
  const events = new Set<string>();
  const subscriptions = new Map<
    string,
    Parameters<PaymentStore["saveSubscription"]>[0]
  >();
  const plans = new Map<string, string>();
  const payments = new Map<
    string,
    Parameters<PaymentStore["savePayment"]>[0] & { status: string }
  >();
  let failNext = false;
  const store: PaymentStore = {
    async claimEvent(provider, id) {
      const key = `${provider}:${id}`;
      if (events.has(key)) return false;
      events.add(key);
      return true;
    },
    async releaseEvent(provider, id) {
      events.delete(`${provider}:${id}`);
    },
    async getSubscription(userId) {
      const row = subscriptions.get(userId);
      return row ? { status: row.status, updatedAt: row.updatedAt } : null;
    },
    async saveSubscription(row) {
      if (failNext) {
        failNext = false;
        throw new Error("database down");
      }
      subscriptions.set(row.userId, row);
    },
    async setPlan(userId, plan) {
      plans.set(userId, plan);
    },
    async savePayment(row) {
      if (!payments.has(row.paymentId)) {
        payments.set(row.paymentId, { ...row, status: "paid" });
      }
    },
    async markRefunded(_provider, paymentId) {
      const row = payments.get(paymentId);
      if (!row) return false;
      row.status = "refunded";
      return true;
    },
  };
  return {
    store,
    subscriptions,
    plans,
    payments,
    failOnce: () => (failNext = true),
  };
}

const subscriptionEvent = (extra: Partial<PaymentEvent> = {}): PaymentEvent =>
  ({
    id: "evt_1",
    occurredAt: "2026-11-09T00:00:00.000Z",
    test: true,
    type: "subscription.updated",
    userId: "user-1",
    subscriptionId: "sub_1",
    status: "active",
    interval: "month",
    periodEnd: "2026-12-09T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    ...extra,
  }) as PaymentEvent;

describe("prices (one place)", () => {
  it("bills a year as ten months", () => {
    expect(PRICES.year.amount).toBe(PRICES.month.amount * 10);
    expect(averagePerMonth(PRICES.year.amount)).toBe(124);
  });
});

describe("webhook signatures", () => {
  const body = JSON.stringify({ hello: "world" });
  const header = signPayload(SECRET, body, NOW);

  it("accepts what was signed with the secret", () => {
    expect(verifySignature(SECRET, body, header, NOW)).toBe(true);
  });

  it("refuses a changed body, another secret, or no signature", () => {
    expect(verifySignature(SECRET, `${body} `, header, NOW)).toBe(false);
    expect(verifySignature("other", body, header, NOW)).toBe(false);
    expect(verifySignature(SECRET, body, null, NOW)).toBe(false);
    expect(verifySignature("", body, header, NOW)).toBe(false);
  });

  it("refuses an old request sent again (a replay) and malformed ones", () => {
    const later = new Date(NOW.getTime() + 301_000);
    expect(verifySignature(SECRET, body, header, later)).toBe(false);
    const earlier = new Date(NOW.getTime() - 301_000);
    expect(verifySignature(SECRET, body, header, earlier)).toBe(false);
    expect(verifySignature(SECRET, body, "t=abc,v1=00", NOW)).toBe(false);
    expect(verifySignature(SECRET, body, "garbage", NOW)).toBe(false);
    // A forged timestamp with the old signature fails too.
    const forged = header.replace(
      /t=\d+/,
      `t=${Math.floor(Date.now() / 1000)}`,
    );
    expect(verifySignature(SECRET, body, forged, new Date())).toBe(false);
  });
});

describe("parsePaymentEvent", () => {
  it("keeps a well-formed event and refuses anything else", () => {
    expect(parsePaymentEvent(subscriptionEvent())).toEqual(subscriptionEvent());
    expect(
      parsePaymentEvent({ ...subscriptionEvent(), status: "gift" }),
    ).toBeNull();
    expect(
      parsePaymentEvent({ ...subscriptionEvent(), type: "plan.free" }),
    ).toBeNull();
    expect(
      parsePaymentEvent({
        id: "e",
        occurredAt: NOW.toISOString(),
        test: true,
        type: "payment.succeeded",
        userId: "u",
        paymentId: "p",
        amount: -1,
        currency: "TWD",
        interval: "month",
      }),
    ).toBeNull();
    expect(parsePaymentEvent(null)).toBeNull();
  });
});

describe("applyPaymentEvent", () => {
  it("makes the account paid, and applies the same event only once", async () => {
    const m = memoryStore();
    expect(
      await applyPaymentEvent(m.store, "fake", subscriptionEvent()),
    ).toEqual({ ok: true, outcome: "applied" });
    expect(m.plans.get("user-1")).toBe("paid");
    m.plans.set("user-1", "free");
    expect(
      await applyPaymentEvent(m.store, "fake", subscriptionEvent()),
    ).toEqual({ ok: true, outcome: "duplicate" });
    expect(m.plans.get("user-1")).toBe("free");
  });

  it("skips an update older than the stored one (out of order)", async () => {
    const m = memoryStore();
    await applyPaymentEvent(
      m.store,
      "fake",
      subscriptionEvent({ id: "new", status: "expired" }),
    );
    const old = subscriptionEvent({
      id: "old",
      occurredAt: "2026-11-08T00:00:00.000Z",
    });
    expect(await applyPaymentEvent(m.store, "fake", old)).toEqual({
      ok: true,
      outcome: "stale",
    });
    expect(m.plans.get("user-1")).toBe("free");
  });

  it("releases an event that failed, so the retry applies it", async () => {
    const m = memoryStore();
    m.failOnce();
    expect(
      await applyPaymentEvent(m.store, "fake", subscriptionEvent()),
    ).toEqual({ ok: false, reason: "failed" });
    expect(
      await applyPaymentEvent(m.store, "fake", subscriptionEvent()),
    ).toEqual({ ok: true, outcome: "applied" });
  });

  it("follows the subscription: paid while active or past due, free once expired", () => {
    expect(planForStatus("active")).toBe("paid");
    expect(planForStatus("past_due")).toBe("paid");
    expect(planForStatus("expired")).toBe("free");
  });

  it("refuses a refund of a payment it never saw", async () => {
    const m = memoryStore();
    expect(
      await applyPaymentEvent(m.store, "fake", {
        id: "r",
        occurredAt: NOW.toISOString(),
        test: true,
        type: "payment.refunded",
        paymentId: "nope",
      }),
    ).toEqual({ ok: false, reason: "unknown-payment" });
  });
});

describe("the fake provider, end to end", () => {
  function setup() {
    const m = memoryStore();
    const delivered: string[] = [];
    const provider = fakePaymentProvider({
      secret: SECRET,
      now: () => NOW,
      deliver: async (body, headers) => {
        delivered.push(body);
        const event = await provider.parseWebhook(body, headers, NOW);
        if (!event) throw new Error("not verified");
        const result = await applyPaymentEvent(m.store, provider.id, event);
        if (!result.ok) throw new Error(result.reason);
      },
    });
    return { m, provider, delivered };
  }

  it("checks out, renews, cancels at period end, refunds, and expires", async () => {
    const { m, provider } = setup();
    expect(
      (
        await provider.createCheckout({
          userId: "user-1",
          email: null,
          interval: "year",
          successUrl: "https://example.com/checkout/success",
          cancelUrl: "https://example.com/pricing",
        })
      ).url,
    ).toBe("https://example.com/checkout/fake?interval=year");

    await provider.completeCheckout("user-1", "year");
    expect(m.plans.get("user-1")).toBe("paid");
    const sub = m.subscriptions.get("user-1")!;
    expect(sub).toMatchObject({
      subscriptionId: fakeSubscriptionId("user-1"),
      interval: "year",
      periodEnd: "2027-11-09T00:00:00.000Z",
      test: true,
    });
    const [payment] = [...m.payments.values()];
    expect(payment).toMatchObject({ amount: 1490, currency: "TWD" });

    const ref = {
      subscriptionId: sub.subscriptionId,
      userId: "user-1",
      interval: sub.interval,
      periodEnd: sub.periodEnd,
    };
    await provider.setCancelAtPeriodEnd(ref, true);
    // Still paid until the period ends.
    expect(m.subscriptions.get("user-1")?.cancelAtPeriodEnd).toBe(true);
    expect(m.plans.get("user-1")).toBe("paid");

    await provider.refund(payment.paymentId);
    expect(m.payments.get(payment.paymentId)?.status).toBe("refunded");

    await provider.simulate(ref, "expire");
    expect(m.plans.get("user-1")).toBe("free");
  });

  it("refuses a webhook signed with another secret", async () => {
    const { provider } = setup();
    const body = JSON.stringify(subscriptionEvent());
    const headers = new Headers({
      [SIGNATURE_HEADER]: signPayload("attacker", body, NOW),
    });
    expect(await provider.parseWebhook(body, headers, NOW)).toBeNull();
  });
});

describe("getPaymentProvider", () => {
  it("is off without a secret, and the fake one never runs in production", () => {
    expect(getPaymentProvider({ PAYMENTS_PROVIDER: "fake" })).toBeNull();
    expect(
      getPaymentProvider({
        PAYMENTS_PROVIDER: "fake",
        PAYMENTS_WEBHOOK_SECRET: "s",
        VERCEL_ENV: "production",
      }),
    ).toBeNull();
    expect(
      getPaymentProvider({
        PAYMENTS_PROVIDER: "fake",
        PAYMENTS_WEBHOOK_SECRET: "s",
      })?.id,
    ).toBe("fake");
  });
});

describe("downgrading (D72, D85)", () => {
  it("keeps what a free account made; it adds the free plan's week (D143)", () => {
    expect(
      can("free", {
        kind: "create-practice",
        createdTotal: 12,
        secondsThisWeek: 120,
      }),
    ).toMatchObject({ ok: false, limit: "minutesPerWeek" });
  });
});

describe("formatPrice", () => {
  const n = (value: number, currency?: string) =>
    new Intl.NumberFormat(
      "en",
      currency ? { style: "currency", currency } : {},
    ).format(value);
  it("shows NT$ without decimals, other currencies from cents", () => {
    expect(formatPrice(1490, "TWD", n)).toBe("NT$1,490");
    expect(formatPrice(499, "USD", n)).toBe("$4.99");
  });
});
