// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The service worker's audio cache (D112), run against stand-ins for the
 * browser's caches and network: practice audio is kept the first time,
 * served from the cache after that (ranges too), and nothing else is
 * touched.
 */
const source = readFileSync("public/sw.js", "utf8");
const AUDIO = "https://x.supabase.co/storage/v1/object/public/speech/abc.mp3";
const OTHER = "https://x.supabase.co/rest/v1/progress";

type Listener = (event: unknown) => void;

function load() {
  const listeners: Record<string, Listener> = {};
  const stores = new Map<string, Map<string, Response>>();
  const caches = {
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        match: async (url: string) => store.get(url)?.clone(),
        put: async (url: string, response: Response) => {
          store.set(url, response);
        },
        keys: async () => [...store.keys()],
        delete: async (url: string) => store.delete(url),
        addAll: async () => {},
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async () => undefined,
  };
  const network = vi.fn(
    async () =>
      new Response(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
  );
  const self = {
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
    skipWaiting: () => {},
    clients: { claim: () => {} },
    registration: {},
    location: { origin: "https://listenloop.example" },
  };
  new Function("self", "caches", "fetch", source)(self, caches, network);
  /** A fetch event: what the worker answered, or null if it let it pass. */
  async function request(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<Response | null> {
    let answer = null as Promise<Response> | null;
    listeners.fetch({
      request: new Request(url, { headers }),
      respondWith: (response: Promise<Response>) => {
        answer = response;
      },
    });
    return answer ? await answer : null;
  }
  return { listeners, stores, network, request };
}

let sw: ReturnType<typeof load>;
beforeEach(() => {
  sw = load();
});

describe("the audio cache", () => {
  it("keeps a sentence's audio the first time and plays it from the cache after", async () => {
    const first = await sw.request(AUDIO);
    expect(first?.status).toBe(200);
    const again = await sw.request(AUDIO);
    expect(new Uint8Array(await again!.arrayBuffer())).toHaveLength(10);
    expect(sw.network).toHaveBeenCalledTimes(1);
  });

  it("answers a media range from the whole file", async () => {
    const part = await sw.request(AUDIO, { range: "bytes=2-5" });
    expect(part?.status).toBe(206);
    expect(part?.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect([...new Uint8Array(await part!.arrayBuffer())]).toEqual([
      2, 3, 4, 5,
    ]);
    const tail = await sw.request(AUDIO, { range: "bytes=-3" });
    expect(tail?.headers.get("Content-Range")).toBe("bytes 7-9/10");
    const open = await sw.request(AUDIO, { range: "bytes=8-" });
    expect([...new Uint8Array(await open!.arrayBuffer())]).toEqual([8, 9]);
    const outside = await sw.request(AUDIO, { range: "bytes=20-30" });
    expect(outside?.status).toBe(416);
  });

  it("leaves everything else alone", async () => {
    expect(await sw.request(OTHER)).toBeNull();
    expect(sw.network).not.toHaveBeenCalled();
  });

  it("caches a practice's sentences ahead when asked", async () => {
    let done: Promise<unknown> = Promise.resolve();
    sw.listeners.message({
      data: { type: "cache-audio", urls: [AUDIO, OTHER, 42] },
      waitUntil: (work: Promise<unknown>) => {
        done = work;
      },
    });
    await done;
    expect(sw.network).toHaveBeenCalledTimes(1);
    expect([...sw.stores.get("listenloop-audio-v1")!.keys()]).toEqual([AUDIO]);
  });
});
