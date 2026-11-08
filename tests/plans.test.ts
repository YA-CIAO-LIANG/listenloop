import { describe, expect, it } from "vitest";
import {
  can,
  needsCount,
  PLAN_IDS,
  PLANS,
  planFor,
  type PlanId,
  type PlanLimits,
} from "@/lib/plans";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

/** A made-up setup with every limit on, to show the checks work. */
const limited: Record<PlanId, PlanLimits> = {
  ...PLANS,
  free: {
    createPractices: true,
    activePractices: 3,
    practicesTotal: null,
    practicesPerMonth: 5,
    charsPerPractice: 2000,
    customRules: false,
    maxPracticeSeconds: 30,
    youtubePractices: false,
    minutesPerMonth: null,
    playbackSpeed: false,
    fullStats: false,
    priority: false,
    batchPdf: false,
  },
};

describe("plans (D54, D72)", () => {
  it("free accounts try one practice of their own, up to 2,000 characters", () => {
    expect(can("free", { kind: "create-practice", createdTotal: 0 })).toEqual({
      ok: true,
    });
    expect(can("free", { kind: "create-practice", createdTotal: 1 })).toEqual({
      ok: false,
      limit: "practicesTotal",
      max: 1,
    });
    expect(can("free", { kind: "practice-chars", chars: 2000 })).toEqual({
      ok: true,
    });
    expect(can("free", { kind: "practice-chars", chars: 2001 })).toEqual({
      ok: false,
      limit: "charsPerPractice",
      max: 2000,
    });
  });

  it("paid (Plus) accounts make 40 minutes a month, whatever they made before (D102)", () => {
    expect(
      can("paid", {
        kind: "create-practice",
        createdTotal: 100,
        createdThisMonth: 29,
        secondsThisMonth: 30 * 60,
      }),
    ).toEqual({ ok: true });
    expect(
      can("paid", { kind: "create-practice", secondsThisMonth: 40 * 60 }),
    ).toEqual({ ok: false, limit: "minutesPerMonth", max: 40 });
    expect(needsCount("paid", "create-practice")).toBe(true);
    expect(PLANS.paid.charsPerPractice).toBe(2000); // a technical cap now
  });

  it("admins have no limits, and nobody is limited in practices at once", () => {
    expect(
      can("admin", {
        kind: "create-practice",
        createdTotal: 999,
        createdThisMonth: 999,
      }),
    ).toEqual({ ok: true });
    expect(can("admin", { kind: "practice-chars", chars: 9999 })).toEqual({
      ok: true,
    });
    for (const id of PLAN_IDS) {
      expect(PLANS[id].activePractices).toBeNull();
      expect(needsCount(id, "start-practice")).toBe(false);
    }
  });

  it("names the plan by role, then the account's plan", () => {
    expect(planFor(null)).toBe("free");
    expect(planFor({ role: "user" })).toBe("free");
    expect(planFor({ role: "user", plan: "paid" })).toBe("paid");
    expect(planFor({ role: "admin", plan: "free" })).toBe("admin");
  });

  it("checks counts once a plan has limits", () => {
    expect(
      can("free", { kind: "create-practice", createdThisMonth: 5 }, limited),
    ).toEqual({ ok: false, limit: "practicesPerMonth", max: 5 });
    expect(can("free", { kind: "start-practice", active: 3 }, limited)).toEqual(
      { ok: false, limit: "activePractices", max: 3 },
    );
  });

  it("has a message for every limit, in both languages", () => {
    for (const messages of [en, zh]) {
      for (const limit of Object.keys(PLANS.free)) {
        expect(messages.plans.limits).toHaveProperty([limit]);
      }
    }
  });
});

describe("practice length by plan (D94)", () => {
  it("free allows 30 seconds, paid 5 minutes, admin anything", () => {
    expect(can("free", { kind: "practice-seconds", seconds: 30 }).ok).toBe(
      true,
    );
    expect(can("free", { kind: "practice-seconds", seconds: 31 })).toEqual({
      ok: false,
      limit: "maxPracticeSeconds",
      max: 30,
    });
    expect(can("paid", { kind: "practice-seconds", seconds: 300 }).ok).toBe(
      true,
    );
    expect(can("paid", { kind: "practice-seconds", seconds: 301 }).ok).toBe(
      false,
    );
    expect(can("admin", { kind: "practice-seconds", seconds: 600 }).ok).toBe(
      true,
    );
  });
});
