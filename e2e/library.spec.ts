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
  // English title first, the Chinese one under it (D83).
  await expect(official).toContainText("E2E official practice官方測試練習");
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
  // The Chinese title is searched too (D83).
  await page.getByLabel("搜尋").fill("辛特爾");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Sintel");
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

test("signed in, the home page goes calendar, today's tasks, then library (D79)", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await page.goto("/");
  const headings = await page
    .getByRole("heading", { level: 2 })
    .allTextContents();
  const at = (name: string) => headings.findIndex((h) => h.startsWith(name));
  expect(at("練習日曆")).toBeGreaterThanOrEqual(0);
  expect(at("練習日曆")).toBeLessThan(at("今日任務"));
  expect(at("今日任務")).toBeLessThan(at("官方教材庫"));
  // No time-a-day choice any more (D104).
  await expect(page.getByText("我今天有幾分鐘？")).toHaveCount(0);
  await expect(cards(page)).toHaveCount(2);
});

test("signed out, the library and its filters are open to everyone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "官方教材庫" })).toBeVisible();
  const sidebar = page.getByRole("complementary", { name: "篩選" });
  // A click before the library hydrates does nothing (slow CI machines):
  // click again until the filter is in the address.
  const travel = sidebar
    .getByRole("group", { name: "分類" })
    .getByRole("button", { name: /旅遊/ });
  await expect(async () => {
    // Never a second click once it's on (that would turn it off).
    if ((await travel.getAttribute("aria-pressed")) !== "true") {
      await travel.click();
    }
    await expect(page).toHaveURL(/cat=travel/, { timeout: 2_000 });
  }).toPass();
  await sidebar
    .getByRole("group", { name: "情境" })
    .getByRole("button", { name: /機場報到與登機/ })
    .click();
  await expect(page).toHaveURL(/sc=airport-check-in/);
  await expect(cards(page)).toHaveCount(1);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the filtered library and its drawer pass axe (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto("/?type=audio");
    // As above: retry the drawer's button until the page has hydrated.
    await expect(async () => {
      if (!(await page.getByRole("dialog").isVisible())) {
        await page.getByRole("button", { name: /^篩選/ }).click();
      }
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
    }).toPass();
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

test("signed out, a saved default filter opens the library with it next time (D98)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "篩選" });
  await sidebar
    .getByRole("group", { name: "程度" })
    .getByRole("button", { name: /初級/ })
    .click();
  await expect(page).toHaveURL(/level=beginner/);
  await sidebar.getByRole("button", { name: "存為我的預設篩選" }).click();
  await expect(sidebar.getByText(/已存在這個瀏覽器/)).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/level=beginner/);
  await expect(
    sidebar.getByRole("button", { name: "✓ 這是我的預設篩選" }),
  ).toBeDisabled();
  // A link with its own filter keeps it.
  await page.goto("/?level=intermediate");
  await expect(page).toHaveURL(/level=intermediate/);
  await expect(page).not.toHaveURL(/beginner/);
});

test("categories and audio length search the library as they change (D104)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "篩選" });
  const categories = sidebar.getByRole("group", { name: "分類" });
  const all = categories.getByRole("button", { name: "全部" });
  await expect(all).toHaveAttribute("aria-pressed", "true");

  // A tap searches by itself, no button: the travel practice (4 minutes).
  const travel = categories.getByRole("button", { name: /旅遊/ });
  await travel.click();
  await expect(travel).toHaveAttribute("aria-pressed", "true");
  await expect(travel).toContainText("✓");
  await expect(categories).toContainText("已選 1 / 5");
  await expect(page).toHaveURL(/cat=travel/);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("E2E official practice");

  const lengths = sidebar.getByRole("group", { name: "長度" });
  await expect(lengths.getByLabel("全部長度")).toBeChecked();
  await lengths.getByText("3 分鐘以下").click();
  await expect(page).toHaveURL(/len=under-3/);
  await expect(cards(page)).toHaveCount(0);
  await lengths.getByText("3–5 分鐘").click();
  await expect(page).toHaveURL(/len=3-5/);
  await expect(cards(page)).toHaveCount(1);

  // 全部 clears every category; Sintel (49 s) is under 3 minutes.
  await all.click();
  await expect(page).not.toHaveURL(/cat=/);
  await lengths.getByText("3 分鐘以下").click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Sintel");
  await expect(page.getByText("搜尋中…")).toHaveCount(0);
});
