import { beforeEach, describe, expect, it } from "vitest";
import { createProgress, withDay } from "@/lib/progress";
import {
  PROGRESS_KEY_PREFIX,
  createLocalProgressStore,
} from "@/lib/storage/local-progress-store";

/** Minimal in-memory Web Storage for tests. */
class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

const today = "2026-10-24";
let storage: MemoryStorage;
let store: ReturnType<typeof createLocalProgressStore>;

beforeEach(() => {
  storage = new MemoryStorage();
  store = createLocalProgressStore(() => storage);
});

describe("local progress store", () => {
  it("saves and reads back progress under a versioned key", async () => {
    const progress = withDay(createProgress("voa-001", today), 1, {
      done: true,
      date: today,
      score: 0.72,
    });
    await store.save(progress);
    expect(storage.getItem(`${PROGRESS_KEY_PREFIX}voa-001`)).not.toBeNull();
    expect(await store.get("voa-001")).toEqual(progress);
  });

  it("returns null when there is no progress", async () => {
    expect(await store.get("voa-404")).toBeNull();
  });

  it("treats corrupted or invalid data as no progress", async () => {
    storage.setItem(`${PROGRESS_KEY_PREFIX}broken`, "{not json");
    storage.setItem(
      `${PROGRESS_KEY_PREFIX}invalid`,
      JSON.stringify({ week: 1 }),
    );
    expect(await store.get("broken")).toBeNull();
    expect(await store.get("invalid")).toBeNull();
  });

  it("ignores progress saved under another video's key", async () => {
    storage.setItem(
      `${PROGRESS_KEY_PREFIX}voa-002`,
      JSON.stringify(createProgress("voa-001", today)),
    );
    expect(await store.get("voa-002")).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it("lists only valid ListenLoop progress", async () => {
    await store.save(createProgress("voa-001", today));
    await store.save(createProgress("voa-002", today));
    storage.setItem(`${PROGRESS_KEY_PREFIX}broken`, "{");
    storage.setItem("ll-theme", "dark");
    const ids = (await store.list()).map((p) => p.videoId).sort();
    expect(ids).toEqual(["voa-001", "voa-002"]);
  });

  it("removes progress", async () => {
    await store.save(createProgress("voa-001", today));
    await store.remove("voa-001");
    expect(await store.get("voa-001")).toBeNull();
  });

  it("returns null instead of throwing when storage is blocked", async () => {
    const blocked = createLocalProgressStore(() => {
      throw new Error("SecurityError");
    });
    expect(await blocked.get("voa-001")).toBeNull();
  });

  it("rejects a save that storage refuses (e.g. quota exceeded)", async () => {
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    await expect(store.save(createProgress("voa-001", today))).rejects.toThrow(
      "QuotaExceededError",
    );
  });
});
