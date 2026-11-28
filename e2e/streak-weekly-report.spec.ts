import type { Page } from "@playwright/test";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/**
 * Retention (D176): the weekly report on Monday, the streak freeze, and
 * the "all done today" note on the signed-in home page.
 */
async function seed(page: Page, progress: object | null, activity: object) {
  await page.addInitScript(
    ([p, a]) => {
      if (p) localStorage.setItem("ll-progress:v1:sintel", p);
      localStorage.setItem("ll-activity:v1", a);
    },
    [progress ? JSON.stringify(progress) : null, JSON.stringify(activity)] as [
      string | null,
      string,
    ],
  );
}

test("Monday's report sums up last week and can be dismissed", async ({
  page,
}) => {
  // 2026-11-23 is a Monday; last week is 11-16 to 11-22.
  await setToday(page, "2026-11-23");
  await seed(page, null, {
    days: {
      "2026-11-16": {
        official: false,
        retries: [],
        time: { phone: { sintel: 900 } },
      },
      "2026-11-18": {
        official: false,
        retries: [],
        time: { phone: { sintel: 300 } },
      },
    },
    review: {
      dragon: {
        en: "The dragon flew away.",
        zh: "龍飛走了。",
        videoId: "sintel",
        i: 0,
        stage: 0,
        due: "2026-11-19",
        at: "2026-11-18T02:00:00.000Z",
      },
    },
  });
  await signInAsAuthor(page);
  await page.goto("/");

  const report = page.getByRole("region", { name: "上週學習報告" });
  await expect(report).toBeVisible();
  await expect(report).toContainText("11/16–11/22");
  await expect(report).toContainText("20 分鐘");
  await expect(report).toContainText("2 / 7 天");
  await expect(report.locator('[lang="en"]')).toContainText("dragon");
  await expect(report).toContainText("這週試著多練幾天");

  await report.getByRole("button", { name: "知道了" }).click();
  await expect(report).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { name: "今日任務" })).toBeVisible();
  await expect(page.getByRole("region", { name: "上週學習報告" })).toHaveCount(
    0,
  );
});

test("a freeze keeps the streak, and finishing today says what's tomorrow", async ({
  page,
}) => {
  // 2026-11-16 is a Monday; 11-17 is missed, 11-18 is today.
  await setToday(page, "2026-11-18");
  await seed(
    page,
    {
      videoId: "sintel",
      week: 1,
      startedAt: "2026-11-16",
      days: {
        1: { done: true, date: "2026-11-16", score: 0.6, weightedScore: 0.6 },
        2: { done: true, date: "2026-11-18" },
      },
      status: "in-progress",
      history: [],
    },
    {
      days: {
        "2026-11-16": {
          official: true,
          retries: [],
          tasks: [{ videoId: "sintel", week: 1, day: 1 }],
        },
        "2026-11-18": {
          official: true,
          retries: [],
          tasks: [{ videoId: "sintel", week: 1, day: 2 }],
        },
      },
    },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signInAsAuthor(page);
  await page.goto("/");

  const streak = page.getByTestId("streak");
  await expect(streak).toContainText("聽力連續練習 2 天");
  await expect(streak).toContainText("補救卡：本週剩 0 張");
  await expect(streak).toContainText(
    "補救卡保住了你的連續天數（11/17 沒練習）",
  );

  const done = page
    .getByRole("status")
    .filter({ hasText: "今天的任務都完成了" });
  await expect(done).toBeVisible();
  await expect(done).toContainText("明天：第 3 天 跟讀 — Sintel");
  // Reduced motion: the check is just there, not drawn.
  const animation = await done
    .locator("path")
    .evaluate((path) => getComputedStyle(path).animationName);
  expect(animation).toBe("none");
  // Not Monday's report: that's only Monday to Wednesday with last week's
  // practice, and there was none.
  await expect(page.getByRole("region", { name: "上週學習報告" })).toHaveCount(
    0,
  );
});
