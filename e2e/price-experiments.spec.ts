import AxeBuilder from "@axe-core/playwright";
import { expect, signInAsAdmin, test } from "./fixtures";

/**
 * Price experiments and the price survey (D174). They change the prices
 * everyone sees, so this file runs on its own after the others (the
 * "prices" project in playwright.config.ts), one test at a time.
 */
test.describe.configure({ mode: "serial" });

/** Plus all-in-one yearly's monthly average (D210), and a few others. */
const AVERAGES = ["NT$224", "NT$124", "NT$166", "NT$208"];

const plusCard = (page: import("@playwright/test").Page) =>
  page.getByRole("listitem").filter({ hasText: "訂閱 Plus・聽寫全方位" });

async function plusAverage(page: import("@playwright/test").Page) {
  const card = plusCard(page);
  for (const price of AVERAGES) {
    if (await card.getByText(price, { exact: true }).count()) return price;
  }
  return null;
}

test("the visitor id cookie is HttpOnly, SameSite=Lax, and lasts 180 days", async ({
  page,
}) => {
  await page.goto("/pricing");
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "ll-visitor",
  );
  expect(cookie).toBeDefined();
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.sameSite).toBe("Lax");
  const days = (cookie!.expires * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(179);
  expect(days).toBeLessThanOrEqual(180);
  // No script on the page can read it.
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "ll-visitor",
  );
});

test("a trailing slash redirects with a Content-Type (ZAP 10019)", async ({
  request,
}) => {
  const response = await request.get("/r/", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(new URL(response.headers().location, "http://x").pathname).toBe("/r");
  expect(response.headers()["content-type"]).toMatch(/^text\/plain/);
  const kept = await request.get("/videos/?level=beginner", {
    maxRedirects: 0,
  });
  const target = new URL(kept.headers().location, "http://x");
  expect(`${target.pathname}${target.search}`).toBe("/videos?level=beginner");
});

test("price experiments are paused: nothing to start, everyone sees the code's prices (D210)", async ({
  page,
  browser,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/price-experiments");
  await expect(
    page.getByRole("status").filter({ hasText: "價格實驗已暫停" }),
  ).toBeVisible();
  await expect(page.getByText("目前沒有進行中的實驗")).toBeVisible();
  await expect(page.getByRole("button", { name: "開始實驗" })).toHaveCount(0);
  // Every line's price, from the code.
  await expect(
    page.getByText("Plus・聽寫全方位", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("學生・聽力", { exact: true })).toBeVisible();

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto("/pricing");
  expect(await plusAverage(visitorPage)).toBe("NT$224");
  await visitor.close();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("the price survey: after 30 s on the pricing page, once, skippable", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/pricing");
  const survey = page.getByRole("region", { name: /Plus・聽寫全方位值多少錢/ });
  await expect(survey).toHaveCount(0);
  await page.clock.runFor(31_000);
  await expect(survey).toBeVisible();
  // Out of order: it says which order it expects.
  await survey.getByLabel(/太貴，根本不考慮/).fill("100");
  await survey.getByLabel(/有點貴/).fill("200");
  await survey.getByLabel(/很划算/).fill("90");
  await survey.getByLabel(/懷疑品質/).fill("30");
  await survey.getByRole("button", { name: "送出" }).click();
  await expect(survey.getByRole("alert")).toContainText("遞減");
  await survey.getByLabel(/太貴，根本不考慮/).fill("400");
  await survey.getByRole("button", { name: "送出" }).click();
  await expect(page.getByText("謝謝你！")).toBeVisible();
  // Never asked again on this device.
  await page.reload();
  await page.clock.runFor(31_000);
  await expect(survey).toHaveCount(0);

  // The admin sees the answer in the curves' figures.
  await signInAsAdmin(page);
  await page.goto("/admin/price-experiments");
  await expect(
    page.getByRole("heading", { name: /價格敏感度問卷/ }),
  ).toBeVisible();
  await expect(page.getByText("至少 30 份才值得參考")).toBeVisible();
});
