import AxeBuilder from "@axe-core/playwright";
import { expect, signInAsLearner, test } from "./fixtures";

/**
 * Background themes (D121) in the account settings: choose a free one
 * (kept after a reload, before the page draws), preview any one on the
 * whole page, see which ones practice score opens, and the animated ones'
 * fake door. Animated backgrounds stand still for reduced motion.
 */
test("a learner chooses, previews, and keeps a background", async ({
  page,
}) => {
  await signInAsLearner(page);
  await page.goto("/account");
  const section = page.getByRole("region", { name: "背景主題" });
  await expect(section.getByText(/目前練習分數 0/)).toBeVisible();

  // Score-opened ones are closed for a new learner.
  await expect(
    section.getByRole("radio", { name: /筆記本格線/ }),
  ).toBeDisabled();
  await section.getByRole("radio", { name: /暖灰/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-bg", "warm-gray");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-bg", "warm-gray");

  // Any background can be previewed on the whole page.
  await section
    .getByRole("button", { name: "在整個頁面預覽「太空星空」" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-bg", "stars");
  await expect(
    page.getByText("正在預覽「太空星空」，還沒有套用。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "結束預覽" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-bg", "warm-gray");

  // The animated ones: a fake door, nothing charged.
  await section
    .getByRole("listitem")
    .filter({ hasText: "太空星空" })
    .getByRole("button", { name: /永久解鎖/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "永久解鎖「太空星空」" });
  await expect(dialog.getByText(/現在不會收費/)).toBeVisible();
  await dialog.getByRole("button", { name: "加入名單" }).click();
  await expect(dialog.getByText("已加入名單，推出時會通知你。")).toBeVisible();
});

test("the theme cards: recommended first, live previews, keyboard radio group", async ({
  page,
}) => {
  await signInAsLearner(page);
  await page.goto("/account");
  const section = page.getByRole("region", { name: "背景主題" });

  // Six recommended themes come first; the rest are grouped by style.
  const headings = section.getByRole("heading", { level: 3 });
  await expect(headings.first()).toHaveText("推薦主題");
  const recommended = section.getByRole("list").first();
  await expect(recommended.getByRole("listitem")).toHaveCount(6);
  await expect(section.getByRole("heading", { name: "紙張" })).toBeVisible();

  // Each card has a live miniature drawn in that theme (no images).
  const ocean = section.getByRole("listitem").filter({ hasText: "海洋" });
  const mini = ocean.locator('[data-bg="ocean"]');
  await expect(mini).toBeVisible();
  await expect(ocean.locator("img")).toHaveCount(0);
  await expect(ocean.getByText("毛玻璃")).toBeVisible();

  // One native radio group: arrow keys move between the open themes
  // (closed ones are skipped) and apply them; the card shows the focus.
  const warm = section.getByRole("radio", { name: /暖灰/ });
  await warm.check();
  await expect(warm).toBeChecked();
  await warm.focus();
  await page.keyboard.press("ArrowRight");
  const pastel = section.getByRole("radio", { name: /柔和粉彩/ });
  await expect(pastel).toBeChecked();
  await expect(pastel).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-bg", "pastel");
  const card = section
    .getByRole("listitem")
    .filter({ has: page.getByRole("radio", { name: /柔和粉彩/ }) });
  await expect(card).toHaveCSS("outline-style", "solid");
  await expect(card.getByText("使用中")).toBeVisible();
});

test.describe("theme cards on a phone", () => {
  test.use({
    viewport: { width: 375, height: 800 },
    hasTouch: true,
    isMobile: true,
  });

  test("every control in a card is at least 44px tall", async ({ page }) => {
    await signInAsLearner(page);
    await page.goto("/account");
    const section = page.getByRole("region", { name: "背景主題" });
    const card = section.getByRole("listitem").filter({ hasText: "太空星空" });
    const radio = card.getByRole("radio");
    const boxes = [
      await radio.locator("xpath=ancestor::label").boundingBox(),
      await card.getByRole("button", { name: /預覽/ }).boundingBox(),
      await card.getByRole("button", { name: /永久解鎖/ }).boundingBox(),
    ];
    for (const box of boxes) expect(box!.height).toBeGreaterThanOrEqual(44);
    // The card fits the phone's width (no sideways scrolling).
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(375);
  });
});

test("switching themes fades, and is instant for reduced motion", async ({
  page,
}) => {
  await page.goto("/terms");
  const duration = () =>
    page.evaluate(() => {
      document.documentElement.setAttribute("data-theme-switching", "");
      const value = getComputedStyle(document.body).transitionDuration;
      document.documentElement.removeAttribute("data-theme-switching");
      return value;
    });
  expect(await duration()).toMatch(/^0\.28s/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await duration()).toMatch(/^0s/);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the account page with a background passes axe (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await signInAsLearner(page);
    await page.addInitScript(() =>
      localStorage.setItem("ll-background", "pastel"),
    );
    await page.goto("/account");
    await expect(page.locator("html")).toHaveAttribute("data-bg", "pastel");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      ),
    ).toEqual([]);
  });
}

test("animated backgrounds move, and stand still for reduced motion", async ({
  page,
}) => {
  const animation = () =>
    page.evaluate(
      () => getComputedStyle(document.body, "::after").animationName,
    );
  await page.addInitScript(() => localStorage.setItem("ll-background", "rain"));
  await page.goto("/terms");
  await expect(page.locator("html")).toHaveAttribute("data-bg", "rain");
  expect(await animation()).toBe("ll-rain");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await animation()).toBe("none");
});
