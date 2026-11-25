import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  costTableMarkdown,
  quotaTableMarkdown,
  siteLimitsMarkdown,
} from "@/lib/quota-table";

/**
 * docs/quotas.md shows the quotas and costs the code uses (D161, D210).
 * When a limit, price, or unit cost changes, this fails and prints the
 * new tables to paste into the doc.
 */
const normalize = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/\s*\|\s*/g, "|").replace(/-{3,}/g, "---"))
    .join("\n");

describe("docs/quotas.md (D161, D210)", () => {
  it("has the tables made from the settings", () => {
    const doc = normalize(readFileSync("docs/quotas.md", "utf8"));
    const table = quotaTableMarkdown();
    const site = siteLimitsMarkdown();
    const costs = costTableMarkdown();
    if (
      !doc.includes(normalize(table)) ||
      !doc.includes(normalize(site)) ||
      !doc.includes(normalize(costs))
    ) {
      console.log(
        `@@TABLE\n${table}\n@@SITE\n${site}\n@@COSTS\n${costs}\n@@END`,
      );
    }
    expect(doc).toContain(normalize(table));
    expect(doc).toContain(normalize(site));
    expect(doc).toContain(normalize(costs));
  });
});
