import { expect, signInAsAdmin, test } from "./fixtures";

/**
 * At a limit (D77), the page names the allowance and when it resets;
 * admins get a link to the usage page. The stand-in Supabase refuses
 * every cost reservation.
 */
test("an admin at the daily limit sees which limit, when it resets, and a link", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/materials/new");
  await page.getByText("AI 生成").click();
  await page.getByRole("button", { name: "生成文字" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "每日上限" });
  await expect(alert).toContainText("你今天的 AI 用量已達每日上限");
  await expect(alert).toContainText("00:00（台灣時間）重設");
  await expect(
    alert.getByRole("link", { name: "查看後台用量 →" }),
  ).toHaveAttribute("href", "/admin/usage");
});

test("admins set the limits on the usage page", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/usage");
  const form = page.getByRole("region", { name: "AI 額度設定" });
  await expect(form.getByLabel("管理員手動（每天）")).toHaveValue("1");
  await expect(form.getByLabel("管理員批次（每天）")).toHaveValue("1");
  await expect(form.getByLabel("付費使用者（每天）")).toHaveValue("0.2");
  await expect(form.getByLabel("免費使用者（每天）")).toHaveValue("0.05");
  await expect(form.getByLabel("全站每月總上限")).toHaveValue("8");
  await form.getByLabel("免費使用者（每天）").fill("-1");
  await form.getByRole("button", { name: "儲存額度" }).click();
  await expect(form.getByRole("alert")).toContainText("0 到 100");
});
