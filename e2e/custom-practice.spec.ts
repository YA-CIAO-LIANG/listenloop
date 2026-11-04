import mock from "./mock-supabase/practices.json";
import type { Page } from "@playwright/test";
import { expect, setToday, test } from "./fixtures";

/**
 * A created practice ("p-<uuid>") must open from today's tasks on every
 * day of its cycle (D32: an unfinished one once answered 404). Its pages
 * read the practice from Supabase on the server, so these tests run
 * against the stand-in in e2e/mock-supabase/.
 */
const practice = mock.ready;
const unfinished = mock.unfinished;
const videoId = `p-${practice.id}`;
const sentences = practice.practice_sentences.length;

const date = (offset: number) => {
  const day = new Date(Date.UTC(2026, 10, 1 + offset));
  return day.toISOString().slice(0, 10);
};

/** Progress with days 1 … day−1 done, one calendar day apart (none for day 1). */
function progressBefore(day: number) {
  const days: Record<string, unknown> = {};
  for (let d = 1; d < day; d++) {
    days[d] =
      d === 1
        ? {
            done: true,
            date: date(d - 1),
            score: 0.5,
            answers: Array(sentences).fill("the"),
          }
        : {
            done: true,
            date: date(d - 1),
            sentences: Array(sentences).fill({ done: true, coverage: 0.9 }),
          };
  }
  return {
    videoId,
    week: 1,
    startedAt: date(0),
    days,
    status: "in-progress",
    history: [],
  };
}

const headings: Record<number, RegExp> = {
  1: /第 1 天：精聽聽寫/,
  7: /第 7 天：重新聽寫/,
};

for (const day of [1, 2, 3, 4, 5, 6, 7]) {
  test(`day ${day} opens from today's tasks`, async ({ page }) => {
    await setToday(page, date(day - 1));
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [`ll-progress:v1:${videoId}`, JSON.stringify(progressBefore(day))],
    );
    await page.goto("/");

    const today = page.getByRole("heading", { name: "今日任務" }).locator("..");
    const row = today.getByRole("listitem").filter({ hasText: practice.title });
    await expect(row.getByText(`第 ${day} 天`)).toBeVisible();
    await row.getByRole("link", { name: "開始" }).click();

    await expect(page).toHaveURL(`/videos/${videoId}/day/${day}`);
    await expect(
      page.getByRole("heading", {
        name: headings[day] ?? new RegExp(`第 ${day} 天：跟讀`),
      }),
    ).toBeVisible();
    await expect(page.getByText("聲音練習")).toBeVisible();
  });
}

/** Signs in as the practices' author: a session cookie the stand-in accepts. */
async function signInAsAuthor(page: Page) {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = 4_102_444_800; // 2100
  const user = { id: "e2e-author", email: "author@example.com" };
  const accessToken = [
    base64url({ alg: "HS256", typ: "JWT" }),
    base64url({
      sub: user.id,
      email: user.email,
      aud: "authenticated",
      role: "authenticated",
      exp: expiresAt,
    }),
    base64url("signature"),
  ].join(".");
  const session = {
    access_token: accessToken,
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: { ...user, aud: "authenticated", role: "authenticated" },
  };
  await page.context().addCookies([
    {
      name: "sb-localhost-auth-token",
      value: `base64-${base64url(session)}`,
      url: "http://localhost:3200",
    },
  ]);
}

test("the author's unfinished practice offers to finish it, not a 404", async ({
  page,
}) => {
  const id = `p-${unfinished.id}`;
  await signInAsAuthor(page);
  await setToday(page, date(1));
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      `ll-progress:v1:${id}`,
      JSON.stringify({ ...progressBefore(2), videoId: id }),
    ],
  );
  await page.goto("/");

  const today = page.getByRole("heading", { name: "今日任務" }).locator("..");
  const row = today.getByRole("listitem").filter({ hasText: unfinished.title });
  await row.getByRole("link", { name: "開始" }).click();

  await expect(page).toHaveURL(`/videos/${id}/day/2`);
  await expect(
    page.getByRole("heading", { name: "這個練習還在準備中" }),
  ).toBeVisible();
  await expect(page.getByText("講解還沒產生・音檔 1 / 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "繼續產生" })).toBeVisible();
});

test("a practice that doesn't exist is still a 404", async ({ page }) => {
  const response = await page.goto(
    "/videos/p-00000000-0000-4000-8000-000000000000/day/2",
  );
  expect(response?.status()).toBe(404);
});
