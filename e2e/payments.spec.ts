import { expect, signInAsAdmin, signInAsBuyer, test } from "./fixtures";

/**
 * Payments with the fake provider (D85): no money, no network. The fake
 * checkout's webhooks are signed and go through the real handler.
 */
test("signed out, pricing shows Free, Plus, and Pro, yearly first at ten months (D102, D105)", async ({
  page,
}) => {
  await page.goto("/pricing?from=stats");
  await expect(page.getByRole("heading", { name: "方案與價格" })).toBeVisible();
  const plus = page.getByRole("listitem").filter({ hasText: "訂閱 Plus" });
  // Yearly is the default: 10 × monthly, no percentages (D105). The big
  // number is always a month's price; the yearly total is under it (D128).
  await expect(
    page.getByRole("radio", { name: "年繳 · 省 2 個月" }),
  ).toBeChecked();
  await expect(plus.getByText("NT$124", { exact: true })).toHaveClass(
    /text-h2/,
  );
  await expect(
    plus.getByText("年繳 NT$1,490，一次付清，省 2 個月"),
  ).toBeVisible();
  // Plus is marked the most popular (D173), and only Plus.
  await expect(plus.getByText("最受歡迎", { exact: true })).toBeVisible();
  await expect(page.getByText("最受歡迎", { exact: true })).toHaveCount(1);
  const pro = page.getByRole("listitem").filter({ hasText: "訂閱 Pro" });
  await expect(pro.getByText("NT$266", { exact: true })).toHaveClass(/text-h2/);
  await expect(pro.getByText(/年繳 NT\$3,190，一次付清/)).toBeVisible();
  // The comparison table has the same prices a month.
  await expect(
    page.getByRole("table", { name: "方案比較" }).getByRole("row", {
      name: /^價格 NT\$0／月 NT\$124／月.*NT\$1,490.*NT\$266／月/,
    }),
  ).toBeVisible();
  await expect(page.getByText("兩年")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("%");
  await page.getByText("月繳", { exact: true }).click();
  await expect(plus.getByText("NT$149", { exact: true })).toHaveClass(
    /text-h2/,
  );
  await expect(plus.getByText(/一次付清/)).toHaveCount(0);
  await expect(
    page.getByRole("table", { name: "方案比較" }).getByRole("row", {
      name: /單份最長 2 分鐘 5 分鐘 10 分鐘/,
    }),
  ).toBeVisible();

  // Subscribing is a fake door: coming soon, join the list after signing in.
  await plus.getByRole("button", { name: "訂閱 Plus" }).click();
  const dialog = page.getByRole("dialog", { name: "Plus · 月繳" });
  await expect(dialog.getByText(/付費方案即將推出/)).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "登入後加入名單" }),
  ).toHaveAttribute("href", /plan%3Dplus%26period%3Dmonth%26from%3Dstats/);
});

test("signed in, the fake door joins the waiting list with the plan and period (D102)", async ({
  page,
}) => {
  await signInAsBuyer(page, "e2e-waitlist");
  await page.goto("/pricing?plan=pro&period=year&from=youtube");
  const dialog = page.getByRole("dialog", { name: "Pro · 年繳" });
  await dialog.getByRole("button", { name: "加入名單" }).click();
  await expect(dialog.getByText("已加入名單")).toBeVisible();
});

test("subscribe, cancel renewal, renew again; then an admin refunds", async ({
  page,
  browser,
}) => {
  await signInAsBuyer(page);
  // Paid plans are a fake door on /pricing (D102); the provider's flow
  // (D85) is still there for when payments open.
  await page.goto("/checkout/fake?interval=month");

  await expect(page.getByRole("heading", { name: "測試結帳" })).toBeVisible();
  await expect(page.getByText("NT$149", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "模擬付款成功" }).click();

  await expect(page.getByRole("heading", { name: "付款完成" })).toBeVisible();
  await expect(page.getByText("付費方案已經開通")).toBeVisible();

  await page.getByRole("link", { name: "查看訂閱" }).click();
  const billing = page.locator("#billing");
  await expect(billing.getByText(/^Plus.*月繳/)).toBeVisible();
  await expect(billing.getByText(/下次扣款日/)).toBeVisible();
  await expect(billing.getByText("NT$149／月")).toBeVisible();
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
