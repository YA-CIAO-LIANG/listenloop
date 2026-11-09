import mock from "./mock-supabase/practices.json";
import { expect, setToday, signInAsAuthor, test } from "./fixtures";

/**
 * Offline audio (D112): an audio practice's sentences are cached by the
 * service worker when its page opens, and still play without a network.
 */
const videoId = `p-${mock.ready.id}`;

test("a practice's audio is cached and plays offline", async ({
  page,
  context,
}) => {
  await signInAsAuthor(page);
  await setToday(page, "2026-11-01");
  await page.goto(`/videos/${videoId}/day/1`);
  await expect(page.getByRole("textbox")).toBeVisible();
  // The service worker takes over, then is asked to keep every sentence.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole("textbox")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const cache = await caches.open("listenloop-audio-v1");
        return (await cache.keys()).length;
      }),
    )
    .toBe(mock.ready.practice_sentences.length);

  await context.setOffline(true);
  const played = await page.evaluate(async () => {
    const cache = await caches.open("listenloop-audio-v1");
    const [first] = await cache.keys();
    const response = await fetch(first.url, {
      headers: { range: "bytes=0-99" },
    });
    return {
      status: response.status,
      bytes: (await response.arrayBuffer()).byteLength,
    };
  });
  expect(played).toEqual({ status: 206, bytes: 100 });
  await context.setOffline(false);
});
