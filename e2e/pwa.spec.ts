import { expect, test } from "./fixtures";

/** Installable app and the offline page (D64). */
test("the manifest makes the site installable", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    short_name: "ListenLoop",
    start_url: "/",
    display: "standalone",
  });
  const purposes = manifest.icons.map(
    (icon: { purpose: string }) => icon.purpose,
  );
  expect(purposes).toContain("maskable");
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  expect((await request.get("/.well-known/assetlinks.json")).ok()).toBe(true);
});

test("offline, a page shows the offline message", async ({ page, context }) => {
  await page.goto("/");
  // The service worker installs and caches the offline page.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state;
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto("/terms").catch(() => {});
  await expect(
    page.getByRole("heading", { name: "目前沒有網路" }),
  ).toBeVisible();
  await context.setOffline(false);
});
