import type { Page } from "@playwright/test";
import mock from "./mock-supabase/practices.json";
import { expect, signInWithEmail, test } from "./fixtures";

/**
 * The referral program (D177): a learner's invite link on My quota; a
 * friend signs up through it (the email link, on the stand-in), finishes
 * Day 1, and both see 2 more minutes. The stand-in keeps referral test
 * accounts' progress, which the server reads to check Day 1.
 */
const MOCK = `http://localhost:${process.env.MOCK_SUPABASE_PORT ?? 54329}`;
const E2E = `http://localhost:${process.env.E2E_PORT ?? 3200}`;
const official = `p-${mock.official.id}`;
const sentences = mock.official.practice_sentences.map((s) => s.en);

async function signOut(page: Page) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([{ name: "ll-locale", value: "zh-Hant", url: E2E }]);
}

const stat = (page: Page, name: string) =>
  page
    .locator("dl > div")
    .filter({ has: page.getByText(name, { exact: true }) });

test("a friend who signs up through the link and finishes Day 1 earns both 2 minutes", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const run = Math.random().toString(36).slice(2, 8);
  const host = `e2e-ref-host-${run}`;
  const friend = `e2e-ref-friend-${run}`;

  // The referrer's link, with a copy button and nothing earned yet.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await signInWithEmail(page, host, `${host}@example.com`);
  await page.goto("/account/usage");
  await expect(page.getByRole("heading", { name: "邀請朋友" })).toBeVisible();
  const link = (await page.getByTestId("referral-link").textContent()) ?? "";
  const code = /\/r\/([A-Z0-9]{8})$/.exec(link)?.[1];
  expect(code).toBeDefined();
  await page.getByRole("button", { name: "複製連結" }).click();
  await expect(page.getByRole("button", { name: "已複製" })).toBeVisible();
  await expect(stat(page, "用連結註冊")).toContainText("0 人");

  // The friend opens it, is told about the reward, and signs up.
  await signOut(page);
  await page.goto(`/r/${code}`);
  await expect(page).toHaveURL(/\/login\?referred=1/);
  await expect(page.getByText(/朋友邀請你一起練英文聽力/)).toBeVisible();
  await page.goto(
    `/auth/confirm?token_hash=${friend}&type=signup&next=${encodeURIComponent(`/videos/${official}/day/1`)}`,
  );
  await expect(page).toHaveURL(new RegExp(`/videos/${official}/day/1`));

  // Day 1's dictation, every sentence.
  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  for (const [i, answer] of sentences.entries()) {
    await input.fill(answer);
    await page.getByRole("button", { name: "送出" }).click();
    await page
      .getByRole("button", {
        name: i === sentences.length - 1 ? "查看結果" : "下一句",
      })
      .click();
  }
  await expect(page.getByText("100%").first()).toBeVisible();
  // The progress reached the cloud (the server checks it, not the page).
  await expect
    .poll(async () => {
      const response = await fetch(
        `${MOCK}/rest/v1/progress?user_id=eq.${friend}&select=data`,
        { headers: { authorization: "Bearer e2e-secret-key" } },
      );
      return ((await response.json()) as unknown[]).length;
    })
    .toBeGreaterThan(0);

  // The friend: 2 more minutes (300 words, D209) this week.
  await page.goto("/account/usage");
  const week = page
    .getByRole("listitem")
    .filter({ hasText: "本週建立教材的字數" });
  await expect(week).toContainText("/ 600 字");
  await expect(stat(page, "獲得的字數")).toContainText("300 字");

  // The referrer: one friend signed up and finished Day 1, 2 minutes.
  await signOut(page);
  await signInWithEmail(page, host, `${host}@example.com`);
  await page.goto("/account/usage");
  await expect(stat(page, "用連結註冊")).toContainText("1 人");
  await expect(stat(page, "完成第 1 天")).toContainText("1 人");
  await expect(stat(page, "獲得的字數")).toContainText("300 字");
  await expect(stat(page, "還能用的字數")).toContainText("300 字");
  await expect(
    page.getByRole("listitem").filter({ hasText: "本週建立教材的字數" }),
  ).toContainText("/ 600 字");
});

test("a code that isn't anyone's goes to the home page", async ({ page }) => {
  await page.goto("/r/NOTACODE");
  await expect(page).toHaveURL(`${E2E}/`);
  await page.goto("/login");
  await expect(page.getByText(/朋友邀請你一起練英文聽力/)).toHaveCount(0);
});
