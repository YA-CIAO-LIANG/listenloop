import { devices } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The shortest path for a first-time visitor (D169): from the home page
 * to the first sentence answered, without an account, on a phone.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...phone } = devices["iPhone 13"];
test.use(phone);

test("a new visitor answers the first sentence in one tap from home", async ({
  page,
}) => {
  await page.goto("/");
  const start = page.getByRole("link", { name: /免費試聽寫第一句/ });
  await expect(start).toBeInViewport();
  await start.click();
  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  await expect(input).toBeVisible();
  await input.fill("hello");
  await page.getByRole("button", { name: "送出" }).click();
  await expect(page.getByRole("button", { name: "下一句" })).toBeVisible();
});

test("signed-in learners don't see the first-visit buttons", async ({
  page,
}) => {
  const { signInAsLearner } = await import("./fixtures");
  await signInAsLearner(page);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /免費試聽寫第一句/ }),
  ).toHaveCount(0);
});
