import { expect, signInAsAdmin, test } from "./fixtures";

/**
 * The revenue forecast (D102, D184): tax inside the prices, ECPay's fee,
 * and paid voice in the AI cost, each editable.
 */
test("the forecast takes out tax and ECPay's fee, and recomputes", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/forecast");
  await expect(page.getByRole("heading", { name: "收益試算" })).toBeVisible();
  await expect(page.getByText(/加上聲音 NT\$1\.16/)).toBeVisible();
  const tiles = page.locator("dl > div");
  const revenue = tiles.nth(0);
  await expect(revenue.locator("dt")).toHaveText("月營收（含稅）");
  // 5% inside the default subscribers' NT$23,045 a month (D185 prices).
  await expect(revenue).toContainText("含營業稅 NT$1,097");
  const tax = page.getByLabel("營業稅（%，含在價格內）");
  const fee = page.getByLabel("金流手續費（%）");
  await expect(tax).toHaveValue("5");
  await expect(fee).toHaveValue("2.9");
  const net = tiles.nth(3).locator("dd").first();
  const before = await net.textContent();
  await tax.fill("0");
  await expect(revenue).toContainText("含營業稅 NT$0；");
  await expect(net).not.toHaveText(before ?? "");
});
