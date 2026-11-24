import { devices, type Page } from "@playwright/test";
import { expect, setToday, test } from "./fixtures";

/**
 * The learning-science helps (D202, D203), as a guest on a desktop and an
 * emulated phone: how sure before checking, fading hints, "where it went
 * wrong" first (at most twice a set), each switched off in the settings;
 * the evening review after the time set; Day 30's rewrite and its
 * comparison.
 */
const PROMPT = "daily-perfect-weekend";

async function dayOne(page: Page) {
  await setToday(page, "2026-11-11");
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page
    .getByRole("textbox", { name: "你的文章" })
    .fill(
      "My perfect weekend would start slowly. On Saturday I go to the park. We eat lunch and talk about school.",
    );
  await page.getByRole("button", { name: "送出並自己評分" }).click();
  await page.getByRole("button", { name: "略過自評，直接儲存" }).click();
}

const check = (page: Page) =>
  page.getByRole("button", { name: "檢查", exact: true });

async function wrong(page: Page, sure: string) {
  await page.locator("#back-answer").fill("nothing like the sentence");
  await page.getByRole("button", { name: `檢查：${sure}` }).click();
}

for (const device of ["desktop", "Pixel 7"] as const) {
  test.describe(device, () => {
    if (device !== "desktop") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { defaultBrowserType, ...rest } = devices[device];
      test.use(rest);
    }

    test("how sure, hints, and where it went wrong; each can be turned off", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await dayOne(page);
      await setToday(page, "2026-11-12");
      await page.goto(`/writing/${PROMPT}/day/2`);

      // A first try: the first letters and the word count.
      await expect(page.getByTestId("back-hint")).toContainText(/\w_+/);
      await expect(page.getByTestId("back-hint")).toContainText(/個字/);

      // How sure is the Check: Enter asks for it.
      await page.locator("#back-answer").fill("nothing like the sentence");
      await page.locator("#back-answer").press("Enter");
      await expect(
        page.getByRole("alert").filter({ hasText: "按下你有多確定" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "檢查：很確定" }).click();

      // Wrong: where it went wrong first, then the answer.
      const why = page.getByRole("textbox", { name: /你覺得錯在哪裡/ });
      await expect(why).toBeVisible();
      await expect(page.getByText("你選了：很確定")).toHaveCount(0);
      await why.fill("少了很多字");
      await page.getByRole("button", { name: "看答案" }).click();
      await expect(page.getByText("你的想法：")).toBeVisible();
      await expect(page.getByText("你選了：很確定。")).toBeVisible();
      await expect(page.getByText(/很確定卻寫錯的句子/)).toBeVisible();
      await page.getByRole("button", { name: "下一句" }).click();

      // Twice a set at most; skipping is fine.
      await wrong(page, "不確定");
      await page.getByRole("button", { name: "略過", exact: true }).click();
      await expect(page.getByText("你選了：不確定。")).toBeVisible();
      await page.getByRole("button", { name: "下一句" }).click();
      await wrong(page, "有點確定");
      await expect(why).toHaveCount(0);
      await expect(page.getByText("你選了：有點確定。")).toBeVisible();

      // All three off in the writing settings.
      await page.goto("/writing/settings");
      for (const name of [
        /送出前選信心度/,
        /提示逐漸減少/,
        /寫錯時先想想錯在哪裡/,
      ]) {
        await page.getByRole("checkbox", { name }).uncheck();
      }
      await page.goto(`/writing/${PROMPT}/day/2`);
      await expect(page.locator("#back-answer")).toBeVisible();
      await expect(page.getByTestId("back-hint")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "檢查：很確定" }),
      ).toHaveCount(0);
      await page.locator("#back-answer").fill("nothing like the sentence");
      await check(page).click();
      await expect(page.getByText(/寫對了|差一點/).first()).toBeVisible();
      await expect(why).toHaveCount(0);
    });

    test("the evening review after the time set", async ({ page }) => {
      test.setTimeout(120_000);
      await dayOne(page);
      await setToday(page, "2026-11-12");
      await page.goto(`/writing/${PROMPT}/day/2`);
      await page
        .locator("#back-answer")
        .fill("My perfect weekend would start slowly.");
      await page.getByRole("button", { name: "檢查：有點確定" }).click();
      // Morning: nothing yet.
      await page.goto("/writing");
      await expect(page.getByText("睡前回顧（約 3 分鐘）")).toHaveCount(0);
      // After 21:30: the reminder.
      await page.clock.setFixedTime(new Date("2026-11-12T22:00:00+08:00"));
      await page.goto("/writing");
      await expect(page.getByText("睡前回顧（約 3 分鐘）")).toBeVisible();
      await page.getByRole("link", { name: "開始回顧" }).click();
      await expect(page).toHaveURL(/\/writing\/review$/);
      await page
        .getByRole("textbox", { name: "第 1 句" })
        .fill("my perfect weekend would start slowly");
      await page
        .getByRole("textbox", { name: "第 2 句" })
        .fill("pizza is good");
      await page.getByRole("button", { name: "對照今天的句子" }).click();
      await expect(
        page.getByRole("heading", { name: /想起來 \d／3 句/ }),
      ).toBeVisible();
      // Done: no more reminder today; the calendar has it.
      await page.goto("/writing");
      await expect(page.getByText("睡前回顧（約 3 分鐘）")).toHaveCount(0);
      await expect(
        page
          .getByTestId("writing-calendar")
          .getByRole("button", { name: /^11月12日 · 今天：/ }),
      ).toHaveAttribute("aria-label", /做了睡前回顧/);
    });

    test("Day 30: written again, days 1, 7, and 30 compared", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await setToday(page, "2026-11-30");
      await page.goto("/writing");
      // A week finished a while ago, in this browser.
      await page.evaluate((id) => {
        const essay = (text: string, date: string, percent: number) => ({
          done: true,
          date,
          essay: text,
          self: { criteria: [], percent, weak: [] },
        });
        localStorage.setItem(
          `ll-writing:v1:${id}`,
          JSON.stringify({
            promptId: id,
            week: 1,
            startedAt: "2026-11-01",
            status: "passed",
            rule: { kind: "beat" },
            days: {
              1: essay("My weekend is good. I go park.", "2026-11-01", 50),
              7: essay(
                "My perfect weekend would start slowly, and then I would go to the park.",
                "2026-11-07",
                70,
              ),
            },
            history: [],
            updatedAt: "2026-11-07T10:00:00.000Z",
          }),
        );
      }, PROMPT);
      await page.reload();
      await expect(
        page.getByText("第 30 天：再寫一次同一個題目，看看一個月後的進步。"),
      ).toBeVisible();
      await page.getByRole("link", { name: "再寫一次" }).click();
      await expect(page).toHaveURL(new RegExp(`/writing/${PROMPT}/day/30$`));
      await expect(
        page.getByRole("heading", { level: 1, name: /第 30 天 · 再寫一次/ }),
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: "你的文章" })
        .fill(
          "My perfect weekend would start slowly. First, I would sleep late, and then my family and I would cook a big breakfast together.",
        );
      await page.getByRole("button", { name: "送出並自己評分" }).click();
      for (const select of await page.getByRole("combobox").all()) {
        await select.selectOption("4");
      }
      await page.getByRole("button", { name: "完成評分" }).click();
      await expect(
        page.getByRole("heading", { name: "第 1、7、30 天的比較" }),
      ).toBeVisible();
      await expect(page.getByText(/第 30 天的分數變化：\+\d+/)).toBeVisible();
      // Not offered again.
      await page.goto("/writing");
      await expect(page.getByRole("link", { name: "再寫一次" })).toHaveCount(0);
    });
  });
}
