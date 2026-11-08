import { expect, setToday, signInAsAuthor, test } from "./fixtures";

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

// Phones (touch, so the 44 px cap applies): the month's day buttons must sit
// side by side without overlapping and stay inside the card.
for (const width of [360, 375]) {
  test.describe(`practice calendar at ${width} px`, () => {
    test.use({
      viewport: { width, height: 800 },
      hasTouch: true,
      isMobile: true,
    });

    test("day buttons don't overlap or overflow", async ({ page }) => {
      await setToday(page, "2026-11-18");
      await signInAsAuthor(page);
      await page.goto("/");
      const calendar = page.locator("#practice-calendar-days");
      await expect(calendar).toBeVisible();
      await page.getByRole("button", { name: /展開整月/ }).click();

      const days = calendar.locator("tbody button");
      await expect(days).toHaveCount(30);
      const boxes = (await days.evaluateAll((buttons) =>
        buttons.map((button) => {
          const r = button.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }),
      )) as Box[];
      for (let i = 0; i < boxes.length; i++) {
        expect(boxes[i].width).toBeGreaterThanOrEqual(32);
        expect(boxes[i].x + boxes[i].width).toBeLessThanOrEqual(width);
        for (let j = i + 1; j < boxes.length; j++) {
          expect(overlaps(boxes[i], boxes[j]), `days ${i + 1}, ${j + 1}`).toBe(
            false,
          );
        }
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  });
}
