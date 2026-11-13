import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quotaTableMarkdown, siteLimitsMarkdown } from "@/lib/quota-table";

/**
 * docs/quotas.md shows the quotas the code uses (D161). When a limit
 * changes, this fails and prints the new table to paste into the doc.
 */
const normalize = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/\s*\|\s*/g, "|").replace(/-{3,}/g, "---"))
    .join("\n");

describe("docs/quotas.md (D161)", () => {
  it("has the table made from the settings", () => {
    const doc = normalize(readFileSync("docs/quotas.md", "utf8"));
    const table = quotaTableMarkdown();
    const site = siteLimitsMarkdown();
    if (!doc.includes(normalize(table)) || !doc.includes(normalize(site))) {
      console.log(`@@TABLE\n${table}\n@@SITE\n${site}\n@@END`);
    }
    expect(doc).toContain(normalize(table));
    expect(doc).toContain(normalize(site));
  });
});
