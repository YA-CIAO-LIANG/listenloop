import { devices, type Page } from "@playwright/test";
import { expect, setToday, signInWithEmail, test } from "./fixtures";

/**
 * The writing workspace (D193): the task, the sound controls, and the
 * answer box are in view together on load, without scrolling, on a
 * desktop and on two emulated phones; with the keyboard up (the visible
 * height about halved), the box, the count, and the button still are.
 */
const PROMPT = "daily-perfect-weekend";

/** A phone keyboard takes about 45% of the screen. */
async function keyboardUp(page: Page) {
  const size = page.viewportSize()!;
  await page.setViewportSize({
    width: size.width,
    height: Math.round(size.height * 0.55),
  });
}

async function taskInView(page: Page, phone: boolean) {
  const workspace = page.getByTestId("writing-workspace");
  if (phone) {
    // One line on top that opens to the whole task.
    const summary = workspace.locator("summary");
    await expect(summary).toBeInViewport();
    await summary.click();
    await expect(workspace.getByText("評分重點").first()).toBeVisible();
    await summary.click();
  } else {
    await expect(
      workspace.getByRole("region", { name: "題目" }),
    ).toBeInViewport();
  }
}

for (const device of ["desktop", "iPhone 15", "Pixel 7"] as const) {
  const phone = device !== "desktop";
  test.describe(device, () => {
    if (phone) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { defaultBrowserType, ...rest } = devices[device];
      test.use(rest);
    } else {
      test.use({ viewport: { width: 1280, height: 800 } });
    }

    test("Day 1: the task and the answer box together", async ({ page }) => {
      await setToday(page, "2026-11-11");
      await page.goto(`/writing/${PROMPT}/day/1`);
      const box = page.getByRole("textbox", { name: "你的文章" });
      await expect(box).toBeEnabled();
      await taskInView(page, phone);
      await expect(box).toBeInViewport();
      const submit = page.getByRole("button", { name: /送出/ });
      await expect(submit).toBeInViewport();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      await box.click();
      await box.fill("My perfect weekend would start slowly.");
      await keyboardUp(page);
      await expect(submit).toBeInViewport();
      await expect(box).toBeInViewport();
      await expect(
        page.locator('[aria-live="polite"]').filter({ hasText: /\d+ 字/ }),
      ).toBeInViewport();
    });

    test("Day 2: the sound, the box, and Check together", async ({ page }) => {
      await setToday(page, "2026-11-11");
      await page.goto(`/writing/${PROMPT}/day/1`);
      await page
        .getByRole("textbox", { name: "你的文章" })
        .fill("My perfect weekend would start slowly at home.");
      await page.getByRole("button", { name: "送出並自己評分" }).click();
      await page.getByRole("button", { name: "略過自評，直接儲存" }).click();
      await setToday(page, "2026-11-12");
      await page.goto(`/writing/${PROMPT}/day/2`);
      const replay = page.getByRole("button", { name: "重播" });
      const box = page.getByRole("textbox", { name: "聽到的英文句子" });
      const check = page.getByRole("button", { name: "檢查" });
      await expect(box).toBeVisible();
      for (const element of [replay, box, check]) {
        await expect(element).toBeInViewport();
      }
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await box.click();
      await box.fill("My perfect weekend");
      await keyboardUp(page);
      for (const element of [replay, box, check]) {
        await expect(element).toBeInViewport();
      }
    });

    test("the chat room fills the screen when it starts (D198)", async ({
      page,
    }) => {
      const id = `e2e-room-${device.replace(/\W+/g, "-").toLowerCase()}`;
      await signInWithEmail(page, id, `${id}@example.com`);
      await page.goto("/writing/chat");
      await page.getByRole("button", { name: "開始聊天" }).click();
      const room = page.getByTestId("chat-room");
      await expect(room).toBeVisible();
      const height = page.viewportSize()!.height;
      await expect
        .poll(async () => (await room.boundingBox())?.height ?? 0)
        .toBeGreaterThan(height * 0.9);
      await expect(
        page.getByRole("textbox", { name: /傳訊息給/ }),
      ).toBeInViewport();
    });
  });
}
