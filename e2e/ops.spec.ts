import {
  expect,
  signInAsAdmin,
  signInAsAuthor,
  signInAsLearner,
  test,
} from "./fixtures";

/**
 * Emergency switches and announcements (D155). They change the whole
 * site, so this file runs on its own after every other test (the "ops"
 * project in playwright.config.ts), one test at a time, and puts the
 * stand-in back afterwards.
 */
test.describe.configure({ mode: "serial" });

const MOCK = "http://localhost:54329";

async function setSwitches(body: Record<string, unknown>) {
  const response = await fetch(`${MOCK}/rest/v1/site_settings?id=eq.true`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer e2e-secret-key",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
}

test.afterEach(async () => {
  await fetch(`${MOCK}/__reset-ops`);
});

test("an admin turns on maintenance; learners see the maintenance page, the admin doesn't", async ({
  page,
  browser,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/ops");
  await expect(page.getByRole("heading", { name: "服務控制" })).toBeVisible();
  await page.getByRole("group", { name: "維護模式" }).getByText("開啟").click();
  await page.getByRole("button", { name: "儲存開關" }).click();
  await page.getByRole("button", { name: "確定變更" }).click();
  await expect(page.getByRole("status")).toContainText("已儲存");

  // The admin goes on as usual.
  await page.goto("/materials");
  await expect(page.getByRole("heading", { name: "網站維護中" })).toHaveCount(
    0,
  );

  // Everyone else sees the maintenance page, with a 503.
  const visitor = await browser.newPage();
  const response = await visitor.goto("/explore");
  expect(response?.status()).toBe(503);
  await expect(
    visitor.getByRole("heading", { name: "網站維護中" }),
  ).toBeVisible();
  // The status page stays open.
  await visitor.goto("/status");
  await expect(visitor.getByRole("status")).toHaveText("網站維護中");
  await visitor.close();
});

test("read-only mode pauses creating, and says so", async ({ page }) => {
  await setSwitches({ read_only: true });
  await signInAsAuthor(page);
  await page.goto("/materials/new");
  await expect(
    page.getByRole("heading", { name: "建立教材暫停中" }),
  ).toBeVisible();
  // Practice pages still open.
  await page.goto("/explore");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("pausing AI generation hides it on the create page", async ({ page }) => {
  await setSwitches({ features: { aiGenerate: false } });
  // The learner hasn't used the free week yet, so the form shows.
  await signInAsLearner(page);
  await page.goto("/materials/new");
  await expect(page.getByText(/以下功能暫停中：AI 生成文字/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "AI 生成" })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "貼上或上傳文字" })).toHaveCount(
    1,
  );
});

test("an announcement shows on every page and on the status page", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/ops");
  await page.getByLabel("中文內容").fill("今晚 23:00 維護 30 分鐘");
  await page.getByLabel("英文內容").fill("Maintenance tonight at 23:00");
  await page.getByRole("button", { name: "發布公告" }).click();
  await expect(page.getByRole("status")).toContainText("已儲存");

  await page.goto("/");
  const banner = page.getByRole("region", { name: "網站公告" });
  await expect(banner).toContainText("今晚 23:00 維護 30 分鐘");
  await page.goto("/status");
  await expect(page.getByText("今晚 23:00 維護 30 分鐘").first()).toBeVisible();
  // Dismissed on this device.
  await page.goto("/");
  await banner.getByRole("button", { name: "關閉公告" }).click();
  await page.reload();
  await expect(banner).toHaveCount(0);
});

test("the health check answers without details; the cron routes are closed without a secret", async ({
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  const body = await health.json();
  expect(Object.keys(body).sort()).toEqual(["checks", "status"]);
  expect(body.status).toBe("ok");
  expect(Object.keys(body.checks).sort()).toEqual([
    "ai",
    "config",
    "db",
    "speech",
    "storage",
  ]);
  // CRON_SECRET isn't set in the E2E build: the routes don't exist.
  expect((await request.post("/api/cron/monitor")).status()).toBe(404);
  expect((await request.post("/api/cron/weekly")).status()).toBe(404);
});

test("the admin sees the forecasts and the monitor", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/usage");
  await expect(
    page.getByRole("heading", { name: "預測與每週摘要" }),
  ).toBeVisible();
  await expect(page.getByText("Azure 學生額度用完日")).toBeVisible();
  await page.goto("/admin/ops");
  await expect(page.getByRole("heading", { name: "監控" })).toBeVisible();
  await expect(page.getByText("沒有通知。")).toBeVisible();
});

test("risky admin actions need a sign-in within 30 minutes", async ({
  page,
}) => {
  await signInAsAdmin(page, { signedInMinutesAgo: 45 });
  await page.goto("/admin/ops");
  await page.getByRole("group", { name: "唯讀模式" }).getByText("開啟").click();
  await page.getByRole("button", { name: "儲存開關" }).click();
  await page.getByRole("button", { name: "確定變更" }).click();
  await expect(page.getByText(/30 分鐘內登入過/)).toBeVisible();
  // Nothing changed.
  await page.goto("/status");
  await expect(page.getByRole("status").first()).toHaveText("所有服務正常運作");
  // The sign-in page explains, even while signed in.
  await page.goto("/login?reauth=1&next=/admin/ops");
  await expect(page.getByText(/請再登入一次/)).toBeVisible();
});
