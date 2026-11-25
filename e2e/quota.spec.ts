import {
  expect,
  signInAsAdmin,
  signInAsAuthor,
  signInAsLearner,
  signInWithEmail,
  test,
} from "./fixtures";

/** My quota and the admin's quota changes (D161). */
test("a learner sees each allowance and when it resets", async ({ page }) => {
  await signInAsLearner(page);
  await page.goto("/account");
  await page.getByRole("link", { name: "查看我的額度 →" }).click();
  await expect(
    page.getByRole("heading", { name: "我的額度", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "本週建立教材的字數" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "今天用指令修改的次數" }),
  ).toBeVisible();
  await expect(page.getByText(/重設/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "其他限制" })).toBeVisible();
});

test("used up: when it resets in the learner's own clock, and a way on (D170)", async ({
  page,
}) => {
  // The author's 300 free words this week are used.
  await signInAsAuthor(page);
  await page.goto("/account/usage");
  const week = page
    .getByRole("listitem")
    .filter({ hasText: "本週建立教材的字數" });
  await expect(week).toContainText("已經用完了。");
  await expect(week).toContainText(/\d+\/\d+（週一）\s?00:00 重設/);
  await expect(
    week.getByRole("link", { name: "需要更多？看付費方案" }),
  ).toHaveAttribute("href", "/pricing?from=quota");
});

test("signed out, My quota asks to sign in", async ({ page }) => {
  await page.goto("/account/usage");
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)account(%2F|\/)usage/);
});

test("an admin sees the quota controls on a user's page", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/users/1");
  await expect(page.getByRole("heading", { name: "額度調整" })).toBeVisible();
  await expect(page.getByLabel("理由（必填）", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "暫停這個帳號的 AI 功能" }),
  ).toBeVisible();
});

test("an admin sees the abuse flags page (D162)", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/abuse");
  await expect(page.getByRole("heading", { name: "濫用標記" })).toBeVisible();
  await expect(page.getByText("沒有標記。")).toBeVisible();
});

test("the student plan is the all-in-one student tier; an admin picks any line and tier (D210)", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-student-plan", "student-plan@example.com");
  await page.goto("/account/usage");
  await expect(page.getByText(/學生・聽寫全方位/).first()).toBeVisible();
  // All-in-one: both parts, 2,400 words a month and 7 essays a week.
  await expect(
    page.getByRole("heading", { name: "聽力", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "寫作", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "本月建立教材的字數" }),
  ).toContainText("2,400 字");
  await expect(
    page.getByRole("listitem").filter({ hasText: "本週的作文 AI 批改" }),
  ).toContainText("/ 7 篇");
  await expect(
    page.getByRole("listitem").filter({ hasText: "本週的聊天訊息" }),
  ).toContainText("/ 135 則");

  await signInAsAdmin(page);
  await page.goto("/admin/users/1");
  const plan = page.getByRole("combobox", { name: "方案", exact: true });
  await expect(plan).toBeVisible();
  await expect(plan.locator("option")).toHaveText([
    "免費方案",
    "學生・聽力",
    "Plus・聽力",
    "Pro・聽力",
    "學生・寫作",
    "Plus・寫作",
    "Pro・寫作",
    "學生・聽寫全方位",
    "Plus・聽寫全方位",
    "Pro・聽寫全方位",
  ]);
});

test("a writing plan: listening is free's, with the all-in-one upgrade (D210)", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-writing-plan", "writing-plan@example.com");
  await page.goto("/account/usage");
  await expect(page.getByText(/Plus・寫作/).first()).toBeVisible();
  await expect(
    page.getByText("你的方案不含聽力，這裡是免費版的額度。"),
  ).toBeVisible();
  // The free plan's week of words; the line's writing.
  await expect(
    page.getByRole("listitem").filter({ hasText: "本週建立教材的字數" }),
  ).toContainText("/ 300 字");
  await expect(
    page.getByRole("listitem").filter({ hasText: "本週的作文 AI 批改" }),
  ).toContainText("/ 7 篇");
  const upsell = page.getByTestId("upsell-all");
  await expect(upsell).toContainText("你目前是寫作方案");
  await upsell.getByRole("link", { name: "升級為聽寫全方位" }).click();
  await expect(page).toHaveURL(/\/pricing\?line=all/);
  await expect(page.getByTestId("plan-all-plus")).toBeVisible();
});

test("a listening plan: writing is the free trial (D210)", async ({ page }) => {
  await signInWithEmail(
    page,
    "e2e-listening-plan",
    "listening-plan@example.com",
  );
  await page.goto("/account/usage");
  await expect(page.getByText(/Plus・聽力/).first()).toBeVisible();
  await expect(
    page.getByText("你的方案不含寫作，這裡是免費版的試用額度。"),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "本月建立教材的字數" }),
  ).toContainText("3,000 字");
  await expect(
    page.getByRole("listitem").filter({ hasText: "本週的作文 AI 批改" }),
  ).toContainText("/ 2 篇");
});

test("the pricing page: three lines, all-in-one and yearly first, numbers from the settings (D210)", async ({
  page,
}) => {
  await page.goto("/pricing");
  const lines = page.getByRole("group", { name: "方案", exact: true });
  await expect(lines.getByRole("radio", { name: "聽寫全方位" })).toBeChecked();
  await expect(
    page.getByRole("group", { name: "繳費週期" }).getByRole("radio", {
      name: /年繳/,
    }),
  ).toBeChecked();
  // All-in-one Plus: most popular, NT$224 a month on a year, its savings.
  const plus = page.getByTestId("plan-all-plus");
  await expect(plus).toContainText("最受歡迎");
  await expect(plus).toContainText("NT$224");
  await expect(plus).toContainText("年繳 NT$2,690");
  await expect(plus).toContainText("比分開買每月省 NT$24");
  await expect(plus).toContainText("每月自建 3,000 字，約 20 篇 150 字的短文");
  await expect(page.getByTestId("plan-all-student")).toContainText(
    "比 Plus 便宜 30%",
  );
  await expect(page.getByTestId("plan-all-pro")).toContainText(
    "最划算，比 Plus 省 30%",
  );
  // Monthly: the month's price, the saving a month.
  await page.getByText("月繳", { exact: true }).click();
  await expect(plus).toContainText("NT$269");
  await expect(plus).toContainText("比分開買每月省 NT$29");
  // Listening: writing is the free trial; the student tier 40% less.
  await lines.getByText("聽力", { exact: true }).click();
  const listening = page.getByTestId("plan-listening-plus");
  await expect(listening).toContainText("NT$149");
  await expect(listening).toContainText("寫作：免費試用（每週 2 篇 AI 批改）");
  await expect(page.getByTestId("plan-listening-student")).toContainText(
    "比 Plus 便宜 40%",
  );
  // The overview lists all nine plans; the comparison follows the line.
  const overview = page.getByRole("table", { name: "三條方案線的額度一覽" });
  await expect(overview.getByRole("row")).toHaveCount(10);
  await expect(
    page.getByRole("table", { name: "方案比較：聽力" }),
  ).toBeVisible();
  await expect(
    page.getByText("練習官方教材和已經建立的教材都不限時間"),
  ).toBeVisible();
});
