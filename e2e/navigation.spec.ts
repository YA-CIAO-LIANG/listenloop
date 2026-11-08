import { expect, signInAsAdmin, signInAsAuthor, test } from "./fixtures";

/**
 * The header's entries (D48): "My materials" and "+ Create a practice"
 * once signed in, on phones too (every plan creates since D72; the E2E
 * author has used the free trial, so the paid plan shows instead).
 */
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 360, height: 740 },
]) {
  test(`signed in, My materials is in the header at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signInAsAuthor(page);
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "主要導覽" });
    await expect(nav.getByRole("link", { name: "筆記本" })).toHaveCount(0);
    await nav.getByRole("link", { name: "我的教材" }).click();
    await expect(page).toHaveURL(/\/materials$/);
    await page
      .getByRole("link", { name: /建立練習/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Plus 方案" })).toBeVisible();
  });
}

test("signed out, the header has no My materials", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主要導覽" });
  await expect(nav.getByRole("link", { name: "學習進度" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "我的教材" })).toHaveCount(0);
});

test("the admin dashboard is a 404 for a regular account (D56)", async ({
  page,
}) => {
  await signInAsAuthor(page);
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("navigation", { name: "主要導覽" }).getByRole("link", {
      name: "後台",
    }),
  ).toHaveCount(0);
});

test("an admin opens every dashboard section (D56)", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "主要導覽" })
    .getByRole("link", { name: "後台" })
    .click();
  await expect(page.getByRole("heading", { name: "後台總覽" })).toBeVisible();
  const sections = page.getByRole("navigation", { name: "後台導覽" });
  for (const [link, heading] of [
    ["使用者", "使用者"],
    ["官方教材", "官方教材"],
    ["公開教材", "公開教材"],
    ["容易出錯的句子", "容易出錯的句子"],
    ["操作紀錄", "操作紀錄"],
    ["意見回饋", "意見回饋"],
    ["錯誤紀錄", "錯誤紀錄"],
    ["管理稽核", "管理稽核"],
    ["API 用量", "API 用量"],
  ]) {
    await sections.getByRole("link", { name: link }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await expect(sections.getByRole("link", { name: link })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});
