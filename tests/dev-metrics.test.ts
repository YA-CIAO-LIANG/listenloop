import { describe, expect, it } from "vitest";
import { median, milestonesFrom, prNumbers } from "@/lib/dev-metrics";

describe("dev metrics (D151)", () => {
  it("reads PR numbers, single and ranges", () => {
    expect(prNumbers("#87、#88、#90～#92")).toEqual([87, 88, 90, 91, 92]);
    expect(prNumbers("#1")).toEqual([1]);
    expect(prNumbers("#3、#4、#6")).toEqual([3, 4, 6]);
  });

  it("reads the milestone table", () => {
    const log = [
      "# AI 開發紀錄",
      "",
      "## 里程碑",
      "",
      "| 里程碑 | 完成日期 | 主要 PR |",
      "| --- | --- | --- |",
      "| M0 專案地基 | 2026-10-25 | #1 |",
      "| a 小修正 | 2026-10-30 | #35～#36 |",
      "",
      "## 分工",
      "| 不是 | 這張表 | #9 |",
    ].join("\n");
    expect(milestonesFrom(log)).toEqual([
      { name: "M0 專案地基", prs: [1] },
      { name: "a 小修正", prs: [35, 36] },
    ]);
  });

  it("takes the median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});
