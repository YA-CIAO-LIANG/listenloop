import { expect, signInAsAdmin, signInAsAuthor, test } from "./fixtures";

/**
 * Fixes to review (D117): an admin sees each suggestion with the current
 * text and why, and accepts or rejects it; nothing changes before that.
 * A fix whose sentence changed since it was made is set aside.
 */
test("an admin accepts one suggested fix and sets aside an out-of-date one", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "後台導覽" })
    .getByRole("link", { name: "待審修正" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "待審修正" }),
  ).toBeVisible();

  const fix = page.getByRole("listitem").filter({ hasText: "第 1 句 · 翻譯" });
  await expect(fix.getByText("可以看一下你的護照嗎？")).toBeVisible();
  await expect(fix.getByText("可以讓我看一下你的護照嗎？")).toBeVisible();
  await expect(fix.getByText("E2E：語氣更有禮貌。")).toBeVisible();
  await fix.getByRole("button", { name: "接受" }).click();
  await expect(fix.getByRole("status")).toHaveText("已接受，已寫入教材。");

  // The second fix was made from text the sentence no longer has.
  const stale = page
    .getByRole("listitem")
    .filter({ hasText: "第 2 句 · 全形數字" });
  await expect(
    stale.getByText("中文裡的英文字母與數字一律用半形", { exact: false }),
  ).toBeVisible();
  await stale.getByRole("button", { name: "接受" }).click();
  await expect(stale.getByRole("status")).toContainText("已過期");

  // Both are done: the list is empty after a reload.
  await page.reload();
  await expect(page.getByText("目前沒有待審的修正。")).toBeVisible();
});

test("the fixes page is a 404 for everyone else", async ({ page }) => {
  await signInAsAuthor(page);
  expect((await page.goto("/admin/fixes"))?.status()).toBe(404);
});
