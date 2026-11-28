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
 * Days 2–6 each their own way (D219): listen and read, cloze, fading
 * hints, Chinese → English, paragraph; each day's way changeable in the
 * writing settings; and the playback settings kept everywhere (D220).
 */
test.use({ classicWritingDays: false });

const PROMPT = "daily-perfect-weekend";
const DAY1 =
  "My perfect weekend would start slowly. On Saturday he go to the park with me. We eat a apple and talk about school. My family would cook dinner together.";

const date = (n: number) => `2026-11-1${n}`;

async function dayOne(page: Page) {
  await setToday(page, date(1));
  await page.goto(`/writing/${PROMPT}/day/1`);
  await page.getByRole("textbox", { name: "你的文章" }).fill(DAY1);
  await page.getByRole("button", { name: "送出，取得 AI 回饋" }).click();
  await expect(page.getByTestId("rewrite-version")).toBeVisible();
}

/** Answers whatever the day asks until its result. */
async function finishDay(page: Page) {
  const done = page.getByRole("heading", { name: /今天的練習完成了/ });
  for (let step = 0; step < 12 && !(await done.isVisible()); step++) {
    const next = page.getByRole("button", {
      name: /^(下一句|看完了|完成今天的練習)$/,
    });
    const gaps = page.getByRole("textbox", { name: /^第 \d 個空格$/ });
    if (await page.getByTestId("listen-read").isVisible()) {
      await next.click();
    } else if ((await gaps.count()) > 0 && !(await gaps.first().isDisabled())) {
      for (const gap of await gaps.all()) await gap.fill("park");
      await page.getByRole("button", { name: "檢查", exact: true }).click();
      await next.click();
    } else {
      await page.locator("#back-answer").fill("My perfect weekend");
      await checkBackAnswer(page);
      await next.click();
    }
  }
  await expect(done).toBeVisible();
}

for (const device of ["desktop", "Pixel 7"] as const) {
  test.describe(device, () => {
    if (device !== "desktop") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { defaultBrowserType, ...rest } = devices[device];
      test.use(rest);
    }

    test("five ways over five days, each a little harder", async ({ page }) => {
      test.setTimeout(150_000);
      const tag = device === "desktop" ? "desk" : "pixel";
      await signInWithEmail(page, `e2e-fmt-${tag}`, `fmt-${tag}@example.com`);
      await dayOne(page);

      // Day 2: listen and read, the learner's sentence next to the
      // corrected one; nothing to type.
      await setToday(page, date(2));
      await page.goto(`/writing/${PROMPT}/day/2`);
      const read = page.getByTestId("listen-read");
      await expect(read.getByText("你原本寫的")).toBeVisible();
      await expect(read.getByText("正確版本")).toBeVisible();
      await expect(read.locator("ins").first()).toBeVisible();
      await expect(page.locator("#back-answer")).toHaveCount(0);
      const axe = await new AxeBuilder({ page })
        .include('[data-testid="writing-workspace"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(axe.violations.map((v) => v.id)).toEqual([]);
      await finishDay(page);
      await expect(page.getByText(/看過 \d \/ \d 句/)).toBeVisible();

      // Day 3: cloze, the gaps checked one by one.
      await setToday(page, date(3));
      await page.goto(`/writing/${PROMPT}/day/3`);
      const gap = page.getByRole("textbox", { name: "第 1 個空格" });
      await expect(gap).toBeVisible();
      for (const each of await page
        .getByRole("textbox", { name: /^第 \d 個空格$/ })
        .all()) {
        await each.fill("zzz");
      }
      await page.getByRole("button", { name: "檢查", exact: true }).click();
      await expect(
        page.getByText(/✗ 你寫「zzz」，答案是/).first(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: /^(下一句|完成今天的練習)$/ })
        .click();
      await finishDay(page);

      // Day 4: fading hints: every word's first letter and the meaning;
      // yesterday's wrong sentence first.
      await setToday(page, date(4));
      await page.goto(`/writing/${PROMPT}/day/4`);
      await expect(page.getByTestId("back-hint").first()).toBeAttached();
      await expect(
        page.getByRole("textbox", { name: "這句的英文" }),
      ).toBeVisible();
      await finishDay(page);

      // Day 5: Chinese → English, no letters.
      await setToday(page, date(5));
      await page.goto(`/writing/${PROMPT}/day/5`);
      await expect(
        page.getByRole("textbox", { name: "這句的英文" }),
      ).toBeVisible();
      await expect(page.getByTestId("back-hint")).toHaveCount(0);
      await finishDay(page);

      // Day 6: a whole paragraph heard and written.
      await setToday(page, date(6));
      await page.goto(`/writing/${PROMPT}/day/6`);
      await expect(page.locator("#back-answer")).toHaveAttribute("rows", "6");
      await expect(page.getByText(/默寫段落/).first()).toBeAttached();
    });
  });
}

test("each day's way and the playback are set once and kept", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-fmt-set", "fmt-set@example.com");
  await page.goto("/writing/settings");
  const formats = page.getByTestId("day-formats");
  await formats.getByLabel("第 2 天").selectOption("cloze");
  const playback = page.getByTestId("playback-settings");
  await playback.getByLabel("每句播放次數").selectOption("2");
  await playback.getByLabel("重播間隔").selectOption("3");
  await playback.getByLabel("聲音").selectOption("male");
  await playback.getByLabel("每句自動播放").uncheck();
  await page.reload();
  await expect(
    page.getByTestId("day-formats").getByLabel("第 2 天"),
  ).toHaveValue("cloze");
  const kept = page.getByTestId("playback-settings");
  await expect(kept.getByLabel("每句播放次數")).toHaveValue("2");
  await expect(kept.getByLabel("重播間隔")).toHaveValue("3");
  await expect(kept.getByLabel("聲音")).toHaveValue("male");
  await expect(kept.getByLabel("每句自動播放")).not.toBeChecked();

  // The same settings in listening's dictation.
  await page.goto("/videos/sintel/day/1");
  await page.getByText("播放設定").first().click();
  await expect(
    page.getByTestId("playback-settings").getByLabel("每句播放次數"),
  ).toHaveValue("2");

  // Day 2 is now the cloze.
  await dayOne(page);
  await setToday(page, date(2));
  await page.goto(`/writing/${PROMPT}/day/2`);
  await expect(
    page.getByRole("textbox", { name: "第 1 個空格" }),
  ).toBeVisible();
});
