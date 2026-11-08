import { expect, signInAsLearner, test } from "./fixtures";

test("a student's classes page: join with a code; teachers see the class plans (D103)", async ({
  page,
}) => {
  await signInAsLearner(page);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "主要導覽" })
    .getByRole("link", { name: "班級" })
    .click();
  await expect(
    page.getByRole("heading", { name: "我的班級", level: 1 }),
  ).toBeVisible();
  const join = page.getByRole("button", { name: "加入", exact: true });
  await expect(join).toBeDisabled();
  await page.getByLabel("邀請碼（8 碼）").fill("abcd2345");
  await expect(page.getByLabel("邀請碼（8 碼）")).toHaveValue("ABCD2345");
  await page.getByLabel("在班上的稱呼").fill("01 王小明");
  await page.getByText("我未滿 18 歲，已經取得家長或法定代理人同意").click();
  await expect(join).toBeEnabled();
  // Without a class plan, teachers see the class plans instead.
  await expect(page.getByRole("link", { name: /看班級方案/ })).toHaveAttribute(
    "href",
    "/pricing/classroom?from=classroom",
  );
});

test("class plans: yearly first, 9 months' price, subscribing is a fake door (D103)", async ({
  page,
}) => {
  await page.goto("/pricing/classroom");
  await expect(page.getByRole("heading", { name: "班級方案" })).toBeVisible();
  await expect(
    page.getByText(/12 個月只付 9 個月的價格，省 25%/),
  ).toBeVisible();
  const ten = page.getByRole("row", { name: /^10 人/ });
  await expect(ten.getByText("NT$5,310")).toBeVisible();
  await page.getByText("兩年 · 最划算").click();
  await expect(ten.getByText("NT$9,440")).toBeVisible();
  await ten.getByRole("button", { name: "訂閱" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "10 人班級 · 兩年" })
      .getByText(/現在不會收費/),
  ).toBeVisible();
});

test("an invite link asks to sign in first (D103)", async ({ page }) => {
  await page.goto("/classroom/join/ABCD2345");
  await expect(page.getByRole("link", { name: "登入" }).last()).toHaveAttribute(
    "href",
    "/login?next=%2Fclassroom%2Fjoin%2FABCD2345",
  );
});
