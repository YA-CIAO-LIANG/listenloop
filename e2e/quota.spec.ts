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
    page.getByRole("heading", { name: "本週建立教材的分鐘數" }),
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
  // The author's two free minutes this week are used.
  await signInAsAuthor(page);
  await page.goto("/account/usage");
  const week = page
    .getByRole("listitem")
    .filter({ hasText: "本週建立教材的分鐘數" });
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

test("the student plan: its own AI writing allowances, set by an admin (D207)", async ({
  page,
}) => {
  await signInWithEmail(page, "e2e-student-plan", "student-plan@example.com");
  await page.goto("/account/usage");
  await expect(page.getByText(/學生方案/).first()).toBeVisible();
  // A little more than free (2), less than Plus (5).
  await expect(
    page.getByRole("listitem").filter({ hasText: "本週的 AI 寫作批改" }),
  ).toContainText(/\/\s?3/);

  await signInAsAdmin(page);
  await page.goto("/admin/users/1");
  const plan = page.getByRole("combobox", { name: "方案", exact: true });
  await expect(plan).toBeVisible();
  await expect(plan.locator("option")).toHaveText([
    "免費",
    "Plus",
    "學生",
    "Pro",
  ]);
});

test("the pricing page shows each plan's AI writing allowances (D207)", async ({
  page,
}) => {
  await page.goto("/pricing");
  const row = page.getByRole("row", { name: /^AI 寫作批改/ });
  // Free, Plus, Pro, Student.
  await expect(row.getByRole("cell")).toHaveText([
    "每週 2 次",
    "每週 5 次",
    "每週 6 次",
    "每週 3 次",
  ]);
  // Extra practice's checks are counted in sets, as on the cards.
  await expect(
    page.getByRole("row", { name: /^額外練習的 AI 批改/ }).getByRole("cell"),
  ).toHaveText(["每週 7 組", "每週 10 組", "每週 11 組", "每週 9 組"]);
  await expect(
    page.getByText(/寫作的 AI 額度比免費版稍多：每週 3 次批改/),
  ).toBeVisible();
  await expect(
    page.getByText(/寫作的 AI 額度比免費版多：每週 5 次批改、15 分鐘聊天練習/),
  ).toBeVisible();
});
