import { describe, expect, it } from "vitest";
import { CLASS_TIERS } from "@/lib/classroom";
import {
  classCostRows,
  COST_CAPS,
  JOE_ESTIMATES,
  listeningCostPerMinute,
  MEASURED_LISTENING,
  personalCostRows,
  TYPICAL_USE,
  UNIT_COSTS,
} from "@/lib/payments/costs";

/** Each plan's AI and voice cost against its cap (D210, Joe's rule 1). */
describe("plan costs (D210)", () => {
  it("calibrates the unit costs from the live usage log", () => {
    // 20,540 words: about US$2.03 of AI text, 147,686 voice characters.
    expect(MEASURED_LISTENING.words).toBe(20_540);
    // A minute (150 words): AI text about NT$0.48, voice about NT$0.54.
    expect(UNIT_COSTS.listeningTextPerWord * 150).toBeCloseTo(0.483, 2);
    expect(UNIT_COSTS.listeningVoicePerWord * 150).toBeCloseTo(0.542, 2);
    // Below Joe's NT$1.86 a minute, as he expected.
    expect(listeningCostPerMinute()).toBeLessThan(
      JOE_ESTIMATES.listeningPerMinute,
    );
    expect(UNIT_COSTS.essay).toBeCloseTo(0.135, 2);
    expect(UNIT_COSTS.backCheck).toBeCloseTo(0.04, 2);
    expect(UNIT_COSTS.chatMessage).toBeCloseTo(0.025, 2);
  });

  it("keeps every personal plan within its cap at full use", () => {
    const rows = personalCostRows();
    expect(rows).toHaveLength(9);
    for (const row of rows) {
      expect(row.cap).toBe(COST_CAPS[row.tier as "student" | "plus" | "pro"]);
      expect(row.fullShare, row.id).toBeLessThanOrEqual(row.cap);
      // The cap is a share of the yearly price's month (× 10 ÷ 12).
      expect(row.base).toBeCloseTo((row.monthly * 10) / 12, 6);
    }
  });

  it("keeps every class plan within 30% at full use", () => {
    const rows = classCostRows(CLASS_TIERS);
    expect(rows).toHaveLength(9);
    for (const row of rows) {
      expect(row.cap).toBe(0.3);
      expect(row.fullShare, row.id).toBeLessThanOrEqual(0.3);
    }
  });

  it("would still fit with Joe's own (higher) estimates", () => {
    // Pro all-in-one, the dearest: 9,000 words and 19 / 56 / 360 a week.
    const weeks = 52 / 12;
    const cost =
      (9_000 / 150) * JOE_ESTIMATES.listeningPerMinute +
      weeks *
        (19 * JOE_ESTIMATES.essay +
          56 * JOE_ESTIMATES.backCheck +
          360 * JOE_ESTIMATES.chatMessage);
    expect(cost / ((499 * 10) / 12)).toBeLessThanOrEqual(COST_CAPS.pro);
  });

  it("shows typical use at 30% and 50%", () => {
    expect(TYPICAL_USE).toEqual([0.3, 0.5]);
    const [row] = personalCostRows();
    expect(row.typical.map((t) => t.cost)).toEqual([
      row.fullCost * 0.3,
      row.fullCost * 0.5,
    ]);
  });
});
