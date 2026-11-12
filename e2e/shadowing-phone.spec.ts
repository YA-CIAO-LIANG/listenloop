import { devices, type Page } from "@playwright/test";
import mock from "./mock-supabase/practices.json";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/**
 * On phones the shadowing day's main button, "Next" with a microphone or
 * "I said it" without one, sits in the bar fixed to the bottom of the
 * screen, in the same place for every sentence; without a microphone its
 * "Play" is in the bar too (D124, D141). Real-device emulation: screen,
 * touch, and the phone's user agent (Chromium for both).
 */
const id = `p-${mock.ready.id}`;
const sentences = mock.ready.practice_sentences.length;

type Mic = "none" | "denied" | "works";

async function open(page: Page, mic: Mic) {
  await setToday(page, "2026-11-02");
  await signInAsAuthor(page);
  await page.addInitScript(
    ([id, n, mic]) => {
      const w = window as unknown as Record<string, unknown>;
      if (mic === "none") {
        delete w.SpeechRecognition;
        delete w.webkitSpeechRecognition;
      } else {
        // A stand-in recognizer: hears the sentence on the page, or is
        // refused the microphone.
        class FakeRecognition {
          onresult: ((e: unknown) => void) | null = null;
          onerror: ((e: unknown) => void) | null = null;
          onend: (() => void) | null = null;
          start() {
            setTimeout(() => {
              if (mic === "denied") {
                this.onerror?.({ error: "not-allowed" });
                return;
              }
              const said =
                document.querySelector("p[lang=en].text-sentence")
                  ?.textContent ?? "";
              const result = Object.assign([{ transcript: said }], {
                isFinal: true,
              });
              this.onresult?.({ results: [result] });
            }, 50);
          }
          stop() {
            this.onend?.();
          }
          abort() {}
        }
        w.SpeechRecognition = FakeRecognition;
        w.webkitSpeechRecognition = FakeRecognition;
      }
      localStorage.setItem("ll-hands-free:v1", "off");
      localStorage.setItem(
        `ll-progress:v1:${id}`,
        JSON.stringify({
          videoId: id,
          week: 1,
          startedAt: "2026-11-01",
          days: {
            "1": {
              done: true,
              date: "2026-11-01",
              score: 1,
              answers: Array(n).fill("the"),
            },
          },
          status: "in-progress",
          history: [],
        }),
      );
    },
    [id, sentences, mic] as const,
  );
  await page.goto(`/videos/${id}/day/2`);
}

/** The button is in the fixed bar: at the bottom right of the screen. */
async function expectAtThumb(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  const { width, height } = page.viewportSize()!;
  expect(
    await button.evaluate((el) => getComputedStyle(el.parentElement!).position),
  ).toBe("fixed");
  expect(Math.round(box.x + box.width)).toBe(width - 16);
  expect(box.y + box.height).toBeGreaterThan(height - 40);
  expect(box.y + box.height).toBeLessThanOrEqual(height);
  return box;
}

for (const name of ["iPhone 15", "Pixel 7"] as const) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultBrowserType, ...device } = devices[name];

  test.describe(name, () => {
    test.use(device);

    test("without a microphone: Play and I said it at the thumb, every sentence", async ({
      page,
    }) => {
      await open(page, "none");
      const first = await expectAtThumb(page, "我念完了");
      const play = page.getByRole("button", { name: "播放", exact: true });
      expect(
        await play.evaluate(
          (el) => getComputedStyle(el.parentElement!).position,
        ),
      ).toBe("fixed");
      await play.tap();
      await page.getByRole("button", { name: "我念完了" }).tap();
      await expect(page.getByText(`第 2 / ${sentences} 句`)).toBeVisible();
      expect(await expectAtThumb(page, "我念完了")).toEqual(first);
    });

    test("with a microphone, Next is in the same place; refused, I said it takes it", async ({
      page,
    }) => {
      await open(page, "works");
      const start = await expectAtThumb(page, "播放並跟讀");
      await page.getByRole("button", { name: "播放並跟讀" }).tap();
      expect(await expectAtThumb(page, "下一句")).toEqual(start);

      await open(page, "denied");
      await page.getByRole("button", { name: "播放並跟讀" }).tap();
      await expect(page.getByRole("alert")).toBeVisible();
      expect(await expectAtThumb(page, "我念完了")).toEqual(start);
    });
  });
}
