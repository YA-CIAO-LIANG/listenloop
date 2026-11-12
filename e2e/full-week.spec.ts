import { devices, type Page } from "@playwright/test";
import mock from "./mock-supabase/practices.json";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/**
 * A whole week through the UI on one audio material (the 7-day loop):
 * Day 1 dictation, Days 2–6 shadowing without a microphone ("I said it"),
 * one calendar day apart, then Day 7 dictation and the week's result.
 * Run on a desktop and on an emulated phone (touch, the phone's UA).
 */
const id = `p-${mock.ready.id}`;
const sentences = mock.ready.practice_sentences.map((s) => s.en);
const day = (n: number) => `2026-11-0${n}`;

async function dictation(page: Page) {
  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  for (const [i, answer] of sentences.entries()) {
    await input.fill(answer);
    await page.getByRole("button", { name: "送出" }).click();
    await page
      .getByRole("button", {
        name: i === sentences.length - 1 ? "查看結果" : "下一句",
      })
      .click();
  }
}

async function shadowing(page: Page) {
  for (const [i] of sentences.entries()) {
    await expect(
      page.getByText(`第 ${i + 1} / ${sentences.length} 句`),
    ).toBeVisible();
    await page.getByRole("button", { name: "我念完了" }).click();
  }
  await expect(page.getByText("今天的跟讀完成了！")).toBeVisible();
}

for (const where of ["desktop", "phone"] as const) {
  test.describe(where, () => {
    if (where === "phone") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { defaultBrowserType, ...pixel } = devices["Pixel 7"];
      test.use(pixel);
    }

    test("Day 1 to Day 7 on one material, and the week is passed", async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await signInAsAuthor(page);
      await page.addInitScript(() => {
        const w = window as unknown as Record<string, unknown>;
        delete w.SpeechRecognition;
        delete w.webkitSpeechRecognition;
        localStorage.setItem("ll-hands-free:v1", "off");
      });

      await setToday(page, day(1));
      await page.goto(`/videos/${id}/day/1`);
      await dictation(page);
      await expect(page.getByText("100%").first()).toBeVisible();

      for (let n = 2; n <= 6; n++) {
        await setToday(page, day(n));
        await page.goto(`/videos/${id}/day/${n}`);
        await expect(
          page.getByRole("heading", { name: new RegExp(`第 ${n} 天：跟讀`) }),
        ).toBeVisible();
        await shadowing(page);
      }

      await setToday(page, day(7));
      await page.goto(`/videos/${id}/day/7`);
      await dictation(page);
      await expect(page.getByText("第 1 週結果")).toBeVisible();
      await expect(
        page.getByText("通過！這支影片的七天循環完成了。"),
      ).toBeVisible();
    });
  });
}
