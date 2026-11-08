import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIGNATURE_HEADER, signPayload } from "@/lib/payments/signature";

/** Rows written through the (stand-in) secret-key client. */
const state = vi.hoisted(() => ({
  events: new Set<string>(),
  writes: [] as { table: string; row: unknown }[],
}));

vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    from: (table: string) => {
      const chain = {
        upsert: (row: { event_id?: string }) => {
          state.writes.push({ table, row });
          const fresh =
            table !== "payment_events" || !state.events.has(row.event_id!);
          if (table === "payment_events") state.events.add(row.event_id!);
          const result = {
            data: fresh ? [{ event_id: row.event_id }] : [],
            error: null,
          };
          return Object.assign(Promise.resolve(result), {
            select: async () => result,
          });
        },
        update: (row: unknown) => {
          state.writes.push({ table, row });
          return { eq: async () => ({ error: null }) };
        },
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
        delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      };
      return chain;
    },
  }),
}));

const { handlePaymentWebhook } = await import("@/auth/payments");

const env = { PAYMENTS_PROVIDER: "fake", PAYMENTS_WEBHOOK_SECRET: "secret" };
const body = JSON.stringify({
  id: "evt_1",
  occurredAt: new Date().toISOString(),
  test: true,
  type: "subscription.updated",
  userId: "user-1",
  subscriptionId: "sub_1",
  status: "active",
  interval: "month",
  periodEnd: "2026-12-09T00:00:00.000Z",
  cancelAtPeriodEnd: false,
});
const signed = (secret: string, at = new Date()) =>
  new Headers({ [SIGNATURE_HEADER]: signPayload(secret, body, at) });

beforeEach(() => {
  state.events.clear();
  state.writes = [];
});

describe("the payment webhook", () => {
  it("is off (404) when payments aren't configured", async () => {
    expect(
      (await handlePaymentWebhook(body, signed("secret"), {})).status,
    ).toBe(404);
  });

  it("refuses an unsigned, forged, or replayed request, changing nothing", async () => {
    for (const headers of [
      new Headers(),
      signed("attacker"),
      signed("secret", new Date(Date.now() - 10 * 60_000)),
    ]) {
      expect((await handlePaymentWebhook(body, headers, env)).status).toBe(400);
    }
    expect(state.writes).toEqual([]);
  });

  it("applies a signed event once; the same event again is acknowledged", async () => {
    expect(await handlePaymentWebhook(body, signed("secret"), env)).toEqual({
      status: 200,
      body: "applied",
    });
    expect(state.writes.map((w) => w.table)).toEqual([
      "payment_events",
      "subscriptions",
      "profiles",
    ]);
    expect(state.writes[2].row).toEqual({ plan: "paid" });
    expect(await handlePaymentWebhook(body, signed("secret"), env)).toEqual({
      status: 200,
      body: "duplicate",
    });
    expect(state.writes).toHaveLength(4);
  });
});
