import { expect, signInAsAdmin, test } from "./fixtures";

/**
 * The revenue forecast (D102, D184, D210): tax inside the prices, ECPay's
 * fee, and the calibrated AI and voice costs, each editable; each plan's
 * cost at full and typical use against its cap.
 */
test("the forecast takes out tax and ECPay's fee, and recomputes", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/forecast");
  await expect(page.getByRole("heading", { name: "收益試算" })).toBeVisible();
  await expect(
    page.getByText(/每 150 字（約 1 分鐘）NT\$1\.024/),
  ).toBeVisible();
  const costs = page.getByRole("table", {
    name: "各方案的 AI 與語音成本（每人每月）",
  });
  await expect(
    costs.getByRole("row", { name: /^Plus・聽寫全方位/ }),
  ).toContainText("19%");
  await expect(costs.getByRole("row")).toHaveCount(19);
  const tiles = page.locator("dl > div");
  const revenue = tiles.nth(0);
  await expect(revenue.locator("dt")).toHaveText("月營收（含稅）");
  // 5% inside the default subscribers' revenue a month (D210 prices).
  await expect(revenue).toContainText(/含營業稅 NT\$[\d,]+/);
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
