import { expect, signInAsAdmin, signInAsLearner, test } from "./fixtures";

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
