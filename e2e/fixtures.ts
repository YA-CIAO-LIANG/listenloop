import { test as base, type Page } from "@playwright/test";

/**
 * Pages with YouTube blocked (deterministic, offline) and Chinese UI.
 * `provide` is Playwright's fixture callback, usually called `use`; renamed
 * so the React hooks lint rule doesn't mistake it for React's use().
 */
export const test = base.extend<{ passPracticeChoice: boolean }>({
  /**
   * WritingLoop's Day 2 asks which version of the essay to practice
   * (D218). Unless a test turns this off to check that step itself, it's
   * passed the way a learner would: signed in, have the AI correct the
   * essay (the fake provider) and practice that; otherwise the model
   * essay (or, a custom prompt without one, nothing to choose).
   */
  passPracticeChoice: [true, { option: true }],
  page: async ({ page, context, passPracticeChoice }, provide) => {
    if (passPracticeChoice) {
      await page.addLocatorHandler(
        page.getByTestId("practice-choice"),
        async (choice) => {
          const start = choice.getByRole("button", {
            name: /^(請 AI 修改我的文章|Have the AI correct my essay)/,
          });
          const choose = choice.getByRole("button", {
            name: /^(選這個版本來練習|Practice this version)$/,
          });
          const model = choice.getByRole("button", {
            name: /^(改用範文練習|Practice the model essay instead)$/,
          });
          if (await start.isVisible()) await start.click();
          if (
            await choose
              .waitFor({ timeout: 3_000 })
              .then(() => true)
              .catch(() => false)
          ) {
            await choose.click();
          } else if (await model.isVisible()) {
            await model.click();
          }
          await choice.waitFor({ state: "detached" });
        },
      );
    }
    await context.addCookies([
      {
        name: "ll-locale",
        value: "zh-Hant",
        url: `http://localhost:${process.env.E2E_PORT ?? 3200}`,
      },
    ]);
    await page.route(
      /youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com/,
      (route) => route.abort(),
    );
    await provide(page);
  },
});

export { expect } from "@playwright/test";

/** Sets the page clock to a local date (Asia/Taipei), 10:00. */
export async function setToday(page: Page, date: string) {
  await page.clock.setFixedTime(new Date(`${date}T10:00:00+08:00`));
}

/**
 * Signs in as the author of the practices in e2e/mock-supabase/: a
 * session cookie the stand-in accepts. Progress on the home page and
 * /practices shows only when signed in (D2).
 */
export async function signInAsAuthor(page: Page) {
  await signInAs(page, { id: "e2e-author", email: "author@example.com" });
}

/**
 * Signs in as an admin (D56): the stand-in reports role "admin" for this
 * account's profile. No secret key in E2E, so admin pages show their
 * empty or "no key" states: enough to see each page renders.
 */
export async function signInAsAdmin(
  page: Page,
  { signedInMinutesAgo = 0 }: { signedInMinutesAgo?: number } = {},
) {
  await signInAs(
    page,
    { id: "e2e-admin", email: "admin@example.com" },
    signedInMinutesAgo,
  );
}

/**
 * Signs in as a learner on the free plan who hasn't made a practice yet
 * (D72): the one-practice trial is still open.
 */
export async function signInAsLearner(page: Page) {
  await signInAs(page, { id: "e2e-learner", email: "learner@example.com" });
}

/** Signs in as an account on the paid plan (paid features such as D97). */
export async function signInAsPaid(page: Page) {
  await signInAs(page, { id: "e2e-paid", email: "paid@example.com" });
}

/** Signs in as a student verified by a school email (D144). */
export async function signInAsStudent(page: Page) {
  await signInAs(page, { id: "e2e-student", email: "amy@ntu.edu.tw" });
}

/**
 * Signs in as an account of its own for the payment flow (D85), so its
 * paid plan never changes what other tests see.
 */
export async function signInAsBuyer(page: Page, id = "e2e-buyer") {
  await signInAs(page, { id, email: `${id}@example.com` });
}

/** Signs in as any account (e.g. one with a long Gmail address). */
export async function signInWithEmail(page: Page, id: string, email: string) {
  await signInAs(page, { id, email });
}

async function signInAs(
  page: Page,
  user: { id: string; email: string },
  /** When the session signed in (D159): just now unless said otherwise. */
  signedInMinutesAgo = 0,
) {
  const signedInAt = Math.floor(Date.now() / 1000) - signedInMinutesAgo * 60;
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = 4_102_444_800; // 2100
  const accessToken = [
    base64url({ alg: "HS256", typ: "JWT" }),
    base64url({
      sub: user.id,
      email: user.email,
      aud: "authenticated",
      role: "authenticated",
      exp: expiresAt,
      amr: [{ method: "oauth", timestamp: signedInAt }],
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
      url: `http://localhost:${process.env.E2E_PORT ?? 3200}`,
    },
  ]);
}

/**
 * Checks the back-translation answer in the box (D195, D202): picks
 * "fairly sure" when asked how sure, presses Check, and skips "where it
 * went wrong" when it's asked. Leaves the result on screen.
 */
export async function checkBackAnswer(page: Page) {
  // How sure is the Check itself when asked (D202).
  const sure = page.getByRole("button", { name: "檢查：有點確定" });
  if (await sure.isVisible()) await sure.click();
  else await page.getByRole("button", { name: "檢查", exact: true }).click();
  await page
    .getByText(/寫對了|差一點/)
    .first()
    .waitFor();
  const skip = page.getByRole("button", { name: "略過", exact: true });
  if (await skip.isVisible()) await skip.click();
}
