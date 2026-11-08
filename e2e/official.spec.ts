import { expect, signInAsAdmin, signInAsAuthor, test } from "./fixtures";

/** Official materials (D80): their own admin page, apart from My materials. */
test("admins manage official materials from the header", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "主要導覽" })
    .getByRole("link", { name: "官方教材" })
    .click();
  await expect(page).toHaveURL("/admin/official");
  await expect(
    page.getByRole("heading", { name: "官方教材", level: 1 }),
  ).toBeVisible();
  const published = page.getByRole("region", { name: /已發布（1）/ });
  await expect(published).toContainText("E2E official practice");
  await expect(published).toContainText("在機場報到的簡短對話。");
  // Its notes aren't on the current version: offered for regenerating.
  await expect(
    page.getByRole("checkbox", { name: "E2E official practice" }),
  ).toBeChecked();
  await expect(
    page.getByRole("link", { name: "＋ 建立新官方教材" }),
  ).toHaveAttribute("href", "/materials/new?official=1");
});

test("the official page is for admins only, and not in the header for others", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await page.goto("/");
  await expect(
    page
      .getByRole("navigation", { name: "主要導覽" })
      .getByRole("link", { name: "官方教材" }),
  ).toHaveCount(0);
  const response = await page.goto("/admin/official");
  expect(response?.status()).toBe(404);
});

test("creating a new official material says so", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/materials/new?official=1");
  await expect(
    page.getByRole("heading", { name: "建立新官方教材" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /官方教材/ }).first(),
  ).toHaveAttribute("href", "/admin/official");
});
