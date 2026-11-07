import AxeBuilder from "@axe-core/playwright";
import { expect, signInAsAuthor, test } from "./fixtures";

/**
 * Automated accessibility checks (D61): axe's WCAG 2.1 A and AA rules on
 * the main pages, signed out and signed in, light and dark. A violation
 * fails the test with its rule and elements, so it's fixed, not ignored.
 */
const PAGES = [
  "/",
  "/explore",
  "/videos/sintel",
  "/videos/sintel/day/1",
  "/terms",
  "/privacy",
  "/feedback",
  "/credits",
  "/practices",
  "/no-such-page",
];

async function scan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The YouTube player is a third-party frame (blocked in E2E).
    .exclude("iframe")
    .analyze();
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}

for (const scheme of ["light", "dark"] as const) {
  test(`main pages have no axe violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const found: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      for (const violation of await scan(page))
        found.push(`${path} ${violation}`);
    }
    expect(found).toEqual([]);
  });
}

test("signed-in pages have no axe violations", async ({ page }) => {
  await signInAsAuthor(page);
  const found: string[] = [];
  for (const path of ["/", "/practices", "/account", "/materials"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const violation of await scan(page))
      found.push(`${path} ${violation}`);
  }
  expect(found).toEqual([]);
});
