import AxeBuilder from "@axe-core/playwright";
import { devices, type Page } from "@playwright/test";
import {
  checkBackAnswer,
  expect,
  setToday,
  signInWithEmail,
  test,
} from "./fixtures";

/**
 * The writing calendar (D201): on /writing, each day's finished cycle
 * day, essay, chat, and extra practice marks, and the chosen day's
 * content with links; the home calendar's All | Listening | Writing.
 * Chinese and English, light and dark, a desktop and an emulated phone.
 */
const PROMPT = "daily-perfect-weekend";
const E2E = `http://localhost:${process.env.E2E_PORT ?? 3200}`;

async function dayOneAndTwo(page: Page) {
  await setToday(page, "2026-11-11");
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page
    .getByRole("textbox", { name: "你的文章" })
    .fill(
      "My perfect weekend would start slowly. On Saturday I go to the park. We eat lunch and talk about school.",
    );
  await page.getByRole("button", { name: "送出，取得 AI 回饋" }).click();
  await expect(page.getByRole("heading", { name: "整體分數" })).toBeVisible();
  await setToday(page, "2026-11-12");
  await page.goto(`/writing/${PROMPT}/day/2`);
  const done = page.getByRole("heading", {
    name: "今天的練習完成了！明天再來。",
  });
  for (let step = 0; step < 10 && !(await done.isVisible()); step++) {
    await page.locator("#back-answer").fill("My perfect weekend");
    await checkBackAnswer(page);
    await page
      .getByRole("button", { name: /^(下一句|完成今天的練習)$/ })
      .click();
  }
  await expect(done).toBeVisible();
  // One set of extra practice, ended early.
  await page.getByRole("button", { name: "額外練習" }).click();
  await page.locator("#back-answer").fill("My weekend");
  await checkBackAnswer(page);
  await page.getByRole("button", { name: "結束額外練習" }).click();
  await expect(
    page.getByRole("heading", { name: "額外練習完成了！" }),
  ).toBeVisible();
}

for (const device of ["desktop", "Pixel 7"] as const) {
  test.describe(device, () => {
    if (device !== "desktop") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { defaultBrowserType, ...rest } = devices[device];
      test.use(rest);
    }

    test("the writing calendar and the home calendar's filter", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const tag = device === "desktop" ? "desk" : "pixel";
      await signInWithEmail(page, `e2e-wcal-${tag}`, `wcal-${tag}@example.com`);
      await dayOneAndTwo(page);

      await page.goto("/writing");
      const calendar = page.getByTestId("writing-calendar");
      await expect(
        calendar.getByRole("heading", { name: /寫作日曆/ }),
      ).toBeVisible();
      // Screen readers hear each day's state.
      const today = calendar.getByRole("button", {
        name: /^11月12日 · 今天：/,
      });
      await expect(today).toHaveAttribute("aria-label", /完成第 2 天/);
      await expect(today).toHaveAttribute("aria-label", /額外練習 1 組/);
      const day = page.getByTestId("writing-calendar-day");
      await expect(
        day.getByRole("link", { name: /第 2 天 聽寫回譯/ }),
      ).toHaveAttribute("href", `/writing/${PROMPT}/day/2`);
      await expect(
        day.getByRole("link", { name: /額外練習（正確率 \d+%）/ }),
      ).toBeVisible();
      await expect(day.getByText(/^當天平均正確率 \d+%$/)).toBeVisible();
      // The day before: the essay.
      await calendar.getByRole("button", { name: /^11月11日：/ }).click();
      await expect(
        day.getByRole("link", { name: /第 1 天 寫文章/ }),
      ).toBeVisible();
      await expect(
        calendar.getByRole("button", { name: /^11月11日：/ }),
      ).toHaveAttribute("aria-label", /寫了一篇文章/);
      const axe = await new AxeBuilder({ page })
        .include('[data-testid="writing-calendar"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(axe.violations.map((v) => v.id)).toEqual([]);

      // The home calendar: both, or one of them.
      await page.goto("/");
      const home = page.getByRole("group", { name: "日曆顯示" });
      await expect(home.getByRole("button", { name: "全部" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const lines = page.getByTestId("calendar-day-time").locator("..");
      await expect(lines.getByText(/寫作：.*第 2 天/)).toBeVisible();
      await home.getByRole("button", { name: "聽力" }).click();
      await expect(lines.getByText(/寫作：/)).toHaveCount(0);
      await expect(lines.getByText("這天沒有完成任務")).toBeVisible();
      await home.getByRole("button", { name: "寫作" }).click();
      await expect(lines.getByText(/寫作：.*第 2 天/)).toBeVisible();
    });
  });
}

test("in English and dark: readable, nothing for axe", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithEmail(page, "e2e-wcal-en", "wcal-en@example.com");
  await dayOneAndTwo(page);
  await page
    .context()
    .addCookies([{ name: "ll-locale", value: "en", url: E2E }]);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/writing");
  const calendar = page.getByTestId("writing-calendar");
  await expect(
    calendar.getByRole("heading", { name: /Writing calendar/ }),
  ).toBeVisible();
  await expect(
    page.getByTestId("writing-calendar-day").getByRole("link", {
      name: /day 2: back-translation/,
    }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="writing-calendar"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await page.goto("/");
  await expect(
    page.getByRole("group", { name: "Calendar shows" }),
  ).toBeVisible();
});
