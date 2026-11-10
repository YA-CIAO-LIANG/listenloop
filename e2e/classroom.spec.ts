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

test("the class plan: NT$4,990 a year, NT$3,490 on the priority list, a fake door (D105)", async ({
  page,
}) => {
  await page.goto("/pricing/classroom");
  await expect(
    page.getByRole("heading", { level: 1, name: "班級方案" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "年繳 · 省 2 個月" }),
  ).toBeChecked();
  const plan = page.getByRole("region", { name: "班級版" });
  // A month's price is the big number; the yearly total under it (D128).
  await expect(plan.getByText("NT$416", { exact: true })).toHaveClass(
    /text-h2/,
  );
  await expect(
    plan.getByText("年繳 NT$4,990，一次付清，省 2 個月"),
  ).toBeVisible();
  await expect(plan.getByText("NT$291", { exact: true })).toBeVisible();
  await expect(plan.getByText(/年繳 NT\$3,490，一次付清/)).toBeVisible();
  await expect(page.locator("main")).not.toContainText("%");
  await page.getByText("月繳", { exact: true }).click();
  await expect(plan.getByText("NT$499", { exact: true })).toBeVisible();
  await expect(plan.getByText("NT$349", { exact: true })).toBeVisible();
  await plan.getByRole("button", { name: "訂閱" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "班級方案 · 月繳" })
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
