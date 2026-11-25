import { expect, test, signInWithEmail } from "./fixtures";
// Beta (D212): a problem report from the account menu, from any page,
// carries the page it came from.
test("menu → report a problem shows the form with the page", async ({
  page,
}) => {
  await signInWithEmail(page, "ux-menu-1", "ux-menu-1@example.com");
  await page.goto("/writing");
  await page.getByRole("button", { name: /帳號/ }).first().click();
  await page.getByRole("link", { name: "回報問題" }).click();
  await expect(page).toHaveURL(/\/feedback\?from=%2Fwriting/);
  await expect(page.getByRole("textbox")).toBeVisible();
});
