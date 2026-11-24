import { describe, expect, it } from "vitest";
import { can, PLANS } from "@/lib/plans";
import {
  applyChecks,
  checkBack,
  exactBack,
  newRun,
  answerRun,
  pendingChecks,
  type BackItem,
} from "@/lib/writing/back-translation";
import { cleanBackCheck } from "@/lib/writing/back-check/clean";
import { fakeBackCheck } from "@/lib/writing/back-check/fake";
import { BACK_GOLDEN } from "@/lib/writing/back-check/golden";
import { judgedRight } from "@/lib/writing/back-check/types";
import { parseWritingSettings } from "@/lib/writing/settings";

/** Extra practice's AI check (D200). */
const ITEM: BackItem = {
  en: "She doesn't like spicy food.",
  zh: "她不喜歡辣的食物。",
  source: "model",
};

describe("rules first", () => {
  it("exactly right never goes to the AI", () => {
    const right = checkBack(ITEM, "read-zh", "she does not like spicy food");
    expect(exactBack(ITEM, right, "she does not like spicy food")).toBe(true);
    const other = checkBack(ITEM, "read-zh", "She dislikes spicy food.");
    expect(exactBack(ITEM, other, "She dislikes spicy food.")).toBe(false);
  });

  it("Chinese: only the reference meaning itself is exact", () => {
    const zh = checkBack(ITEM, "listen-zh", "她不喜歡辣的食物");
    expect(exactBack(ITEM, zh, "她不喜歡辣的食物")).toBe(true);
    expect(exactBack(ITEM, zh, "她不愛吃辣")).toBe(false);
  });
});

describe("one check for the set", () => {
  const items = [ITEM, { ...ITEM, en: "I go to school by bus." }];
  let run = newRun(items);
  run = answerRun(run, 0, {
    ...checkBack(items[0], "read-zh", "She dislikes spicy food."),
    answer: "She dislikes spicy food.",
    pending: true,
  });
  run = answerRun(run, 1, {
    ...checkBack(items[1], "read-zh", "I go to school by bus."),
    answer: "I go to school by bus.",
  });

  it("only pending answers are sent, with their place", () => {
    expect(pendingChecks(run)).toEqual([
      {
        i: 0,
        mode: "read-zh",
        reference: ITEM.en,
        meaning: ITEM.zh,
        answer: "She dislikes spicy food.",
      },
    ]);
  });

  it("the AI's judgement decides; no judgement keeps the rules' result", () => {
    const judged = applyChecks(run, [
      {
        i: 0,
        judgement: { meaning: true, grammar: true, better: "", why: "同義。" },
      },
    ]);
    expect(judged.answers[0]).toMatchObject({ right: true });
    expect(judged.answers[0]?.pending).toBeUndefined();
    expect(judged.answers[0]?.ai?.why).toBe("同義。");
    const none = applyChecks(run, []);
    expect(none.answers[0]?.pending).toBeUndefined();
    expect(none.answers[0]?.right).toBe(run.answers[0]?.right);
    expect(none.answers[0]?.ai).toBeUndefined();
  });
});

describe("cleaning the AI's answer", () => {
  const input = {
    items: [
      {
        i: 2,
        mode: "read-zh" as const,
        reference: "A b c.",
        meaning: "",
        answer: "A b d.",
      },
      {
        i: 5,
        mode: "listen-zh" as const,
        reference: "A b c.",
        meaning: "甲乙",
        answer: "甲丙",
      },
    ],
  };

  it("keeps one judgement per asked item, reason in Chinese", () => {
    const out = cleanBackCheck(
      {
        items: [
          {
            i: 2,
            meaning: true,
            grammar: false,
            better: "A b c.",
            why: "動詞錯了。",
          },
          { i: 2, meaning: false, grammar: false, better: "", why: "重複。" },
          { i: 9, meaning: true, grammar: true, better: "", why: "沒問的。" },
          {
            i: 5,
            meaning: false,
            grammar: false,
            better: "x y",
            why: "意思不同。",
          },
        ],
      },
      input,
    );
    expect([...out.keys()]).toEqual([2, 5]);
    expect(out.get(2)).toEqual({
      meaning: true,
      grammar: false,
      better: "A b c.",
      why: "動詞錯了。",
    });
    // A Chinese answer: grammar doesn't apply, no English better way.
    expect(out.get(5)).toMatchObject({ grammar: true, better: "" });
  });

  it("drops a reason not in Chinese, and nonsense", () => {
    expect(
      cleanBackCheck(
        {
          items: [
            { i: 2, meaning: true, grammar: true, better: "", why: "fine" },
          ],
        },
        input,
      ).size,
    ).toBe(0);
    expect(cleanBackCheck(null, input).size).toBe(0);
    expect(cleanBackCheck({ items: "x" }, input).size).toBe(0);
  });

  it("right needs the meaning and the grammar", () => {
    expect(
      judgedRight({ meaning: true, grammar: true, better: "", why: "" }),
    ).toBe(true);
    expect(
      judgedRight({ meaning: true, grammar: false, better: "", why: "" }),
    ).toBe(false);
  });

  it("the fake checker gives every case a usable answer", () => {
    for (const c of BACK_GOLDEN) {
      const input = { items: c.items };
      expect(cleanBackCheck(fakeBackCheck(input), input).size, c.id).toBe(
        c.items.length,
      );
    }
  });
});

describe("the golden set (D200)", () => {
  it("has at least 20 cases of every kind asked for", () => {
    expect(BACK_GOLDEN.length).toBeGreaterThanOrEqual(20);
    for (const kind of ["synonym", "grammar", "meaning", "picky"] as const) {
      expect(
        BACK_GOLDEN.filter((c) => c.category === kind).length,
        kind,
      ).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(BACK_GOLDEN.map((c) => c.id)).size).toBe(BACK_GOLDEN.length);
  });
});

describe("weekly checks and cost (D200)", () => {
  it("each plan has its checks; admins have no limit", () => {
    expect(can("free", { kind: "back-check", thisWeek: 6 }).ok).toBe(true);
    expect(
      can("free", {
        kind: "back-check",
        thisWeek: PLANS.free.backChecksPerWeek!,
      }),
    ).toMatchObject({ ok: false, limit: "backChecksPerWeek" });
    expect(PLANS.pro.backChecksPerWeek!).toBeGreaterThan(
      PLANS.paid.backChecksPerWeek!,
    );
    expect(can("admin", { kind: "back-check", thisWeek: 1_000 }).ok).toBe(true);
  });

  it("every paid plan keeps the price floor with its checks", async () => {
    const { worstCaseTable, PRICE_FLOOR, PLAN_BACK_CHECK_EXTRA } =
      await import("@/lib/payments/price-floor");
    for (const row of worstCaseTable()) {
      expect(row.margin, `${row.plan} ${row.period}`).toBeGreaterThanOrEqual(
        PRICE_FLOOR.minMarginPerMonth,
      );
    }
    expect(PLAN_BACK_CHECK_EXTRA.pro).toBeGreaterThan(0);
  });

  it("a plan's AI writing costs (reviews, chat, checks) stay within a quarter of its monthly price", async () => {
    const { backCheckMonthCost, chatMonthCost, writingMonthCost } =
      await import("@/lib/payments/price-floor");
    const { PLAN_PRICES, PERIOD_MONTHS } =
      await import("@/lib/payments/pricing");
    const limits = { plus: PLANS.paid, student: PLANS.paid, pro: PLANS.pro };
    for (const plan of ["plus", "student", "pro"] as const) {
      const l = limits[plan];
      const cost =
        writingMonthCost(l.writingReviewsPerWeek!) +
        chatMonthCost(l.chatMinutesPerWeek!) +
        backCheckMonthCost(l.backChecksPerWeek!);
      for (const period of ["month", "year"] as const) {
        const monthly =
          PLAN_PRICES[plan][period].amount / PERIOD_MONTHS[period];
        expect(cost, `${plan} ${period}`).toBeLessThanOrEqual(monthly * 0.25);
      }
    }
  });
});

describe("the setting (D200)", () => {
  it("on unless turned off", () => {
    expect(parseWritingSettings({}).extraAi).toBe(true);
    expect(parseWritingSettings({ extraAi: false }).extraAi).toBe(false);
  });
});
