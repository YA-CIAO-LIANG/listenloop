import { describe, expect, it } from "vitest";
import { PRICES } from "@/lib/payments/pricing";
import { revenueSummary } from "@/lib/payments/revenue";

describe("revenueSummary (D85)", () => {
  it("counts subscribers, monthly recurring revenue, and this month's net", () => {
    const summary = revenueSummary(
      [
        {
          status: "active",
          interval: "month",
          cancelAtPeriodEnd: false,
          test: true,
        },
        {
          status: "active",
          interval: "year",
          cancelAtPeriodEnd: false,
          test: true,
        },
        // Cancelling: still a subscriber, no longer recurring.
        {
          status: "past_due",
          interval: "month",
          cancelAtPeriodEnd: true,
          test: true,
        },
        {
          status: "expired",
          interval: "month",
          cancelAtPeriodEnd: false,
          test: true,
        },
      ],
      [
        {
          amount: 149,
          status: "paid",
          createdAt: "2026-11-02T00:00:00Z",
          refundedAt: null,
          test: true,
        },
        {
          amount: 1490,
          status: "refunded",
          createdAt: "2026-11-03T00:00:00Z",
          refundedAt: "2026-11-04T00:00:00Z",
          test: true,
        },
        // Last month's payment, refunded this month.
        {
          amount: 149,
          status: "refunded",
          createdAt: "2026-10-20T00:00:00Z",
          refundedAt: "2026-11-05T00:00:00Z",
          test: true,
        },
      ],
      PRICES,
      "2026-10-31T16:00:00Z",
    );
    expect(summary).toEqual({
      subscribers: 3,
      cancelling: 1,
      monthlyRecurring: 149 + Math.round(1490 / 12),
      netThisMonth: 149 + 1490 - 1490 - 149,
      refundsThisMonth: 2,
      test: true,
    });
  });

  it("is all zeros with nothing yet", () => {
    expect(revenueSummary([], [], PRICES, "2026-10-31T16:00:00Z")).toEqual({
      subscribers: 0,
      cancelling: 0,
      monthlyRecurring: 0,
      netThisMonth: 0,
      refundsThisMonth: 0,
      test: false,
    });
  });
});
