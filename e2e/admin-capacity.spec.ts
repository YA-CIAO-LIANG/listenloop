import { expect, signInAsAdmin, test } from "./fixtures";

/**
 * Vercel Functions Storage on the admin overview (D175): without a
 * Vercel token (as here) the tile says it isn't set up and how to.
 */
test("the overview shows Vercel functions storage as not set up", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin");
  const capacity = page.getByRole("region", { name: "容量與免費額度" });
  await expect(capacity.getByText("Vercel 函式儲存空間")).toBeVisible();
  await expect(capacity.getByText("未設定", { exact: true })).toBeVisible();
  await expect(capacity.getByText(/VERCEL_API_TOKEN/)).toBeVisible();
  await expect(
    capacity.getByRole("link", { name: "看 Vercel 後台的用量 →" }),
  ).toHaveAttribute("href", /vercel\.com/);
});
