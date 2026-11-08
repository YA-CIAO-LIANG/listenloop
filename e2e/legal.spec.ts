import { expect, test } from "./fixtures";

/**
 * The public pages Google sign-in and Google Play review (D60): home,
 * terms, privacy, all reachable from every page's footer without
 * signing in.
 */
test("the footer reaches the terms, privacy policy, and feedback", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("navigation", { name: "網站資訊" });
  await footer.getByRole("link", { name: "服務條款" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "服務條款" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "11. 準據法" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "7. 付費方案與訂閱" }),
  ).toBeVisible();
  await footer.getByRole("link", { name: "退款政策" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "退款政策" }),
  ).toBeVisible();
  await footer.getByRole("link", { name: "隱私權政策" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "隱私權政策" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "未成年人" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "付款資料" })).toBeVisible();
  await footer.getByRole("link", { name: "意見回饋" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "意見回饋" }),
  ).toBeVisible();
});

test("the usage notice shows once, until dismissed", async ({ page }) => {
  await page.goto("/");
  const notice = page.getByRole("region", { name: "使用說明" });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "知道了" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(notice).toHaveCount(0);
});
