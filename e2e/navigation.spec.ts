import { expect, signInAsAuthor, test } from "./fixtures";

/**
 * The header's entries (D48): "My materials" once signed in, on phones
 * too; "+ Create a practice" only for admins who can create (the E2E
 * author isn't an admin).
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
    await expect(page.getByRole("link", { name: /建立練習/ })).toHaveCount(0);
    await nav.getByRole("link", { name: "我的教材" }).click();

    await expect(
      page.getByRole("heading", { name: "建立練習還沒開放" }),
    ).toBeVisible();
  });
}

test("signed out, the header has no My materials", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主要導覽" });
  await expect(nav.getByRole("link", { name: "學習進度" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "我的教材" })).toHaveCount(0);
});
