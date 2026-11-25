import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  expect,
  signInAsAdmin,
  signInAsAuthor,
  signInAsLearner,
  test,
} from "./fixtures";

/**
 * What a screen reader and a keyboard need (D171), on the pages added
 * since the first accessibility checks (D61): axe's WCAG 2.1 AA rules,
 * one main landmark, exactly one h1, no skipped heading levels, and the
 * skip link as the first stop of the Tab key.
 */
async function structure(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const style = getComputedStyle(el as HTMLElement);
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        (r.width > 0 || r.height > 0 || el.closest(".sr-only") !== null)
      );
    };
    const mains = document.querySelectorAll("main, [role=main]");
    if (mains.length !== 1) problems.push(`main landmarks: ${mains.length}`);
    const h1s = [...document.querySelectorAll("h1")].filter(visible);
    if (h1s.length !== 1) problems.push(`h1: ${h1s.length}`);
    let last = 0;
    for (const h of document.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
      if (!visible(h) || h.closest("[aria-hidden=true], dialog:not([open])"))
        continue;
      const level = Number(h.tagName[1]);
      if (last && level > last + 1)
        problems.push(
          `heading skips h${last} → h${level}: "${h.textContent?.trim().slice(0, 40)}"`,
        );
      last = level;
    }
    if (!document.documentElement.lang) problems.push("no <html lang>");
    return problems;
  });
}

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("iframe")
    .analyze();
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}

async function check(page: Page, paths: string[]) {
  const found: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const p of [...(await structure(page)), ...(await axe(page))])
      found.push(`${path} ${p}`);
  }
  expect(found).toEqual([]);
}

test("public pages: landmarks, headings, axe", async ({ page }) => {
  // Many pages in one test; slower than 30 s under a full parallel run.
  test.setTimeout(60_000);
  await check(page, [
    "/",
    "/level-test",
    "/learn",
    "/blog",
    "/status",
    "/explore",
    "/pricing",
    "/videos/sintel",
    "/videos/sintel/day/1",
    "/videos/sintel/day/2",
    "/login",
    "/beta",
  ]);
});

test("a learner's pages: landmarks, headings, axe", async ({ page }) => {
  await signInAsLearner(page);
  await check(page, [
    "/",
    "/practices",
    "/account",
    "/account/usage",
    "/review",
    "/stats",
    "/materials",
    "/materials/new",
  ]);
});

test("the author's and admin's pages: landmarks, headings, axe", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await check(page, ["/materials"]);
  await signInAsAdmin(page);
  await check(page, [
    "/admin",
    "/admin/ops",
    "/admin/beta-test",
    "/admin/feedback",
    "/admin/abuse",
    "/admin/usage",
  ]);
});

test("the keyboard starts at the skip link, which moves to the content", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "跳到主要內容" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("Day 1 dictation works with the keyboard alone", async ({ page }) => {
  await page.goto("/videos/sintel/day/1");
  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  // Tab until the answer box has focus: every stop on the way is named.
  for (let i = 0; i < 40; i++) {
    if (await input.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return (
        el?.getAttribute("aria-label") ??
        el?.innerText?.trim() ??
        el?.getAttribute("title") ??
        ""
      );
    });
    expect(name, "every focus stop has a name").not.toBe("");
  }
  await expect(input).toBeFocused();
  await page.keyboard.type("hello there");
  await page.keyboard.press("Enter");
  // The result is announced (a live region) and the next step is reachable.
  await expect(page.getByRole("button", { name: "下一句" })).toBeVisible();
});
