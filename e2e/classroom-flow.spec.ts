import { expect, signInWithEmail, test } from "./fixtures";

/**
 * A class from both sides (D103, D179), on the stand-in's classroom
 * tables: a teacher on the class plan makes a class and assigns Sintel
 * for a week by default; a student joins with the code and sees one
 * clear next step; the teacher sees the student.
 */
test("a teacher makes a class and assigns a week; a student joins and starts", async ({
  page,
  browser,
}) => {
  const run = Math.random().toString(36).slice(2, 8);
  const teacher = `e2e-class-teacher-${run}`;
  const student = `e2e-class-student-${run}`;

  await signInWithEmail(page, teacher, `${teacher}@example.com`);
  await page.goto("/classroom");
  await page.getByLabel("建立新班級").fill("三年二班 英聽");
  await page.getByRole("button", { name: "建立", exact: true }).click();
  await page
    .getByRole("link", { name: /三年二班 英聽/ })
    .first()
    .click();
  const code =
    /\b([A-HJ-NP-Z2-9]{8})\b/.exec(
      await page.locator("main").innerText(),
    )?.[1] ?? "";
  expect(code).toHaveLength(8);

  // A week by default: due six days after the start (D179).
  const start = await page.getByLabel("開始日期").inputValue();
  const due = await page.getByLabel("截止日期").inputValue();
  expect((Date.parse(due) - Date.parse(start)) / 86_400_000).toBe(6);
  await page.getByLabel("教材").selectOption({ label: "Sintel" });
  await page.getByRole("button", { name: "指派", exact: true }).click();
  await expect(page.getByText("還沒有作業。")).toHaveCount(0);

  const other = await browser.newContext({ locale: "zh-TW" });
  const kid = await other.newPage();
  await signInWithEmail(kid, student, `${student}@example.com`);
  await kid.goto("/classroom");
  await kid.getByLabel("邀請碼（8 碼）").fill(code);
  await kid.getByLabel("在班上的稱呼").fill("01 王小明");
  await kid.getByText("我未滿 18 歲，已經取得家長或法定代理人同意").click();
  await kid.getByRole("button", { name: "加入", exact: true }).click();
  await expect(kid.getByRole("heading", { name: "作業" })).toBeVisible();
  const startLink = kid.getByRole("link", { name: "開始第 1 天 →" });
  await expect(startLink).toHaveAttribute("href", "/videos/sintel/day/1");
  await other.close();

  await page.reload();
  await expect(page.getByText("01 王小明").first()).toBeVisible();
});
