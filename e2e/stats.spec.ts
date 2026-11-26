import AxeBuilder from "@axe-core/playwright";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/** The stats page (D75): charts with data tables, signed in only. */
const progress = {
  videoId: "sintel",
  week: 1,
  startedAt: "2026-11-01",
  days: {
    1: {
      done: true,
      date: "2026-11-01",
      score: 0.6,
      weightedScore: 0.6,
      answers: ["we moved to the city", null],
    },
  },
  status: "in-progress",
  history: [],
};
const activity = {
  days: {
    "2026-11-01": {
      official: true,
      retries: [],
      tasks: [{ videoId: "sintel", week: 1, day: 1 }],
      time: { phone: { sintel: 600 } },
    },
    "2026-11-02": {
      official: false,
      retries: [],
      time: { phone: { sintel: 300 } },
    },
  },
};

test.beforeEach(async ({ page }) => {
  await setToday(page, "2026-11-02");
  await page.addInitScript(
    ([p, a]) => {
      localStorage.setItem("ll-progress:v1:sintel", p);
      localStorage.setItem("ll-activity:v1", a);
    },
    [JSON.stringify(progress), JSON.stringify(activity)] as const,
  );
});

test("signed out, stats ask to sign in", async ({ page }) => {
  await page.goto("/stats");
  await expect(
    page.getByRole("heading", { name: "登入後查看學習進度" }),
  ).toBeVisible();
});

test("signed in, stats show time, streak, and a data table", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "主要導覽" })
    .getByRole("link", { name: "學習分析" })
    .click();
  await expect(
    page.getByRole("heading", { name: "學習分析", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("近 7 天共練習聽力 15 分鐘")).toBeVisible();
  await expect(page.getByText("2 天").first()).toBeVisible();

  const time = page.getByRole("figure", { name: "每日聽力練習時間" });
  await time.getByText("查看資料表").click();
  await expect(time.getByRole("table")).toContainText("10");
  await page
    .getByRole("group", { name: "期間", exact: true })
    .getByText("月")
    .click();
  await expect(page.getByText("近 30 天共練習聽力 15 分鐘")).toBeVisible();

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.reload();
    await expect(page.getByRole("figure").first()).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("iframe")
      .analyze();
    expect(
      results.violations.map(
        (v) => `${scheme} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`,
      ),
    ).toEqual([]);
  }
});

test("score unlocks an accent color that stays after a reload, and paid unlocks are a fake door (D93)", async ({
  page,
}) => {
  // Six days in a row, each with 5 sentences at 100% (6 × 20 + 5 × 5),
  // plus Day 1 from the progress above on its own day: 155.
  const days = Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [
      `2026-10-${String(25 + i).padStart(2, "0")}`,
      {
        official: true,
        retries: [],
        tasks: [{ videoId: "sintel", week: 1, day: i + 1, perfect: 5 }],
      },
    ]),
  );
  await page.addInitScript((a) => {
    localStorage.setItem("ll-activity:v1", a);
  }, JSON.stringify({ days }));
  await signInAsAuthor(page);
  await page.goto("/stats");

  const score = page.getByRole("region", { name: "分數" });
  await expect(score.getByText("再 95 分解鎖「藍」")).toBeVisible();
  await score.getByRole("radio", { name: /青綠/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "teal");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "teal");

  await page
    .getByRole("region", { name: "分數" })
    .getByRole("button", { name: "NT$30 永久解鎖" })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "永久解鎖「藍」" });
  await expect(dialog.getByText(/現在不會收費/)).toBeVisible();
  await dialog.getByRole("button", { name: "加入名單" }).click();
  await expect(dialog.getByText("已加入名單，謝謝！")).toBeVisible();
});
