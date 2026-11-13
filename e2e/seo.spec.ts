import type { Page } from "@playwright/test";
import mock from "./mock-supabase/practices.json";
import { expect, test } from "./fixtures";

/** Every JSON-LD block on the page, parsed (each must be valid JSON). */
async function structuredData(page: Page) {
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  return blocks.map((text) => JSON.parse(text) as Record<string, unknown>);
}

/** Search engine metadata (D167). */
test("an official material has canonical, hreflang, a share image, and JSON-LD", async ({
  page,
  request,
}) => {
  const path = `/videos/p-${mock.official.id}`;
  await page.goto(path);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`${path}$`),
  );
  await expect(
    page.locator('link[rel="alternate"][hreflang="en"]'),
  ).toHaveAttribute("href", new RegExp(`${path}\\?hl=en$`));
  await expect(
    page.locator('link[rel="alternate"][hreflang="zh-Hant"]'),
  ).toHaveAttribute("href", new RegExp(`${path}$`));
  await expect(
    page.locator('link[rel="alternate"][hreflang="x-default"]'),
  ).toHaveAttribute("href", new RegExp(`${path}$`));
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /免費英文聽力練習/,
  );

  // The share image is this material's own, and it renders.
  const image = await page
    .locator('meta[property="og:image"]')
    .first()
    .getAttribute("content");
  expect(image).toContain(`${path}/opengraph-image`);
  await expect(page.locator('meta[name="twitter:image"]').first()).toHaveCount(
    1,
  );
  const png = await request.get(new URL(image!).pathname);
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");

  const data = await structuredData(page);
  const types = data.map((d) => d["@type"]);
  expect(types).toContain("LearningResource");
  expect(types).toContain("BreadcrumbList");
  const resource = data.find((d) => d["@type"] === "LearningResource")!;
  expect(resource["@context"]).toBe("https://schema.org");
  expect(resource.url).toMatch(new RegExp(`${path}$`));
});

test("?hl=en shows one request in English without changing the saved language", async ({
  page,
}) => {
  await page.goto("/faq?hl=en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { level: 1, name: "Frequently asked questions" }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/faq\?hl=en$/,
  );
  const faq = (await structuredData(page)).find(
    (d) => d["@type"] === "FAQPage",
  )!;
  // The data repeats exactly the questions on the page.
  const questions = await page.locator("dt").allTextContents();
  expect((faq.mainEntity as { name: string }[]).map((q) => q.name)).toEqual(
    questions,
  );

  // The saved choice (Chinese) still applies without ?hl=.
  await page.goto("/faq");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await expect(
    page.getByRole("heading", { level: 1, name: "常見問題" }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/faq$/,
  );
});

test("the FAQ is in the footer, and the home page describes the app", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/英文聽力練習/);
  const app = (await structuredData(page)).find(
    (d) => d["@type"] === "WebApplication",
  );
  expect(app).toMatchObject({ applicationCategory: "EducationalApplication" });
  await page
    .getByRole("navigation", { name: "網站資訊" })
    .getByRole("link", { name: "常見問題" })
    .click();
  await expect(page).toHaveURL(/\/faq$/);
  await expect(page.getByRole("heading", { name: "7 天循環" })).toBeVisible();
});

test("a topic page links to its articles and has breadcrumbs", async ({
  page,
}) => {
  await page.goto("/learn/exam");
  await expect(
    page.getByRole("link", { name: /雅思聽力怎麼準備/ }),
  ).toHaveAttribute("href", "/blog/ielts-listening");
  const types = (await structuredData(page)).map((d) => d["@type"]);
  expect(types).toContain("BreadcrumbList");
  await expect(
    page.locator('meta[property="og:image"]').first(),
  ).toHaveAttribute("content", /\/learn\/exam\/opengraph-image/);
});

test("robots.txt and the sitemap", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Disallow: /videos/*/day");
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/faq</loc>");
  expect(sitemap).toContain("/blog/gsat-listening</loc>");
  expect(sitemap).toContain('hreflang="en"');
  expect(sitemap).toContain("/faq?hl=en");
  expect(sitemap).not.toContain("/admin");
});
