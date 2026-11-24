import { devices, type Page } from "@playwright/test";
import { expect, setToday, signInWithEmail, test } from "./fixtures";

/**
 * The daily back-translation as it goes (D199): every answer saved at
 * once, so leaving, reloading, trying another exercise, or extra practice
 * never sends the learner back to the first sentence; the day's result;
 * extra practice with its own progress. As a guest (this browser) and
 * signed in (the account: the browser's copy wiped, the account's comes
 * back), on a desktop and an emulated phone.
 */
const PROMPT = "daily-perfect-weekend";

async function dayOne(page: Page) {
  await setToday(page, "2026-11-11");
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page
    .getByRole("textbox", { name: "你的文章" })
    .fill(
      "My perfect weekend would start slowly. On Saturday I go to the park. We eat lunch and talk about school. My family would cook dinner together.",
    );
  const self = page.getByRole("button", { name: "送出並自己評分" });
  const ai = page.getByRole("button", { name: "送出，取得 AI 回饋" });
  await expect(self.or(ai).first()).toBeVisible();
  if (await self.isVisible()) {
    await self.click();
    for (const select of await page.getByRole("combobox").all()) {
      await select.selectOption("3");
    }
    await page.getByRole("button", { name: "完成評分" }).click();
    await expect(
      page.getByRole("heading", { name: "你的自評分數" }),
    ).toBeVisible();
  } else {
    await ai.click();
    await expect(page.getByRole("heading", { name: "整體分數" })).toBeVisible();
  }
  await setToday(page, "2026-11-12");
  await page.goto(`/writing/${PROMPT}/day/2`);
}

const at = (page: Page, n: number, total?: number) =>
  expect(
    page.getByRole("progressbar", {
      name: total ? `第 ${n}／${total} 句` : new RegExp(`^第 ${n}／\\d+ 句$`),
    }),
  ).toBeVisible();

/** Answers the sentence on screen (wrong on purpose) and goes on. */
async function answer(page: Page, text = "something else entirely") {
  const box = page.locator("#back-answer");
  await box.fill(text);
  const check = page.getByRole("button", { name: "檢查", exact: true });
  const before = await check.boundingBox();
  await check.click();
  await expect(page.getByText(/寫對了|差一點/)).toBeVisible();
  // Next takes Check's place: the same spot every sentence.
  const next = page.getByRole("button", {
    name: /^(下一句|完成今天的練習|完成額外練習)$/,
  });
  await expect(next).toBeInViewport();
  const after = await next.boundingBox();
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(4);
  await next.click();
}

async function totalSentences(page: Page): Promise<number> {
  const name = await page
    .getByRole("progressbar")
    .first()
    .getAttribute("aria-label");
  return Number(/／(\d+)/.exec(name ?? "")?.[1]);
}

for (const device of ["desktop", "Pixel 7"] as const) {
  for (const who of ["guest", "signed-in"] as const) {
    test.describe(`${device}, ${who}`, () => {
      if (device !== "desktop") {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { defaultBrowserType, ...rest } = devices[device];
        test.use(rest);
      }

      test("never back to the first sentence; the result; extra practice", async ({
        page,
      }) => {
        test.setTimeout(120_000);
        const tag = `${device === "desktop" ? "desk" : "pixel"}-${who}`;
        if (who === "signed-in") {
          await signInWithEmail(
            page,
            `e2e-back-${tag}`,
            `back-${tag}@example.com`,
          );
        }
        await dayOne(page);
        await at(page, 1);
        const total = await totalSentences(page);
        expect(total).toBeGreaterThanOrEqual(5);

        // Two answered, then a reload: sentence 3.
        await answer(page);
        await at(page, 2, total);
        await answer(page);
        await at(page, 3, total);
        if (who === "signed-in") {
          // This browser's copy gone: the account's brings it back.
          await page.evaluate(() => {
            for (const key of Object.keys(localStorage)) {
              if (key.startsWith("ll-writing:")) localStorage.removeItem(key);
            }
          });
        }
        await page.reload();
        await at(page, 3, total);

        // Another exercise and back: still sentence 3.
        await page.getByRole("button", { name: "段落重組" }).click();
        await expect(page.locator("#drill-title")).toHaveText("段落重組");
        await page
          .getByRole("button", { name: "回到今天的練習" })
          .last()
          .click();
        await at(page, 3, total);

        // An answered sentence opens again, unchanged; then back.
        if (device !== "desktop") {
          await page.getByText("展開題目").click();
        }
        await page.getByRole("button", { name: "第 1 句（寫錯）" }).click();
        await expect(page.locator("#back-answer")).toHaveValue(
          "something else entirely",
        );
        await page.getByRole("button", { name: "回到第 3 句" }).click();
        await at(page, 3, total);

        // The rest of the day.
        for (let n = 3; n <= total; n++) await answer(page);
        await expect(
          page.getByRole("heading", { name: "今天的練習完成了！明天再來。" }),
        ).toBeVisible();
        await expect(
          page.getByText(new RegExp(`寫對 0／${total} 句，平均正確率 \\d+%`)),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: `聽錯或寫錯的地方（${total}）` }),
        ).toBeVisible();
        await expect(page.getByText(/已加入錯誤本/)).toBeVisible();
        await expect(page.getByRole("link", { name: "回首頁" })).toBeVisible();

        // Extra practice: a new set, its own progress.
        await page.getByRole("button", { name: "額外練習" }).click();
        await expect(
          page.getByText("額外練習：另一組句子").first(),
        ).toBeAttached();
        await at(page, 1);
        await answer(page);
        await at(page, 2);
        await page.reload();
        // Left half done: carried on, not started again.
        const more = page.getByRole("button", {
          name: /^繼續額外練習（第 2／\d+ 句）$/,
        });
        await expect(more).toBeVisible();
        await more.click();
        await at(page, 2);
        // Ended early: its own result, the day's result unchanged.
        await page.getByRole("button", { name: "結束額外練習" }).click();
        await expect(
          page.getByRole("heading", { name: "額外練習完成了！" }),
        ).toBeVisible();
        await expect(page.getByText(/寫對 0／1 句/)).toBeVisible();
        await page.getByRole("button", { name: "回到今天的結果" }).click();
        await expect(
          page.getByText(new RegExp(`寫對 0／${total} 句`)),
        ).toBeVisible();

        // The notebook has the sentences to write again.
        await page
          .getByRole("link", { name: "我的寫作錯誤本" })
          .first()
          .click();
        await expect(page.getByText("聽寫回譯").first()).toBeVisible();
      });
    });
  }
}
