import mock from "./mock-supabase/practices.json";
import {
  expect,
  setToday,
  signInAsAuthor,
  signInAsPaid,
  test,
} from "./fixtures";

/**
 * Playback speed (D73): audio practices offer 0.75×, 1×, 1.25×; answers
 * count by the speed they were heard at, and the result says so. Videos
 * have no speed control.
 */
const practice = mock.ready;

test("a slow dictation scores 90% of its words and says so", async ({
  page,
}) => {
  await setToday(page, "2026-11-01");
  // Playback speed is a paid feature (D102).
  await signInAsPaid(page);
  await page.goto(`/videos/p-${practice.id}/day/1`);
  const speed = page.getByRole("group", { name: "播放速度" });
  await speed.getByText("0.75×").click();
  await expect(speed.getByRole("radio", { name: "0.75×" })).toBeChecked();
  await expect(page.getByText(/慢速作答以 90% 計分/)).toBeVisible();

  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  for (const [i, sentence] of practice.practice_sentences.entries()) {
    await input.fill(sentence.en);
    await page.getByRole("button", { name: "送出" }).click();
    const last = i === practice.practice_sentences.length - 1;
    await page
      .getByRole("button", { name: last ? "查看結果" : "下一句" })
      .click();
  }

  await expect(page.getByText("慢速完成")).toBeVisible();
  await expect(page.getByText("原始正確率 100%")).toBeVisible();
  await expect(page.getByText(/今日任務完成 · 正式成績 90%/)).toBeVisible();
});

test("videos have no speed control", async ({ page }) => {
  await setToday(page, "2026-11-01");
  await page.goto("/videos/sintel/day/1");
  await expect(
    page.getByRole("textbox", { name: "你聽到的句子" }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "播放速度" })).toHaveCount(0);
});

test("on the free plan, speed is a paid feature (D102)", async ({ page }) => {
  // The author, on the free plan, practicing their own (D106).
  await signInAsAuthor(page);
  await setToday(page, "2026-11-01");
  await page.goto(`/videos/p-${practice.id}/day/1`);
  await expect(
    page.getByText(/播放速度.*是 Plus 以上方案的功能/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "看方案" })).toHaveAttribute(
    "href",
    "/pricing?from=speed",
  );
});
