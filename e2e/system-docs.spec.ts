import AxeBuilder from "@axe-core/playwright";
import { expect, signInAsAdmin, signInAsAuthor, test } from "./fixtures";

/** The system documents on the admin dashboard (D107). */
test("admins read the system documents in either language", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "後台導覽" })
    .getByRole("link", { name: "系統文件" })
    .click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "ListenLoop 系統說明書（技術）",
    }),
  ).toBeVisible();
  // The contents link to the headings on the page.
  await page
    .getByRole("article")
    .getByRole("link", { name: "資料模型", exact: true })
    .click();
  expect(decodeURIComponent(page.url())).toMatch(/#4-資料模型$/);
  await expect(page.locator('[id="4-資料模型"]')).toBeInViewport();

  const choose = page.getByRole("navigation", { name: "選擇文件" });
  await choose.getByRole("link", { name: "管理員手冊" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "ListenLoop 管理員手冊" }),
  ).toBeVisible();
  await choose.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/doc=admin&lang=en/);
  await expect(
    page.getByRole("heading", { level: 1, name: "ListenLoop Admin Manual" }),
  ).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});

test("the system documents are a 404 for everyone else", async ({ page }) => {
  await signInAsAuthor(page);
  const response = await page.goto("/admin/docs");
  expect(response?.status()).toBe(404);
});
