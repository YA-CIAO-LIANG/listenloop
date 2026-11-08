import { expect, signInAsAdmin, signInAsBuyer, test } from "./fixtures";

/**
 * Payments with the fake provider (D85): no money, no network. The fake
 * checkout's webhooks are signed and go through the real handler.
 */
test("signed out, the pricing page shows both plans and the test notice", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "方案與價格" })).toBeVisible();
  await expect(page.getByText("測試模式：付款只是模擬")).toBeVisible();
  // Yearly first, then monthly.
  await expect(page.getByText("NT$1,490 / 年")).toBeVisible();
  await page.getByText("月繳", { exact: true }).click();
  await expect(page.getByText("NT$149 / 月")).toBeVisible();
  await expect(page.getByText("登入後就能訂閱")).toBeVisible();
  await page.getByRole("link", { name: "退款政策" }).first().click();
  await expect(page.getByRole("heading", { name: "退款政策" })).toBeVisible();
});

test("subscribe, cancel renewal, renew again; then an admin refunds", async ({
  page,
  browser,
}) => {
  await signInAsBuyer(page);
  await page.goto("/pricing");
  await page.getByText("月繳", { exact: true }).click();
  await page.getByRole("button", { name: "訂閱" }).click();

  await expect(page.getByRole("heading", { name: "測試結帳" })).toBeVisible();
  await expect(page.getByText("金額：NT$149")).toBeVisible();
  await page.getByRole("button", { name: "模擬付款成功" }).click();

  await expect(page.getByRole("heading", { name: "付款完成" })).toBeVisible();
  await expect(page.getByText("付費方案已經開通")).toBeVisible();

  await page.getByRole("link", { name: "查看訂閱" }).click();
  const billing = page.locator("#billing");
  await expect(billing.getByText(/^付費.*月繳/)).toBeVisible();
  await expect(billing.getByText(/下次扣款日/)).toBeVisible();
  await expect(billing.getByRole("cell", { name: /NT\$149/ })).toBeVisible();

  await billing.getByRole("button", { name: "取消續訂" }).click();
  await expect(billing.getByText(/已取消續訂，付費方案用到/)).toBeVisible();
  await billing.getByRole("button", { name: "恢復續訂" }).click();
  await expect(billing.getByText(/下次扣款日/)).toBeVisible();

  // The admin sees the test subscription and refunds the payment.
  const adminPage = await (await browser.newContext()).newPage();
  await signInAsAdmin(adminPage);
  await adminPage.goto("/admin/revenue");
  await expect(
    adminPage.getByRole("heading", { name: "營收", exact: true }),
  ).toBeVisible();
  await expect(
    adminPage.getByText("測試", { exact: true }).first(),
  ).toBeVisible();
  await adminPage.getByRole("button", { name: "退款…" }).first().click();
  await adminPage.getByRole("button", { name: /確定退款/ }).click();
  await expect(adminPage.getByText("已退款").first()).toBeVisible();

  await page.reload();
  await expect(
    billing.getByRole("cell", { name: "已退款 · 測試" }),
  ).toBeVisible();
});

test("a failed payment charges nothing and says so", async ({ page }) => {
  await signInAsBuyer(page, "e2e-buyer-failed");
  await page.goto("/checkout/fake?interval=year");
  await page.getByRole("button", { name: "模擬付款失敗" }).click();
  await expect(
    page.getByRole("heading", { name: "付款沒有完成" }),
  ).toBeVisible();
  await page.goto("/account");
  await expect(
    page.locator("#billing").getByText("還沒有付款紀錄。"),
  ).toBeVisible();
});

test("the webhook refuses requests without our signature", async ({
  request,
}) => {
  const event = {
    id: "evt_forged",
    occurredAt: new Date().toISOString(),
    test: true,
    type: "subscription.updated",
    userId: "e2e-buyer-forged",
    subscriptionId: "sub_forged",
    status: "active",
    interval: "year",
    periodEnd: "2030-01-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
  };
  const unsigned = await request.post("/payments/webhook", { data: event });
  expect(unsigned.status()).toBe(400);
  const forged = await request.post("/payments/webhook", {
    data: event,
    headers: {
      "x-listenloop-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`,
    },
  });
  expect(forged.status()).toBe(400);
});

test("admins download the waiting list as CSV; others get a 404", async ({
  page,
  request,
}) => {
  expect((await request.get("/admin/waitlist/export")).status()).toBe(404);
  await signInAsAdmin(page);
  const response = await page.request.get("/admin/waitlist/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(await response.text()).toMatch(/^account,email,joined_at\n/);
});
