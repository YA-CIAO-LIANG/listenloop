/*
 * ListenLoop's service worker (P2, D64). Kept small on purpose:
 * - page navigations go to the network first, so pages are always fresh;
 *   when the network is down, the cached offline page shows instead;
 * - nothing else is intercepted (scripts, Supabase, YouTube, audio), so
 *   sign-in, sync, and the content security policy work as without it.
 * Bump VERSION when the offline page or its icon changes.
 */
const VERSION = "v1";
const CACHE = `listenloop-offline-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("listenloop-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches
        .match(OFFLINE_URL)
        .then((page) => page || new Response("Offline", { status: 503 })),
    ),
  );
});
