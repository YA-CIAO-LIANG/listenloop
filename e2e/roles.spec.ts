import {
  expect,
  setToday,
  signInAsAdmin,
  signInAsLearner,
  signInAsPaid,
  test,
} from "./fixtures";

/**
 * The four kinds of visitor walk their main path once each: a visitor
 * signed out, a free learner, a paying learner, and an admin. Each
 * checks what that role should and shouldn't see.
 */
test("a visitor: library, a material, Day 1, pricing, then sign-in", async ({
  page,
}) => {
  await setToday(page, "2026-11-12");
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主要導覽" });
  await expect(nav.getByRole("link", { name: "我的教材" })).toHaveCount(0);
  await page.goto("/videos/sintel");
  await page
    .getByRole("link", { name: /第 1 天/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/videos\/sintel\/day\/1$/);
  // Practicing needs no account (D2).
  await expect(
    page.getByRole("textbox", { name: "你聽到的句子" }),
  ).toBeVisible();
  await page.goto("/pricing");
  await expect(page.getByText("目前方案")).toHaveCount(0);
  await page.goto("/practices");
  await expect(
    page.getByRole("heading", { name: "登入後查看學習進度" }),
  ).toBeVisible();
});

test("a free learner: this week's minutes, the free plan marked, their own lists", async ({
  page,
}) => {
  await signInAsLearner(page);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "主要導覽" })
    .getByRole("link", { name: "我的教材" })
    .click();
  await expect(page.getByText("還沒有自己的教材。")).toBeVisible();
  await page.goto("/materials/new");
  await expect(page.getByTestId("week-allowance")).toContainText(
    "本週還剩 2 分鐘",
  );
  // Uploading a recording is a paid feature (D130).
  await expect(page.getByText("上傳音檔")).toBeVisible();
  await page.goto("/pricing");
  await expect(
    page.getByRole("listitem").filter({ hasText: "免費" }).first(),
  ).toContainText("目前方案");
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "今天的複習" })).toBeVisible();
  const admin = await page.goto("/admin");
  expect(admin?.status()).toBe(404);
});

test("a paying learner: no weekly limit, Plus marked, full stats", async ({
  page,
}) => {
  await signInAsPaid(page);
  await page.goto("/materials/new");
  await expect(page.getByRole("button", { name: /斷句/ })).toBeVisible();
  await expect(page.getByTestId("week-allowance")).toHaveCount(0);
  await page.goto("/pricing");
  await expect(
    page.getByRole("listitem").filter({ hasText: "訂閱 Plus" }),
  ).toContainText("目前方案");
  await page.goto("/stats");
  await expect(
    page.getByRole("heading", { name: "學習分析", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/Plus 以上方案的功能/)).toHaveCount(0);
});

test("an admin: the dashboard, usage, and creating without limits", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "主要導覽" })
    .getByRole("link", { name: "後台" })
    .click();
  await expect(page.getByRole("heading", { name: "後台總覽" })).toBeVisible();
  await page.goto("/admin/usage");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/materials/new");
  await expect(page.getByTestId("week-allowance")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Plus 方案" })).toHaveCount(0);
  await page.goto("/materials");
  await expect(
    page.getByRole("link", { name: /待處理的檢舉|檢舉/ }).first(),
  ).toBeVisible();
});
