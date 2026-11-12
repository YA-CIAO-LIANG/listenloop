import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  setToday,
  signInAsAuthor,
  signInAsStudent,
  test,
} from "./fixtures";

/**
 * The student plan (D144): Plus at NT$90 a month or NT$990 a year, for a
 * school Google account. Subscribing is a fake door like Plus's.
 */
const studentCard = (page: import("@playwright/test").Page) =>
  page.getByRole("listitem").filter({ hasText: "訂閱 學生方案" });

test("visitors see the student price and how to be verified", async ({
  page,
}) => {
  await page.goto("/pricing");
  const card = studentCard(page);
  // Yearly first: NT$990 a year, about NT$83 a month, one month saved.
  await expect(card).toContainText("NT$83／月");
  await expect(card).toContainText("年繳 NT$990，一次付清，省 1 個月");
  await expect(card.getByTestId("student-status")).toContainText(
    "學校信箱（例如 .edu、.edu.tw）的 Google 帳號登入",
  );
  await page.getByText("月繳", { exact: true }).click();
  await expect(card.getByText("NT$90", { exact: true })).toBeVisible();
  // The comparison table has a student column, the same as Plus.
  await expect(
    page.getByRole("table", { name: "方案比較" }).getByRole("columnheader", {
      name: "學生方案",
    }),
  ).toBeVisible();

  // Not verified: subscribing asks for a school sign-in.
  await card.getByRole("button", { name: "訂閱 學生方案" }).click();
  const dialog = page.getByRole("dialog", { name: "學生方案 · 月繳" });
  await expect(dialog).toContainText("請先用學校信箱的 Google 帳號登入");
  await expect(
    dialog.getByRole("link", { name: "用學校帳號登入" }),
  ).toHaveAttribute("href", /plan%3Dstudent%26period%3Dmonth/);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("a personal Google account is told the plan needs a school one", async ({
  page,
}) => {
  await signInAsAuthor(page);
  await page.goto("/pricing");
  await expect(studentCard(page).getByTestId("student-status")).toContainText(
    "你目前登入的不是學校信箱",
  );
});

test("a school account is verified for a year and can join the list", async ({
  page,
}) => {
  await setToday(page, "2026-11-12");
  await signInAsStudent(page);
  await page.goto("/pricing");
  const card = studentCard(page);
  await expect(card.getByTestId("student-status")).toContainText(
    /已認證學生身分，有效到 2027\/11\/1[12]/,
  );
  await card.getByRole("button", { name: "訂閱 學生方案" }).click();
  const dialog = page.getByRole("dialog", { name: "學生方案 · 年繳" });
  await expect(dialog.getByText(/付費方案即將推出/)).toBeVisible();
  await dialog.getByRole("button", { name: "加入名單" }).click();
  await expect(dialog.getByRole("status")).toContainText("已加入名單");
});
