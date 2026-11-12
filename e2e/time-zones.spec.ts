import { expect, signInAsAuthor, test } from "./fixtures";

/**
 * Dates follow the learner's own clock (D139). At 02:00 UTC on Nov 12 it's
 * already Nov 12 in Taiwan, but still Nov 11 in Chicago and Los Angeles:
 * a word due on Nov 12 is today's review only in Taiwan, and Day 2 (Day 1
 * done on Nov 11) opens only there.
 */
const MOMENT = new Date("2026-11-12T02:00:00Z");

const progress = {
  videoId: "sintel",
  week: 1,
  startedAt: "2026-11-11",
  days: {
    "1": { done: true, date: "2026-11-11", score: 0.8, answers: [] },
  },
  status: "in-progress",
  history: [],
};
const activity = {
  days: {},
  review: {
    blade: {
      en: "This blade has a dark past.",
      zh: "這把刀有一段黑暗的過去。",
      videoId: "sintel",
      i: 0,
      stage: 0,
      due: "2026-11-12",
      at: "2026-11-11T10:00:00.000Z",
    },
  },
};

for (const { zone, today, opensToday } of [
  { zone: "Asia/Taipei", today: "2026-11-12", opensToday: true },
  { zone: "America/Chicago", today: "2026-11-11", opensToday: false },
  { zone: "America/Los_Angeles", today: "2026-11-11", opensToday: false },
]) {
  test.describe(zone, () => {
    test.use({ timezoneId: zone });

    test(`today is ${today}: review and Day 2 follow it`, async ({ page }) => {
      await page.clock.setFixedTime(MOMENT);
      await signInAsAuthor(page);
      await page.addInitScript(
        ([p, a]) => {
          localStorage.setItem("ll-progress:v1:sintel", p);
          localStorage.setItem("ll-activity:v1", a);
        },
        [JSON.stringify(progress), JSON.stringify(activity)],
      );
      expect(
        await page.evaluate(
          () => Intl.DateTimeFormat().resolvedOptions().timeZone,
        ),
      ).toBe(zone);

      await page.goto("/");
      const review = page.getByText("錯字複習：1 個字");
      if (opensToday) await expect(review).toBeVisible();
      else await expect(review).toHaveCount(0);

      await page.goto("/videos/sintel/day/2");
      const locked = page.getByText(/第 2 天明天開放/);
      if (opensToday) await expect(locked).toHaveCount(0);
      else await expect(locked).toBeVisible();

      // The time zone reaches the server, for the dates it writes.
      const cookies = await page.context().cookies();
      expect(
        decodeURIComponent(
          cookies.find((c) => c.name === "ll-tz")?.value ?? "",
        ),
      ).toBe(zone);
    });
  });
}
