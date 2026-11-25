import { describe, expect, it } from "vitest";
import {
  can,
  needsCount,
  PLAN_IDS,
  PLANS,
  planFor,
  type PlanId,
  type PlanLimits,
  weekSecondsLeft,
} from "@/lib/plans";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

/** A made-up setup with every limit on, to show the checks work. */
const limited: Record<PlanId, PlanLimits> = {
  ...PLANS,
  free: {
    createPractices: true,
    sharedPractices: false,
    activePractices: 3,
    practicesTotal: null,
    practicesPerMonth: 5,
    charsPerPractice: 2000,
    customRules: false,
    maxPracticeSeconds: 30,
    youtubePractices: false,
    uploadAudio: false,
    uploadMegabytes: null,
    storageMegabytes: 0,
    revisesPerDay: 5,
    wordsPerMonth: null,
    wordsPerWeek: null,
    playbackSpeed: false,
    fullStats: false,
    priority: false,
    batchPdf: false,
    writingReviewsPerWeek: 2,
    writingWords: 400,
    chatMessagesPerWeek: 5,
    backChecksPerWeek: 7,
  },
};

describe("plans (D54, D72)", () => {
  it("only paying plans practice shared materials in full (D106)", () => {
    expect(PLANS.free.sharedPractices).toBe(false);
    expect(PLANS.paid.sharedPractices).toBe(true);
    expect(PLANS.pro.sharedPractices).toBe(true);
    expect(PLANS.admin.sharedPractices).toBe(true);
  });

  it("free accounts make 300 words (2 minutes) a week, up to 2,000 characters each (D143, D209)", () => {
    // However many they made before: the old one-practice trial is gone.
    expect(
      can("free", {
        kind: "create-practice",
        createdTotal: 5,
        secondsThisWeek: 119,
      }),
    ).toEqual({ ok: true });
    expect(
      can("free", { kind: "create-practice", secondsThisWeek: 120 }),
    ).toEqual({ ok: false, limit: "wordsPerWeek", max: 300 });
    expect(needsCount("free", "create-practice")).toBe(true);
    expect(can("free", { kind: "practice-chars", chars: 2000 })).toEqual({
      ok: true,
    });
    expect(can("free", { kind: "practice-chars", chars: 2001 })).toEqual({
      ok: false,
      limit: "charsPerPractice",
      max: 2000,
    });
  });

  it("paid (Plus all-in-one) accounts make 3,000 words (20 minutes) a month, whatever they made before (D102, D210)", () => {
    expect(
      can("paid", {
        kind: "create-practice",
        createdTotal: 100,
        createdThisMonth: 29,
        secondsThisMonth: 19 * 60,
      }),
    ).toEqual({ ok: true });
    expect(
      can("paid", { kind: "create-practice", secondsThisMonth: 20 * 60 }),
    ).toEqual({ ok: false, limit: "wordsPerMonth", max: 3000 });
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
  it("free allows 2 minutes, within what's left of the week (D143)", () => {
    // Two of a minute, or one of two.
    expect(can("free", { kind: "practice-seconds", seconds: 120 }).ok).toBe(
      true,
    );
    expect(can("free", { kind: "practice-seconds", seconds: 121 })).toEqual({
      ok: false,
      limit: "maxPracticeSeconds",
      max: 120,
    });
    expect(
      can("free", {
        kind: "practice-seconds",
        seconds: 60,
        secondsThisWeek: 60,
      }).ok,
    ).toBe(true);
    expect(
      can("free", {
        kind: "practice-seconds",
        seconds: 61,
        secondsThisWeek: 60,
      }),
    ).toEqual({ ok: false, limit: "weekWordsLeft", max: 150 });
    expect(weekSecondsLeft(PLANS.free, 150)).toBe(0);
    expect(weekSecondsLeft(PLANS.paid, 150)).toBeNull();
    // Paid plans count by the month, not the week.
    expect(
      can("paid", {
        kind: "practice-seconds",
        seconds: 300,
        secondsThisWeek: 999,
      }).ok,
    ).toBe(true);
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
