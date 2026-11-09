import AxeBuilder from "@axe-core/playwright";
import mock from "./mock-supabase/practices.json";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/**
 * The progress share card (D110) on the Day 7 result: an image with the
 * scores and title, to download or share.
 */
const videoId = `p-${mock.ready.id}`;
const day = (date: string, answers: string[], score: number) => ({
  done: true,
  date,
  score,
  answers,
});

test("Day 7's result offers a share card to download", async ({ page }) => {
  await signInAsAuthor(page);
  const shadow = (date: string) => ({
    done: true,
    date,
    sentences: [
      { done: true, coverage: 1 },
      { done: true, coverage: 1 },
    ],
  });
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      `ll-progress:v1:${videoId}`,
      JSON.stringify({
        videoId,
        week: 1,
        startedAt: "2026-11-01",
        days: {
          1: day(
            "2026-11-01",
            ["The nation is on the left.", "Turn right."],
            0.6,
          ),
          2: shadow("2026-11-02"),
          3: shadow("2026-11-03"),
          4: shadow("2026-11-04"),
          5: shadow("2026-11-05"),
          6: shadow("2026-11-06"),
          7: day(
            "2026-11-07",
            ["The station is on the left.", "Turn right at the bank."],
            1,
          ),
        },
        status: "passed",
        history: [
          {
            week: 1,
            startedAt: "2026-11-01",
            day1Score: 0.6,
            day7Score: 1,
            passed: true,
          },
        ],
      }),
    ],
  );
  await setToday(page, "2026-11-07");
  await page.goto(`/videos/${videoId}/day/7`);
  await expect(page.getByRole("heading", { name: "進步分享卡" })).toBeVisible();
  const image = page.getByRole("img", { name: /進步分享卡：第 1 天/ });
  await expect(image).toBeVisible();
  // A real PNG, drawn in the browser.
  expect(
    await image.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(1080);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "下載圖片" }).click();
  expect((await download).suggestedFilename()).toBe("listenloop-progress.png");
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});
