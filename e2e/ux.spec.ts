import { expect, signInAsAuthor, test } from "./fixtures";

/** First visit, errors, and keyboard basics (D61). */
test("a first visit shows the seven-day guide, which can be skipped", async ({
  page,
}) => {
  // Signed out, the home page's intro explains the loop instead (D70).
  await signInAsAuthor(page);
  await page.goto("/");
  const guide = page.getByRole("region", { name: "第一次來？這樣練" });
  await expect(guide).toBeVisible();
  await expect(
    guide.getByRole("link", { name: /從推薦的第一份開始/ }),
  ).toHaveAttribute("href", /^\/videos\//);
  await guide.getByRole("button", { name: "略過" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(guide).toHaveCount(0);
});

test("an unknown address shows the 404 page in the interface language", async ({
  page,
}) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "找不到這一頁" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /回首頁/ }).click();
  await expect(page).toHaveURL("/");
});

test("the first Tab offers to skip to the main content", async ({ page }) => {
  await page.goto("/terms");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "跳到主要內容" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("robots.txt keeps personal pages out, and the sitemap lists videos", async ({
  request,
}) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Disallow: /account");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/videos/sintel");
  expect(sitemap).toContain("/terms");
});
