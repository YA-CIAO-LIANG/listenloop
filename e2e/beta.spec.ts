import AxeBuilder from "@axe-core/playwright";
import { expect, signInAsAdmin, test } from "./fixtures";

/** Sign-ups in stages (D132). */
const axe = async (page: import("@playwright/test").Page) =>
  (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
  ).violations.map((v) => v.id);

test("home and sign-in say it's a Beta, with feedback and the terms", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Beta 測試中")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "意見回饋" }).first(),
  ).toHaveAttribute("href", "/feedback");
  await page.goto("/login");
  await expect(page.getByText("Beta 測試中")).toBeVisible();
  await expect(page.getByText(/未滿 18 歲請先取得家長/)).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "服務條款" })).toHaveAttribute(
    "href",
    "/terms",
  );
});

test("a full Beta offers the waiting list, which takes an email and a purpose", async ({
  page,
}) => {
  await page.goto("/beta?reason=full");
  await expect(
    page.getByRole("heading", { name: "目前 Beta 名額已滿" }),
  ).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.getByLabel("Email").fill("someone@example.com");
  await page.getByLabel(/你想用 ListenLoop 做什麼/).fill("準備多益聽力");
  await page.getByRole("button", { name: "加入等候名單" }).click();
  await expect(page.getByText(/已加入等候名單/)).toBeVisible();
});

test("an invite link that doesn't work says so", async ({ page }) => {
  await page.goto("/invite/ZZZZ2222");
  await expect(page).toHaveURL(/\/beta\?reason=invite$/);
  await expect(
    page.getByRole("heading", { name: "這個邀請連結無法使用" }),
  ).toBeVisible();
});

test("admins see places taken, the switch, invites, and the waiting list", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/beta");
  await expect(
    page.getByRole("heading", { name: "註冊與邀請", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("3 / 50")).toBeVisible();
  await expect(page.getByLabel("帳號上限")).toHaveValue("50");
  await expect(
    page.getByRole("button", { name: "產生邀請連結" }),
  ).toBeVisible();
  await expect(page.getByText("等候名單是空的。")).toBeVisible();
  expect(await axe(page)).toEqual([]);
});
