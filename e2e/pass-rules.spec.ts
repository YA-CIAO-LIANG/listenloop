import { expect, test } from "./fixtures";

test("the video page shows the pass rules, with the defaults (D92)", async ({
  page,
}) => {
  await page.goto("/videos/sintel");
  await expect(page.getByRole("heading", { name: "通關條件" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /第 7 天/ })).toHaveValue(
    "improve",
  );
  await expect(page.getByRole("combobox", { name: /跟讀每句/ })).toHaveValue(
    "0.6",
  );
  // Free plan: locked, with the way to the plans (a fake door, P2).
  await expect(
    page.getByRole("combobox", { name: /聽寫最低正確率/ }),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "看方案" })).toHaveAttribute(
    "href",
    "/pricing?from=custom-rules",
  );
});
