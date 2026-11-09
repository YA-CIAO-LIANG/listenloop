import { expect, signInAsAdmin, signInAsAuthor, test } from "./fixtures";

/** The retention page (D114): admins only. */
test("admins open the retention page from the dashboard", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "後台導覽" })
    .getByRole("link", { name: "留存分析" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "留存分析" }),
  ).toBeVisible();
  await expect(page.getByText("第 7 天留存")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "各類別的完成率" }),
  ).toBeVisible();
});

test("the retention page is a 404 for everyone else", async ({ page }) => {
  await signInAsAuthor(page);
  expect((await page.goto("/admin/retention"))?.status()).toBe(404);
});
