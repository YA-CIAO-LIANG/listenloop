/*
 * ListenLoop's service worker (P2, D64). Kept small on purpose:
 * - page navigations go to the network first, so pages are always fresh;
 *   when the network is down, the cached offline page shows instead;
 * - practice audio (each sentence's file in Supabase Storage, D112) is
 *   cached the first time it's heard, and a practice page asks for all
 *   its sentences up front ("cache-audio"), so a shaky connection doesn't
 *   stop playback; the files never change (their names are content
 *   hashes), so the cache is always right. At most AUDIO_LIMIT files;
 *   the oldest go first;
 * - practice reminders (D111) arrive as push messages and show as
 *   notifications; tapping one opens the site;
 * - nothing else is intercepted (scripts, Supabase data, YouTube), so
 *   sign-in, sync, and the content security policy work as without it.
 * Bump VERSION when the offline page or its icon changes.
 */
const VERSION = "v2";
const CACHE = `listenloop-offline-${VERSION}`;
const OFFLINE_URL = "/offline";
const AUDIO_CACHE = "listenloop-audio-v1";
const AUDIO_LIMIT = 400;

/** A sentence's audio file in Supabase Storage (the public speech bucket). */
function isSpeechAudio(url) {
  try {
    return new URL(url).pathname.includes("/storage/v1/object/public/speech/");
  } catch {
    return false;
  }
}

/** "bytes=start-end" within `size`, as [start, end] inclusive; or null. */
function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || "");
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start;
  let end;
  if (match[1] === "") {
    // The last N bytes.
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start <= end && start < size ? [start, end] : null;
}

/** Answers a media request from a whole cached file (206 for a range). */
async function fromWhole(request, whole) {
  const range = request.headers.get("range");
  if (!range) return whole;
  const blob = await whole.blob();
  const bounds = byteRange(range, blob.size);
  if (!bounds) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${blob.size}` },
    });
  }
  const [start, end] = bounds;
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": whole.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${blob.size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

/** Keeps the audio cache to AUDIO_LIMIT files, dropping the oldest. */
async function trimAudio(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - AUDIO_LIMIT))) {
    await cache.delete(key);
  }
}

/** The whole file, from the cache or else the network (then cached). */
async function wholeAudio(url) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(url);
  if (cached) return cached;
  // Always the whole file (no Range), so it can be cached and sliced.
  const response = await fetch(url, { mode: "cors", credentials: "omit" });
  if (response.ok && response.status === 200) {
    await cache.put(url, response.clone());
    await trimAudio(cache);
  }
  return response;
}

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
            .filter(
              (key) =>
                key.startsWith("listenloop-") &&
                key !== CACHE &&
                key !== AUDIO_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method === "GET" && isSpeechAudio(request.url)) {
    event.respondWith(
      wholeAudio(request.url)
        .then((whole) => (whole.ok ? fromWhole(request, whole) : whole))
        .catch(() => fetch(request)),
    );
    return;
  }
  if (request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches
        .match(OFFLINE_URL)
        .then((page) => page || new Response("Offline", { status: 503 })),
    ),
  );
});

// A practice reminder (D111): { title, body, url } from the reminder job.
self.addEventListener("push", (event) => {
  let message = { title: "ListenLoop", body: "", url: "/" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // Not JSON: the default text.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "practice-reminder",
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  );
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const open = windows.find((w) => new URL(w.url).origin === url.origin);
        return open
          ? open.focus().then((w) => w.navigate(url.href))
          : self.clients.openWindow(url.href);
      }),
  );
});

// A practice page's sentences, cached ahead so they play offline (D112).
self.addEventListener("message", (event) => {
  const { type, urls } = event.data || {};
  if (type !== "cache-audio" || !Array.isArray(urls)) return;
  event.waitUntil(
    (async () => {
      for (const url of urls.slice(0, AUDIO_LIMIT)) {
        if (typeof url === "string" && isSpeechAudio(url)) {
          await wholeAudio(url).catch(() => null);
        }
      }
    })(),
  );
});
