import { expect, test } from "./fixtures";

/**
 * "Exam English" (D215): the first filter row in the listening library
 * and the writing prompts, its exams (GEPT by level), each exam's guide
 * with this site's materials, and links to the exam owner's free
 * official practice.
 */
test("the listening library's first filter row is exams; one narrows to its materials", async ({
  page,
}) => {
  await page.goto("/");
  const exams = page.getByRole("group", { name: "考試英文" }).first();
  await expect(exams).toBeVisible();
  await exams.getByRole("button", { name: /多益 TOEIC/ }).click();
  await expect(page).toHaveURL(/exam=toeic/);
  await expect(page.getByText("E2E TOEIC practice").first()).toBeVisible();
  await expect(page.getByText("E2E official practice")).toHaveCount(0);
  await page
    .getByRole("link", { name: /考試的介紹/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/exams$/);
});

test("the writing prompts' first row is exams, GEPT by level", async ({
  page,
}) => {
  await page.goto("/writing");
  const exams = page.getByRole("group", { name: "考試英文" });
  await expect(exams).toBeVisible();
  await exams.getByRole("button", { name: "全民英檢初級" }).click();
  await expect(page).toHaveURL(/x=gept-elementary/);
  // Every prompt shown is a GEPT elementary one.
  const links = page.getByRole("link", { name: /全民英檢初級/ });
  await expect(links.first()).toBeVisible();
  await exams.getByRole("button", { name: "全民英檢初級" }).click();
  await exams.getByRole("button", { name: "雅思 IELTS" }).click();
  await expect(page).toHaveURL(/x=ielts/);
  await expect(page.getByText(/IELTS Task 2/).first()).toBeVisible();
});

test("each exam has a guide: parts, scoring, practice, materials, and official links", async ({
  page,
}) => {
  await page.goto("/exams");
  await expect(
    page.getByRole("heading", { level: 1, name: /考試英文/ }),
  ).toBeVisible();
  for (const name of [
    "托福",
    "雅思",
    "多益",
    "全民英檢",
    "學測",
    "高中英語聽力測驗",
    "國中教育會考",
  ]) {
    await expect(
      page.getByRole("link", { name: new RegExp(name) }).first(),
    ).toBeVisible();
  }
  await page.goto("/exams/toeic");
  for (const heading of [
    "考試簡介",
    "題型",
    "聽力的評分方式",
    "寫作的評分方式",
    "建議練習方式",
    "這裡的練習",
    "官方的免費練習資源",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(page.getByText("E2E TOEIC practice").first()).toBeVisible();
  // Official practice: links out, safely, each with the day it was checked.
  const official = page
    .getByRole("region", { name: "官方的免費練習資源" })
    .getByRole("link");
  await expect(official.first()).toHaveAttribute("href", /^https:\/\//);
  await expect(official.first()).toHaveAttribute("rel", /noopener/);
  await expect(page.getByText(/查證可開啟/).first()).toBeVisible();
  await page.goto("/exams/gept");
  for (const level of ["全民英檢初級", "全民英檢中級", "全民英檢中高級"]) {
    await expect(page.getByRole("heading", { name: level })).toBeVisible();
  }
});
