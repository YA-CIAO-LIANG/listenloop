import AxeBuilder from "@axe-core/playwright";
import { expect, signInAsAuthor, test } from "./fixtures";

/**
 * The library (D70): videos and official audio practices together, with
 * filters kept in the URL, a phone drawer, and the home page's order.
 */
const cards = (page: import("@playwright/test").Page) =>
  page.locator("#library").getByRole("listitem").getByRole("link");

test("the library lists videos and official practices, filtered by the URL", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(cards(page)).toHaveCount(2);
  const official = cards(page).filter({ hasText: "E2E official practice" });
  await expect(official).toContainText("音檔");
  await expect(official).toContainText("旅遊");
  await expect(official).toContainText("初級");
  await expect(official).toContainText("在機場報到的簡短對話。");
  await expect(official).toContainText("英式英語");

  const sidebar = page.getByRole("complementary", { name: "篩選" });
  await sidebar
    .getByRole("group", { name: "類型" })
    .getByRole("button", { name: /影片/ })
    .click();
  await expect(page).toHaveURL(/\?type=video$/);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Sintel");

  // A reload, or a shared link, keeps the filter.
  await page.reload();
  await expect(cards(page)).toHaveCount(1);
  await expect(
    sidebar
      .getByRole("group", { name: "類型" })
      .getByRole("button", { name: /影片/ }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "清除篩選" }).click();
  await expect(page).toHaveURL("/");
  await page.getByLabel("搜尋").fill("airport");
  await expect(cards(page)).toHaveCount(0);
  await page.getByLabel("搜尋").fill("機場");
  await expect(cards(page)).toHaveCount(1);
  await expect(page).toHaveURL(/q=/);
});

test("on a phone, the filters open in a drawer that works by keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto("/?level=beginner");
  await expect(cards(page)).toHaveCount(1);
  await expect(page.getByRole("complementary", { name: "篩選" })).toBeHidden();

  const open = page.getByRole("button", { name: "篩選（1）" });
  await open.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "篩選" });
  await expect(drawer).toBeVisible();
  await drawer
    .getByRole("group", { name: "程度" })
    .getByRole("button", { name: /初級/ })
    .press("Enter");
  await expect(
    drawer.getByRole("button", { name: "顯示 2 份教材" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(cards(page)).toHaveCount(2);

  // No sideways scrolling at phone width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("signed in, the home page goes today's tasks, minutes, then library", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await page.goto("/");
  const headings = await page
    .getByRole("heading", { level: 2 })
    .allTextContents();
  expect(headings.indexOf("今日任務")).toBeLessThan(
    headings.indexOf("我今天有幾分鐘？"),
  );
  expect(headings.indexOf("我今天有幾分鐘？")).toBeLessThan(
    headings.indexOf("教材庫"),
  );
  await page
    .getByRole("group", { name: "我今天有幾分鐘？" })
    .getByRole("button", { name: "10 分鐘" })
    .click();
  await expect(page).toHaveURL(/min=10/);
  // Sintel takes about 9 minutes a day; the practice's estimate is 1.
  await expect(cards(page)).toHaveCount(2);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the filtered library and its drawer pass axe (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto("/?type=audio");
    await page.getByRole("button", { name: /^篩選/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("iframe")
      .analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      ),
    ).toEqual([]);
  });
}
