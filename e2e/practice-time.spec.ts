import { expect, test } from "./fixtures";

/** Practice time (D74): active seconds on a practice page are saved. */
test("active time on a practice page is saved in the activity log", async ({
  page,
}) => {
  await page.goto("/videos/sintel/day/1");
  const input = page.getByRole("textbox", { name: "你聽到的句子" });
  await input.click();
  for (let i = 0; i < 4; i++) {
    await input.press("a");
    await page.waitForTimeout(800);
  }
  // Leaving the page saves what was counted.
  await page.getByRole("link", { name: "ListenLoop" }).first().click();
  await expect(page).toHaveURL("/");
  const seconds = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem("ll-activity:v1") ?? "{}");
    let total = 0;
    for (const day of Object.values(log.days ?? {}) as {
      time?: Record<string, Record<string, number>>;
    }[]) {
      for (const device of Object.values(day.time ?? {})) {
        total += device.sintel ?? 0;
      }
    }
    return total;
  });
  expect(seconds).toBeGreaterThanOrEqual(2);
});
