import { test as base, type Page } from "@playwright/test";

/**
 * Pages with YouTube blocked (deterministic, offline) and Chinese UI.
 * `provide` is Playwright's fixture callback, usually called `use`; renamed
 * so the React hooks lint rule doesn't mistake it for React's use().
 */
export const test = base.extend({
  page: async ({ page, context }, provide) => {
    await context.addCookies([
      { name: "ll-locale", value: "zh-Hant", url: "http://localhost:3200" },
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
