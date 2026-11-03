import sintel from "../data/videos/sintel.json";
import { expect, setToday, test } from "./fixtures";

const PROGRESS_KEY = (videoId: string) => `ll-progress:v1:${videoId}`;

/** Another practice already on this device, a few days in. */
const otherPractice = {
  videoId: "retired-video",
  week: 1,
  startedAt: "2026-10-28",
  days: {
    "1": { done: true, date: "2026-10-28", score: 0.7, answers: ["hello"] },
    "2": {
      done: true,
      date: "2026-10-29",
      sentences: [{ done: true, coverage: 0.9 }],
    },
  },
  status: "in-progress",
  history: [],
};

test("Day 1 dictation through the UI, then Day 2 opens the next day", async ({
  page,
}) => {
  await setToday(page, "2026-11-01");
  await page.goto("/videos/sintel/day/1");

  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  for (const [i, sentence] of sintel.sentences.entries()) {
    await expect(
      page.getByText(`第 ${i + 1} / ${sintel.sentences.length} 句`),
    ).toBeVisible();
    await input.fill(sentence.en);
    await page.getByRole("button", { name: "送出" }).click();
    await expect(page.getByText("這句正確率 100%")).toBeVisible();
    const last = i === sintel.sentences.length - 1;
    await page
      .getByRole("button", { name: last ? "查看結果" : "下一句" })
      .click();
  }
  await expect(page.getByText(/今日任務完成/)).toBeVisible();

  await page.goto("/");
  const today = page.getByRole("heading", { name: "今日任務" }).locator("..");
  await expect(today.getByText("✓ 已完成")).toBeVisible();

  // Next calendar day: Day 2 (shadowing) is open.
  await setToday(page, "2026-11-02");
  await page.reload();
  await expect(today.getByText(/第 2 天/)).toBeVisible();
  await expect(today.getByText("可以做")).toBeVisible();
});

test("two practices keep their own cycles; removing one leaves the other", async ({
  page,
}) => {
  await setToday(page, "2026-11-01");
  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key))
        window.localStorage.setItem(key, value);
    },
    [
      PROGRESS_KEY(otherPractice.videoId),
      JSON.stringify(otherPractice),
    ] as const,
  );

  // Start Sintel: one answered sentence is saved as its own progress.
  await page.goto("/videos/sintel/day/1");
  await page
    .getByRole("textbox", { name: "你聽到的句子" })
    .fill(sintel.sentences[0].en);
  await page.getByRole("button", { name: "送出" }).click();
  await expect(page.getByText("這句正確率 100%")).toBeVisible();

  await page.goto("/practices");
  const inProgress = page.getByRole("region", { name: /進行中/ });
  await expect(inProgress.getByRole("listitem")).toHaveCount(2);
  const sintelRow = inProgress
    .getByRole("listitem")
    .filter({ hasText: "Sintel" });
  const otherRow = inProgress
    .getByRole("listitem")
    .filter({ hasText: "（已下架的影片）" });
  await expect(sintelRow.getByText(/第 1 天/)).toBeVisible();
  await expect(otherRow.getByText(/第 3 天/)).toBeVisible();

  await otherRow.getByRole("button", { name: "移除…" }).click();
  await otherRow.getByRole("button", { name: "移除進度" }).click();
  await expect(
    page.getByText("已移除「（已下架的影片）」的練習進度。"),
  ).toBeVisible();
  await expect(inProgress.getByRole("listitem")).toHaveCount(1);

  // Sintel's progress is untouched; the other is gone from storage.
  const stored = await page.evaluate(
    ([sintelKey, otherKey]) => ({
      sintel: JSON.parse(window.localStorage.getItem(sintelKey) ?? "null"),
      other: window.localStorage.getItem(otherKey),
    }),
    [PROGRESS_KEY("sintel"), PROGRESS_KEY(otherPractice.videoId)] as const,
  );
  expect(stored.other).toBeNull();
  expect(stored.sintel.days["1"].answers[0]).toBe(sintel.sentences[0].en);
});
