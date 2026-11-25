import AxeBuilder from "@axe-core/playwright";
import { expect, signInAsAdmin, signInAsBuyer, test } from "./fixtures";

/**
 * Price experiments and the price survey (D174). They change the prices
 * everyone sees, so this file runs on its own after the others (the
 * "prices" project in playwright.config.ts), one test at a time.
 */
test.describe.configure({ mode: "serial" });

/** Plus yearly's monthly average for each price tried: 149, 199, 249. */
const AVERAGES = ["NT$124", "NT$166", "NT$208"];

const plusCard = (page: import("@playwright/test").Page) =>
  page.getByRole("listitem").filter({ hasText: "訂閱 Plus" });

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

test("an admin runs a Plus price experiment; each visitor keeps one price", async ({
  page,
  browser,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/price-experiments");
  await expect(
    page.getByRole("heading", { level: 1, name: "價格實驗" }),
  ).toBeVisible();
  await expect(page.getByText("目前沒有進行中的實驗")).toBeVisible();
  // The control is today's price; two more groups.
  await expect(page.getByLabel("對照組")).toHaveValue("149");
  // Under the floor (D185): Plus's 40 minutes and its AI writing
  // allowances (D207) need NT$124 a month.
  await page.getByLabel("第 2 組").fill("99");
  await page.getByLabel("第 3 組").fill("249");
  await page.getByRole("button", { name: "開始實驗" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "保本價 NT$124" }),
  ).toBeVisible();
  await page.getByLabel("第 2 組").fill("199");
  await page.getByRole("button", { name: "開始實驗" }).click();
  const table = page.getByRole("table", { name: "各組的轉換" });
  await expect(table).toBeVisible();
  await expect(
    table.getByRole("row", { name: /第 2 組 NT\$199/ }),
  ).toBeVisible();
  await expect(table).toContainText("人數還不夠");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  // A visitor sees one of the three prices, and the same one again.
  const visitor = await browser.newContext({ locale: "zh-TW" });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto("/pricing");
  const first = await plusAverage(visitorPage);
  expect(AVERAGES).toContain(first);
  await visitorPage.reload();
  expect(await plusAverage(visitorPage)).toBe(first);
  // Upgrade prompts follow the same price: the year is 10 × the month.
  await visitorPage.getByText("月繳", { exact: true }).click();
  await expect(plusCard(visitorPage)).toContainText(/NT\$(149|199|249)／月/);
  await visitor.close();

  // A signed-in account joins the list: counted in its group.
  const buyer = await browser.newContext({ locale: "zh-TW" });
  const buyerPage = await buyer.newPage();
  await signInAsBuyer(buyerPage, "e2e-price-buyer");
  await buyerPage.goto("/pricing");
  await plusCard(buyerPage).getByRole("button", { name: "訂閱 Plus" }).click();
  await buyerPage.getByRole("button", { name: "加入名單" }).click();
  await expect(buyerPage.getByText(/已加入名單/)).toBeVisible();
  await buyer.close();

  // One group now has a subscribe click and a join (the visitor may
  // share that group, so 50% or 100%).
  await page.reload();
  await expect(table).toContainText(/1 \((50|100)%\)/);
});

test("ending applies the chosen price to everyone, and it can be undone", async ({
  page,
  browser,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/price-experiments");
  await page.getByLabel("結束時套用").selectOption("b");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "結束實驗" }).click();
  await expect(page.getByText("目前沒有進行中的實驗")).toBeVisible();
  await expect(page.getByText(/實驗套用的價格/)).toBeVisible();
  await expect(page.getByText(/套用 NT\$199/)).toBeVisible();
  // Each past run says when it ran.
  await expect(
    page
      .getByRole("region", { name: "已結束的實驗" })
      .or(
        page.locator("section", {
          has: page.getByRole("heading", { name: "已結束的實驗" }),
        }),
      )
      .first(),
  ).toContainText(/\d{4}\/\d{1,2}\/\d{1,2}–\d{4}\/\d{1,2}\/\d{1,2}/);

  const visitor = await browser.newContext({ locale: "zh-TW" });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto("/pricing");
  await expect(
    plusCard(visitorPage).getByText("NT$166", { exact: true }),
  ).toBeVisible();
  await expect(plusCard(visitorPage)).toContainText("年繳 NT$1,990");

  // Back to the code's price.
  await page.getByRole("button", { name: "恢復預設" }).click();
  await expect(page.getByText(/實驗套用的價格/)).toHaveCount(0);
  await visitorPage.reload();
  await expect(
    plusCard(visitorPage).getByText("NT$124", { exact: true }),
  ).toBeVisible();
  await visitor.close();
});

test("the price survey: after 30 s on the pricing page, once, skippable", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/pricing");
  const survey = page.getByRole("region", { name: /Plus 值多少錢/ });
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
