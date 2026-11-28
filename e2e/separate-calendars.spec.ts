import type { Page } from "@playwright/test";
import { expect, setToday, signInWithEmail, test } from "./fixtures";

/**
 * Listening and writing are counted apart (D214): practicing one leaves
 * the other's calendar, practice time, and streak empty. Listening's
 * calendar and streak are on the home page; writing's on /writing.
 */
const PROMPT = "daily-perfect-weekend";

/** Seeds this browser's records before every page load. */
async function seed(page: Page, items: Record<string, unknown>) {
  await page.addInitScript(
    (entries) => {
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, value);
      }
    },
    Object.fromEntries(
      Object.entries(items).map(([k, v]) => [k, JSON.stringify(v)]),
    ),
  );
}

const timed = (material: string, seconds: number) => ({
  official: false,
  retries: [],
  time: { phone: { [material]: seconds } },
});

test("listening only: writing's calendar and streak stay empty", async ({
  page,
}) => {
  // 2026-11-18 (a Wednesday) is today; listening on 11-17 and 11-18.
  await setToday(page, "2026-11-18");
  await seed(page, {
    "ll-progress:v1:sintel": {
      videoId: "sintel",
      week: 1,
      startedAt: "2026-11-17",
      days: {
        1: { done: true, date: "2026-11-17", score: 0.6, weightedScore: 0.6 },
        2: { done: true, date: "2026-11-18" },
      },
      status: "in-progress",
      history: [],
    },
    "ll-activity:v1": {
      days: {
        "2026-11-17": {
          ...timed("sintel", 600),
          official: true,
          tasks: [{ videoId: "sintel", week: 1, day: 1 }],
        },
        "2026-11-18": {
          ...timed("sintel", 300),
          official: true,
          tasks: [{ videoId: "sintel", week: 1, day: 2 }],
        },
      },
    },
  });
  await signInWithEmail(page, "e2e-sep-listen", "sep-listen@example.com");

  // Home: listening's calendar and streak.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /聽力日曆/ })).toBeVisible();
  // The removed All | Listening | Writing switch (D201) is gone.
  await expect(page.getByRole("group", { name: "日曆顯示" })).toHaveCount(0);
  await expect(page.getByTestId("calendar-day-time")).toHaveText("練習 5 分");
  await expect(page.getByTestId("streak")).toContainText("聽力連續練習 2 天");

  // /writing: nothing from listening.
  await page.goto("/writing");
  const calendar = page.getByTestId("writing-calendar");
  const today = calendar.getByRole("button", { name: /^11月18日 · 今天：/ });
  await expect(today).toHaveAttribute("aria-label", /沒有完成寫作任務/);
  await expect(today).toHaveAttribute("aria-label", /沒有寫作練習時間/);
  await expect(page.getByTestId("writing-streak")).toContainText(
    "還沒有寫作的連續天數",
  );
});

test("writing only: listening's calendar and streak stay empty", async ({
  page,
}) => {
  await setToday(page, "2026-11-18");
  await seed(page, {
    "ll-writing-log:v1": {
      entries: {
        [`task:${PROMPT}:1:1`]: {
          id: `task:${PROMPT}:1:1`,
          kind: "task",
          date: "2026-11-17",
          promptId: PROMPT,
          week: 1,
          day: 1,
          percent: 70,
          at: "2026-11-17T02:00:00.000Z",
        },
        [`task:${PROMPT}:1:2`]: {
          id: `task:${PROMPT}:1:2`,
          kind: "task",
          date: "2026-11-18",
          promptId: PROMPT,
          week: 1,
          day: 2,
          percent: 80,
          at: "2026-11-18T02:00:00.000Z",
        },
      },
    },
    "ll-activity:v1": {
      days: {
        "2026-11-17": timed(`w-${PROMPT}`, 900),
        "2026-11-18": timed(`w-${PROMPT}`, 600),
      },
    },
  });
  await signInWithEmail(page, "e2e-sep-write", "sep-write@example.com");

  // /writing: writing's calendar, time, and streak.
  await page.goto("/writing");
  const calendar = page.getByTestId("writing-calendar");
  const today = calendar.getByRole("button", { name: /^11月18日 · 今天：/ });
  await expect(today).toHaveAttribute("aria-label", /完成第 2 天/);
  await expect(today).toHaveAttribute("aria-label", /10 分/);
  await expect(page.getByTestId("writing-streak")).toContainText(
    "寫作連續練習 2 天",
  );

  // Home: listening's calendar has none of it, and no listening streak.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /聽力日曆/ })).toBeVisible();
  await expect(page.getByTestId("calendar-day-time")).toHaveText(
    "沒有練習時間",
  );
  const lines = page.getByTestId("calendar-day-time").locator("..");
  await expect(lines.getByText("這天沒有完成任務")).toBeVisible();
  await expect(lines.getByText(/寫作/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /11月18日，沒有練習時間，沒有完成任務/ }),
  ).toBeVisible();
  await expect(page.getByTestId("streak")).toHaveCount(0);
});
