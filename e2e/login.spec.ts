import { expect, test } from "./fixtures";

test("the header's sign-in opens /login with Google and email (D101)", async ({
  page,
}) => {
  await page.goto("/pricing");
  await page.getByRole("link", { name: "登入" }).first().click();
  await expect(page).toHaveURL(/\/login\?next=%2Fpricing/);
  await expect(
    page.getByRole("heading", { name: "登入", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "用 Google 登入" }),
  ).toBeVisible();
  // LINE isn't set up in the E2E build.
  await expect(page.getByRole("link", { name: "用 LINE 登入" })).toHaveCount(0);

  await page.getByRole("button", { name: "還沒有帳號？建立一個" }).click();
  await page.getByLabel("密碼").fill("1234567890");
  await expect(page.getByText("太弱")).toBeVisible();
  await page.getByLabel("密碼").fill("my morning listening");
  await expect(page.getByText("很安全")).toBeVisible();

  await page.getByRole("button", { name: "忘記密碼？" }).click();
  await expect(page.getByLabel("密碼")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "寄重設連結" })).toBeVisible();
});

test("a reset link that has expired says so (D101)", async ({ page }) => {
  await page.goto("/login/reset");
  await expect(page.getByText("重設連結已失效或已用過")).toBeVisible();
});
