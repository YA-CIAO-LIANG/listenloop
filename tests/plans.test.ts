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

/** A made-up paid setup, to show the checks work once limits are set. */
const limited: Record<PlanId, PlanLimits> = {
  free: {
    createPractices: true,
    activePractices: 3,
    practicesPerMonth: 5,
    charsPerPractice: 2000,
  },
  admin: PLANS.admin,
};

describe("plans (roadmap f, D54)", () => {
  it("limits nothing today; only admins create", () => {
    for (const id of PLAN_IDS) {
      expect(PLANS[id].activePractices).toBeNull();
      expect(PLANS[id].practicesPerMonth).toBeNull();
      expect(PLANS[id].charsPerPractice).toBeNull();
    }
    expect(can("free", { kind: "create-practice" })).toEqual({
      ok: false,
      limit: "createPractices",
    });
    expect(can("admin", { kind: "create-practice" })).toEqual({ ok: true });
    expect(can("free", { kind: "start-practice", active: 999 })).toEqual({
      ok: true,
    });
    expect(needsCount("free", "start-practice")).toBe(false);
  });

  it("names the plan by role", () => {
    expect(planFor(null)).toBe("free");
    expect(planFor({ role: "user" })).toBe("free");
    expect(planFor({ role: "admin" })).toBe("admin");
  });

  it("checks counts once a plan has limits", () => {
    expect(needsCount("free", "create-practice", limited)).toBe(true);
    expect(
      can("free", { kind: "create-practice", createdThisMonth: 4 }, limited),
    ).toEqual({ ok: true });
    expect(
      can("free", { kind: "create-practice", createdThisMonth: 5 }, limited),
    ).toEqual({ ok: false, limit: "practicesPerMonth", max: 5 });
    expect(can("free", { kind: "start-practice", active: 3 }, limited)).toEqual(
      { ok: false, limit: "activePractices", max: 3 },
    );
    expect(
      can("free", { kind: "practice-chars", chars: 2001 }, limited),
    ).toEqual({ ok: false, limit: "charsPerPractice", max: 2000 });
  });

  it("has a message for every limit, in both languages", () => {
    for (const messages of [en, zh]) {
      for (const limit of Object.keys(PLANS.free)) {
        expect(messages.plans.limits).toHaveProperty([limit]);
      }
    }
  });
});
