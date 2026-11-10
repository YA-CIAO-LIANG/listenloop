import mock from "./mock-supabase/practices.json";
import { expect, test } from "./fixtures";

/** Topic landing pages (D116): public, from the footer. */
test("a topic page lists its official materials", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "網站資訊" })
    .getByRole("link", { name: "依主題練習" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "依主題練英文聽力" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /旅遊英文英文聽力練習/ }).click();
  await expect(page).toHaveURL(/\/learn\/travel$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "旅遊英文英文聽力練習" }),
  ).toBeVisible();
  // Other tests may publish more official practices into the shared
  // stand-in database while this one runs; the first is enough.
  await expect(page.getByText("官方測試練習").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "從第一份開始" }),
  ).toHaveAttribute("href", `/videos/p-${mock.official.id}`);
  // Search engines may index official materials' pages.
  await page.goto(`/videos/p-${mock.official.id}`);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test("unknown topics are a 404, and topics are in the sitemap", async ({
  page,
  request,
}) => {
  expect((await page.goto("/learn/other"))?.status()).toBe(404);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/learn/study-abroad");
});
