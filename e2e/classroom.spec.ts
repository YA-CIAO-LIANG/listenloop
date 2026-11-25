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

test("class plans: three tiers by class size, yearly by default, a fake door (D173)", async ({
  page,
}) => {
  await page.goto("/pricing/classroom");
  await expect(
    page.getByRole("heading", { level: 1, name: "班級方案" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "年繳 · 省 2 個月" }),
  ).toBeChecked();
  const tier = (name: string) =>
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { level: 2, name }) });
  // A month's price is the big number; the yearly total under it (D128).
  // All-in-one and yearly first (D210).
  await expect(tier("小班").getByText("NT$499", { exact: true })).toHaveClass(
    /text-h2/,
  );
  await expect(
    tier("小班").getByText("年繳 NT$5,990，一次付清，省 2 個月"),
  ).toBeVisible();
  await expect(tier("小班")).toContainText("每班最多 15 位學生");
  await expect(tier("小班")).toContainText("老師每月自建 6,750 字");
  await expect(tier("小班")).toContainText(
    "每位學生每週作文 AI 批改 2 篇、額外練習 AI 批改 7 組、聊天 15 則",
  );
  await expect(tier("標準班").getByText(/年繳 NT\$8,990/)).toBeVisible();
  await expect(tier("標準班")).toContainText("老師每月自建 10,500 字");
  await expect(tier("大班").getByText(/年繳 NT\$13,900/)).toBeVisible();
  await expect(tier("大班")).toContainText("每班最多 100 位學生");
  await expect(page.locator("main")).not.toContainText("優先名單");
  await expect(page.locator("main")).not.toContainText("%");
  await page.getByText("月繳", { exact: true }).click();
  await expect(tier("小班").getByText("NT$599", { exact: true })).toBeVisible();
  // Listening only: the teacher's words, no students' writing.
  await page
    .getByRole("group", { name: "方案", exact: true })
    .getByText("聽力", { exact: true })
    .click();
  await expect(tier("小班").getByText("NT$349", { exact: true })).toBeVisible();
  await expect(
    tier("標準班").getByText("NT$549", { exact: true }),
  ).toBeVisible();
  await expect(tier("大班").getByText("NT$800", { exact: true })).toBeVisible();
  await expect(tier("小班")).not.toContainText("每位學生每週");
  await tier("標準班").getByRole("button", { name: "訂閱標準班" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "標準班・聽力 · 月繳" })
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
