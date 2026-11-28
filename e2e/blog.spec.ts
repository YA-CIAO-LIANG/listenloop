import { BLOG_POSTS } from "../lib/blog";
import { expect, test } from "./fixtures";

/** Articles (D122): public, from the footer, each with practice below. */
test("anyone reads an article and finds lessons to practice", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "網站資訊" })
    .getByRole("link", { name: "學習文章" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "英文聽力學習文章" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(BLOG_POSTS.length);

  await page
    .getByRole("link", { name: "多益聽力怎麼練？卡在 350 分的一週練法" })
    .click();
  await expect(page).toHaveURL(/\/blog\/toeic-listening$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /多益聽力怎麼練/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "為什麼刷題分數不動" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "用這些教材練習" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "更多「考試英文」教材" }),
  ).toHaveAttribute("href", "/learn/exam");
  // Search engines see the article's own title and summary.
  await expect(page).toHaveTitle(/多益聽力怎麼練/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/blog\/toeic-listening$/,
  );
});

test("an unknown article is a 404", async ({ page }) => {
  expect((await page.goto("/blog/no-such-article"))?.status()).toBe(404);
});
