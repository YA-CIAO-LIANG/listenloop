import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  setToday,
  signInAsAuthor,
  signInAsStudent,
  test,
} from "./fixtures";

/**
 * The student plan (D144, D173): Plus at NT$90 a month or NT$900 a year, for a
 * school Google account. Subscribing is a fake door like Plus's.
 */
const studentCard = (page: import("@playwright/test").Page) =>
  page.getByRole("listitem").filter({ hasText: "訂閱 學生方案" });

test("visitors see the student price and how to be verified", async ({
  page,
}) => {
  await page.goto("/pricing");
  const card = studentCard(page);
  // Yearly first: NT$900 a year, NT$75 a month, two months saved (D173).
  await expect(card).toContainText("NT$75／月");
  await expect(card).toContainText("年繳 NT$900，一次付清，省 2 個月");
  // How to be verified, said before anyone tries (D173).
  await expect(card).toContainText("不用上傳學生證");
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
  // The mock verifies at the real time (not the page clock) and the page
  // shows Taipei's date: a year from today, give or take a day.
  const yearLater = [-1, 0, 1].map((days) => {
    const date = new Date(Date.now() + days * 86_400_000);
    date.setFullYear(date.getFullYear() + 1);
    return date
      .toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })
      .replaceAll("-", "/");
  });
  await expect(card.getByTestId("student-status")).toContainText(
    new RegExp(`已認證學生身分，有效到 (${yearLater.join("|")})`),
  );
  // Their plan comes first, marked for them (D179).
  await expect(card.getByText("適合你", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: /訂閱 / }).first(),
  ).toContainText("學生方案");
  await card.getByRole("button", { name: "訂閱 學生方案" }).click();
  const dialog = page.getByRole("dialog", { name: "學生方案 · 年繳" });
  await expect(dialog.getByText(/付費方案即將推出/)).toBeVisible();
  await dialog.getByRole("button", { name: "加入名單" }).click();
  await expect(dialog.getByRole("status")).toContainText("已加入名單");
});
