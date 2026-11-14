import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import mock from "./mock-supabase/practices.json";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/**
 * Practice time (D74, D181): the timer on a practice page (paused when
 * idle or hidden, each second on the local date it was counted), the
 * calendar's rings with their legend, tooltip, and spoken time, and the
 * stats page showing the same minutes.
 */
const official = `p-${mock.official.id}`;

type DayTime = Record<string, Record<string, number>>;
const timeOn = (page: Page) =>
  page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem("ll-activity:v1") ?? "{}") as {
      days?: Record<string, { time?: DayTime }>;
    };
    const out: Record<string, number> = {};
    for (const [date, day] of Object.entries(log.days ?? {})) {
      out[date] = Object.values(day.time ?? {})
        .flatMap((d) => Object.values(d))
        .reduce((a, b) => a + b, 0);
    }
    return out;
  });

test.describe("the timer, in Chicago", () => {
  test.use({ timezoneId: "America/Chicago" });

  test("splits at local midnight, stops when idle or hidden", async ({
    page,
  }) => {
    // 23:59 on 2026-11-14 in Chicago (05:59 UTC on the 15th).
    await page.clock.install({ time: new Date("2026-11-15T05:59:00Z") });
    await page.goto(`/videos/${official}/day/1`);
    const input = page.getByRole("textbox", { name: "你聽到的句子" });
    await expect(input).toBeVisible();
    await page.clock.pauseAt(new Date("2026-11-15T05:59:40Z"));
    await input.click();
    // Typing every 10 s for a minute: 20 s before midnight, 40 s after.
    for (let i = 0; i < 6; i++) {
      await input.press("a");
      await page.clock.runFor(10_000);
    }
    const split = await timeOn(page);
    expect(split["2026-11-14"]).toBeGreaterThanOrEqual(18);
    expect(split["2026-11-14"]).toBeLessThanOrEqual(22);
    expect(split["2026-11-15"]).toBeGreaterThanOrEqual(30);

    // No input: counting stops two minutes after the last key.
    await page.clock.runFor(5 * 60_000);
    const idle = (await timeOn(page))["2026-11-15"];
    expect(idle).toBeLessThanOrEqual(40 + 125);
    await page.clock.runFor(60_000);
    expect((await timeOn(page))["2026-11-15"]).toBe(idle);

    // Hidden (another tab, the app in the background): paused too.
    await input.press("a");
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(60_000);
    const hidden = (await timeOn(page))["2026-11-15"];
    await page.clock.runFor(60_000);
    expect((await timeOn(page))["2026-11-15"]).toBe(hidden);
  });
});

/** Minutes practiced on days of November 2026 (today is the 20th). */
const minutes: Record<string, number> = {
  "2026-11-02": 14,
  "2026-11-03": 15,
  "2026-11-04": 30,
  "2026-11-05": 72,
  "2026-11-06": 120,
  "2026-11-07": 200,
};
const activity = {
  days: Object.fromEntries(
    Object.entries(minutes).map(([date, m]) => [
      date,
      { official: false, retries: [], time: { phone: { sintel: m * 60 } } },
    ]),
  ),
};

test.describe("the calendar's rings", () => {
  test.beforeEach(async ({ page }) => {
    await setToday(page, "2026-11-20");
    await page.addInitScript((a) => {
      localStorage.setItem("ll-activity:v1", a);
    }, JSON.stringify(activity));
    await signInAsAuthor(page);
  });

  test("a ring per time, a legend, the time in words, the same as stats", async ({
    page,
  }) => {
    await page.goto("/");
    const calendar = page.locator("#practice-calendar-days");
    await expect(calendar).toBeVisible();
    const ringOf = (day: number) =>
      calendar
        .getByRole("button", { name: new RegExp(`^11月${day}日，`) })
        .getAttribute("data-ring");
    expect(await ringOf(2)).toBe("0");
    expect(await ringOf(3)).toBe("1");
    expect(await ringOf(4)).toBe("2");
    expect(await ringOf(5)).toBe("3");
    expect(await ringOf(6)).toBe("4");
    expect(await ringOf(7)).toBe("5");
    // Screen readers hear the time; hovering shows it.
    const fifth = calendar.getByRole("button", {
      name: "11月5日，練習 1 小時 12 分，沒有完成任務",
    });
    await fifth.hover();
    await expect(page.getByRole("tooltip")).toContainText("練習 1 小時 12 分");
    // Clicking lists it under the calendar (how phones see it).
    await fifth.click();
    await expect(page.getByTestId("calendar-day-time")).toHaveText(
      "練習 1 小時 12 分",
    );
    await expect(
      page.getByRole("list", { name: "練習時間" }).getByRole("listitem"),
    ).toHaveText([
      "15 分鐘以上",
      "30 分鐘以上",
      "1 小時以上",
      "2 小時以上",
      "3 小時以上",
    ]);

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.reload();
      await expect(calendar).toBeVisible();
      const results = await new AxeBuilder({ page })
        .include("#practice-calendar-days")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    }

    // The stats page counts the same minutes for the same days.
    await page.goto("/stats");
    await page.getByRole("group", { name: "期間" }).getByText("月").click();
    const time = page.getByRole("figure", { name: "每日練習時間" });
    await time.getByText("查看資料表").click();
    const table = time.getByRole("table");
    for (const [date, m] of Object.entries(minutes)) {
      const day = Number(date.slice(8));
      await expect(
        table.getByRole("row", {
          name: new RegExp(`^11/${day}\\s+${m}$`),
        }),
      ).toBeVisible();
    }
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 360, height: 800 }, hasTouch: true });

    test("the rings stay inside their day", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: /展開整月/ }).click();
      const day = page
        .locator("#practice-calendar-days")
        .getByRole("button", { name: /^11月7日，/ });
      const outer = (await day.boundingBox())!;
      const ring = (await day.locator("span").boundingBox())!;
      expect(ring.x).toBeGreaterThanOrEqual(outer.x);
      expect(ring.y).toBeGreaterThanOrEqual(outer.y);
      expect(ring.x + ring.width).toBeLessThanOrEqual(outer.x + outer.width);
      expect(ring.y + ring.height).toBeLessThanOrEqual(outer.y + outer.height);
    });
  });
});
