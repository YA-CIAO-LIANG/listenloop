import mock from "./mock-supabase/practices.json";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/**
 * "My misheard words" (D108): what was misheard in a finished Day 1 comes
 * back the next day in today's tasks, as a blank in its sentence.
 */
const videoId = `p-${mock.ready.id}`;

test("a misheard word comes back the next day as a short review", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      `ll-progress:v1:${videoId}`,
      JSON.stringify({
        videoId,
        week: 1,
        startedAt: "2026-11-01",
        days: {
          1: {
            done: true,
            score: 0.6,
            date: "2026-11-01",
            answers: ["The nation is on the left.", "Turn right at the bank."],
          },
        },
        status: "in-progress",
        history: [],
      }),
    ],
  );
  await setToday(page, "2026-11-02");

  // The list fills itself from the answers already in progress.
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "今天的複習" })).toBeVisible();
  await expect(page.getByText("第 1 個，共 1 個")).toBeVisible();
  await expect(page.getByText("車站在左邊。")).toBeVisible();
  await expect(page.getByRole("button", { name: "播放這句" })).toBeVisible();
  const field = page.getByLabel("空格裡是哪個字？");
  await field.fill("Station");
  await field.press("Enter");
  await expect(page.getByText("答對了")).toBeVisible();
  await page.getByRole("button", { name: "完成" }).click();
  await expect(
    page.getByText("今天的複習完成：答對 1 個，共 1 個。"),
  ).toBeVisible();
  // Next time: 3 days later.
  await expect(page.getByText("下次複習：2026-11-05")).toBeVisible();

  // Three days on, it's in today's tasks.
  await setToday(page, "2026-11-05");
  await page.goto("/");
  await expect(page.getByText("錯字複習：1 個字")).toBeVisible();
  await page.getByRole("link", { name: "開始複習" }).click();
  await expect(page).toHaveURL(/\/review$/);
});
