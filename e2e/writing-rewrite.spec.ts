import AxeBuilder from "@axe-core/playwright";
import { devices } from "@playwright/test";
import {
  checkBackAnswer,
  expect,
  setToday,
  signInWithEmail,
  test,
} from "./fixtures";

/**
 * Days 2–6 practice the learner's own essay, corrected (D218): after
 * Day 1's review the AI rewrites the essay (the fake provider here), each
 * sentence before and after with why; three levels, "too hard" and "a
 * bit harder"; the learner chooses a version, and Day 2 practices its
 * sentences. Without a review, Day 2 asks first (or the model essay);
 * the model essay shows only when asked for. The default level is
 * remembered in the writing settings.
 */
test.use({ passPracticeChoice: false });

const PROMPT = "daily-perfect-weekend";
const DAY1 =
  "My perfect weekend would start slowly. On Saturday he go to the park with me. We eat a apple and talk about school. My family would cook dinner together.";

for (const device of ["desktop", "Pixel 7"] as const) {
  test.describe(device, () => {
    if (device !== "desktop") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { defaultBrowserType, ...rest } = devices[device];
      test.use(rest);
    }

    test("reviewed: the corrected essay, its levels, and Day 2 on it", async ({
      page,
    }) => {
      const tag = device === "desktop" ? "desk" : "pixel";
      await signInWithEmail(page, `e2e-rw-${tag}`, `rw-${tag}@example.com`);
      await setToday(page, "2026-11-11");
      await page.goto(`/writing/${PROMPT}/day/1`);
      await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
      await page.getByRole("button", { name: "送出，取得 AI 回饋" }).click();

      // Right after the review: the "natural" version, made at once.
      const panel = page.getByTestId("rewrite-panel");
      const version = page.getByTestId("rewrite-version");
      await expect(
        version.getByRole("heading", { name: "自然", exact: true }),
      ).toBeVisible();
      // Before and after, the new words marked, and why.
      const change = version.getByTestId("rewrite-change").first();
      await expect(change.getByText("原本")).toBeVisible();
      await expect(change.getByText("修改後")).toBeVisible();
      await expect(change.locator("ins").first()).toBeVisible();
      await expect(
        change.getByText("（測試）修正了用字或文法。"),
      ).toBeVisible();
      // The model essay only when asked for.
      await expect(page.getByRole("heading", { name: "範例文章" })).toHaveCount(
        0,
      );

      // Another level, then "too hard": two more versions to compare.
      await panel.getByRole("button", { name: /^只改錯/ }).click();
      await expect(
        version.getByRole("heading", { name: "只改錯", exact: true }),
      ).toBeVisible();
      await panel.getByRole("button", { name: /^自然/ }).first().click();
      await version.getByRole("button", { name: "太難了" }).click();
      await expect(
        version.getByRole("heading", { name: "自然・較簡單" }),
      ).toBeVisible();
      await expect(
        panel.getByRole("list", { name: /已產生的版本/ }).getByRole("listitem"),
      ).toHaveCount(3);
      await version.getByRole("button", { name: "選這個版本來練習" }).click();
      await expect(version.getByText(/已選定這個版本/)).toBeVisible();

      const axe = await new AxeBuilder({ page })
        .include('[data-testid="rewrite-panel"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(axe.violations.map((v) => v.id)).toEqual([]);

      // Day 2: no choice to make, the learner's own sentences.
      await setToday(page, "2026-11-12");
      await page.goto(`/writing/${PROMPT}/day/2`);
      await expect(page.getByTestId("practice-choice")).toHaveCount(0);
      await expect(
        page.getByText(/今天練習的是你自己文章的正確版本（自然）/).first(),
      ).toBeAttached();
      await page.locator("#back-answer").fill("On Saturday he goes");
      await checkBackAnswer(page);
      // The answer is one of the learner's own sentences, corrected (the
      // changed ones come first).
      await expect(
        page.getByRole("status").filter({ hasText: "正確答案" }),
      ).toContainText(/正確答案On Saturday he goes to.*這是你第 1 天寫的句子/);
      await page.getByText("看範文").click();
      await expect(
        page.getByRole("heading", { name: "範例文章" }),
      ).toBeVisible();
    });
  });
}

test("saved without a review: Day 2 asks the AI first, or the model essay", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-rw-save", "rw-save@example.com");
  await setToday(page, "2026-11-11");
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  await page.getByRole("button", { name: "只儲存，不批改" }).click();
  await page.getByRole("button", { name: "略過自評，直接儲存" }).click();
  // No review, no rewrite yet.
  await expect(page.getByTestId("rewrite-version")).toHaveCount(0);

  await setToday(page, "2026-11-12");
  await page.goto(`/writing/${PROMPT}/day/2`);
  const choice = page.getByTestId("practice-choice");
  await expect(
    choice.getByText(/要先請 AI 修改你的文章才能開始練習/),
  ).toBeVisible();
  await expect(page.locator("#back-answer")).toHaveCount(0);
  await choice
    .getByRole("button", { name: "請 AI 修改我的文章（自然）" })
    .click();
  await choice.getByRole("button", { name: "選這個版本來練習" }).click();
  await expect(page.locator("#back-answer")).toBeVisible();
});

test("a guest: the model essay instead", async ({ page }) => {
  await setToday(page, "2026-11-11");
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  await page.getByRole("button", { name: "送出並自己評分" }).click();
  await page.getByRole("button", { name: "略過自評，直接儲存" }).click();
  await setToday(page, "2026-11-12");
  await page.goto(`/writing/${PROMPT}/day/2`);
  const choice = page.getByTestId("practice-choice");
  await expect(choice.getByText(/登入後可以請 AI 修改你的文章/)).toBeVisible();
  await choice.getByRole("button", { name: "改用範文練習" }).click();
  await expect(page.locator("#back-answer")).toBeVisible();
  await expect(
    page.getByText("今天練習的是範文的句子。").first(),
  ).toBeAttached();
});

test("the default level is remembered in the writing settings", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-rw-level", "rw-level@example.com");
  await page.goto("/writing/settings");
  await page.getByRole("radio", { name: /^只改錯/ }).check();
  await page.reload();
  await expect(page.getByRole("radio", { name: /^只改錯/ })).toBeChecked();
  await setToday(page, "2026-11-11");
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  await page.getByRole("button", { name: "送出，取得 AI 回饋" }).click();
  await expect(
    page
      .getByTestId("rewrite-version")
      .getByRole("heading", { name: "只改錯", exact: true }),
  ).toBeVisible();
});
