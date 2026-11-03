import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyActivity,
  recordRetry,
  recordTask,
  type Activity,
} from "@/lib/activity";
import type { LocalDate } from "@/lib/dates";
import { createProgress, withDay, type Progress } from "@/lib/progress";
import type { CloudData } from "@/lib/storage/cloud-store";
import { createLocalProgressStore } from "@/lib/storage/local-progress-store";
import { createLocalRewardStore } from "@/lib/storage/local-reward-store";
import { createSyncedStores } from "@/lib/storage/synced-stores";
import { mergeActivity, planProgressSync } from "@/lib/sync/merge";
import { ACCOUNT_KEY, syncWithCloud } from "@/lib/sync/sync";
import { MemoryStorage } from "./memory-storage";

const d = (day: string) => `2026-11-${day}` as LocalDate;

/** Progress with days 1…n done on Nov 1…n. */
function progressWith(videoId: string, doneDays: number, week = 1): Progress {
  let p: Progress = { ...createProgress(videoId, d("01")), week };
  for (let day = 1; day <= doneDays; day++) {
    p = withDay(p, day as 1, {
      done: true,
      date: d(String(day).padStart(2, "0")),
    });
  }
  return p;
}

describe("planProgressSync", () => {
  it("copies each side's missing videos to the other", () => {
    const plan = planProgressSync(
      [progressWith("a", 1)],
      [progressWith("b", 2)],
    );
    expect(plan.toCloud.map((p) => p.videoId)).toEqual(["a"]);
    expect(plan.toLocal.map((p) => p.videoId)).toEqual(["b"]);
  });

  it("keeps the copy with more progress: week, then days done", () => {
    const plan = planProgressSync(
      [progressWith("a", 3), progressWith("b", 6, 1)],
      [progressWith("a", 2), progressWith("b", 1, 2)],
    );
    expect(plan.toCloud).toEqual([progressWith("a", 3)]);
    expect(plan.toLocal).toEqual([progressWith("b", 1, 2)]);
  });

  it("counts answered sentences in a day still in progress", () => {
    const started = withDay(progressWith("a", 0), 1, {
      done: false,
      answers: ["we moved", null],
    });
    const further = withDay(progressWith("a", 0), 1, {
      done: false,
      answers: ["we moved", "to the city"],
    });
    expect(planProgressSync([further], [started]).toCloud).toEqual([further]);
    expect(planProgressSync([started], [further]).toLocal).toEqual([further]);
  });

  it("does nothing for identical copies; a tie otherwise goes to the cloud", () => {
    expect(
      planProgressSync([progressWith("a", 2)], [progressWith("a", 2)]),
    ).toEqual({ toLocal: [], toCloud: [] });
    const localCopy = { ...progressWith("a", 2), startedAt: d("02") };
    const cloudCopy = progressWith("a", 2);
    expect(planProgressSync([localCopy], [cloudCopy])).toEqual({
      toLocal: [cloudCopy],
      toCloud: [],
    });
  });
});

describe("mergeActivity", () => {
  it("combines days and each day's tasks and retries, once each", () => {
    const task = { videoId: "a", week: 1, day: 1 };
    const phone = recordRetry(
      recordTask(emptyActivity(), d("01"), task),
      d("02"),
      "a",
    );
    const laptop = recordTask(
      recordTask(emptyActivity(), d("01"), task),
      d("01"),
      { videoId: "b", week: 1, day: 1 },
    );
    const merged = mergeActivity(phone, recordRetry(laptop, d("02"), "a"));
    expect(merged.days[d("01")]?.tasks).toEqual([
      task,
      { videoId: "b", week: 1, day: 1 },
    ]);
    expect(merged.days[d("01")]?.official).toBe(true);
    expect(merged.days[d("02")]?.retries).toEqual(["a"]);
    expect(mergeActivity(merged, merged)).toEqual(merged);
  });
});

/** An account's data held in memory, standing in for Supabase. */
function fakeCloud(
  progress: Progress[] = [],
  activity: Activity | null = null,
) {
  const state = {
    progress: new Map(progress.map((p) => [p.videoId, p])),
    activity,
  };
  const cloud: CloudData = {
    listProgress: vi.fn(async () => [...state.progress.values()]),
    saveProgress: vi.fn(async (items: readonly Progress[]) => {
      for (const p of items) state.progress.set(p.videoId, p);
    }),
    removeProgress: vi.fn(async (videoId: string) => {
      state.progress.delete(videoId);
    }),
    getActivity: vi.fn(async () => state.activity),
    saveActivity: vi.fn(async (a: Activity) => {
      state.activity = a;
    }),
  };
  return { cloud, state };
}

describe("syncWithCloud", () => {
  let storage: MemoryStorage;
  let local: ReturnType<typeof localStores>;
  const localStores = () => ({
    progress: createLocalProgressStore(() => storage),
    rewards: createLocalRewardStore(() => storage),
  });

  beforeEach(() => {
    storage = new MemoryStorage();
    local = localStores();
  });

  it("moves a guest's progress into the account on first sign-in", async () => {
    await local.progress.save(progressWith("sintel", 3));
    await local.rewards.saveActivity(
      recordTask(emptyActivity(), d("01"), {
        videoId: "sintel",
        week: 1,
        day: 1,
      }),
    );
    const { cloud, state } = fakeCloud();

    const result = await syncWithCloud({ userId: "u1", local, cloud, storage });
    expect(result.changedLocal).toBe(false);
    expect(state.progress.get("sintel")).toEqual(progressWith("sintel", 3));
    expect(state.activity?.days[d("01")]?.official).toBe(true);
    expect(JSON.parse(storage.getItem(ACCOUNT_KEY) ?? "")).toEqual({
      userId: "u1",
    });
    // This device keeps its copy as an offline backup.
    expect(await local.progress.get("sintel")).toEqual(
      progressWith("sintel", 3),
    );
  });

  it("brings another device's progress here, keeping whichever is further", async () => {
    await local.progress.save(progressWith("sintel", 5));
    await local.progress.save(progressWith("tos", 1));
    const { cloud, state } = fakeCloud([
      progressWith("sintel", 2),
      progressWith("tos", 4),
      progressWith("new", 1),
    ]);

    const result = await syncWithCloud({ userId: "u1", local, cloud, storage });
    expect(result.changedLocal).toBe(true);
    expect(await local.progress.get("tos")).toEqual(progressWith("tos", 4));
    expect(await local.progress.get("new")).toEqual(progressWith("new", 1));
    expect(state.progress.get("sintel")).toEqual(progressWith("sintel", 5));
    expect(cloud.saveProgress).toHaveBeenCalledWith([
      progressWith("sintel", 5),
    ]);
  });

  it("reports no change and uploads nothing when already in sync", async () => {
    await local.progress.save(progressWith("sintel", 2));
    storage.setItem(ACCOUNT_KEY, JSON.stringify({ userId: "u1" }));
    const { cloud } = fakeCloud([progressWith("sintel", 2)], emptyActivity());

    expect(
      await syncWithCloud({ userId: "u1", local, cloud, storage }),
    ).toEqual({ changedLocal: false });
    expect(cloud.saveProgress).toHaveBeenCalledWith([]);
    expect(cloud.saveActivity).not.toHaveBeenCalled();
  });

  it("replaces another account's data instead of mixing it in", async () => {
    storage.setItem(ACCOUNT_KEY, JSON.stringify({ userId: "someone-else" }));
    await local.progress.save(progressWith("sintel", 6));
    await local.rewards.saveActivity(
      recordRetry(emptyActivity(), d("03"), "sintel"),
    );
    const { cloud, state } = fakeCloud([progressWith("tos", 1)]);

    const result = await syncWithCloud({ userId: "u1", local, cloud, storage });
    expect(result.changedLocal).toBe(true);
    expect(await local.progress.list()).toEqual([progressWith("tos", 1)]);
    expect(await local.rewards.getActivity()).toEqual(emptyActivity());
    expect(state.progress.has("sintel")).toBe(false);
  });

  it("fails without marking the device as synced when the cloud can't be read", async () => {
    const { cloud } = fakeCloud();
    vi.mocked(cloud.listProgress).mockRejectedValue(new Error("offline"));
    await expect(
      syncWithCloud({ userId: "u1", local, cloud, storage }),
    ).rejects.toThrow("offline");
    expect(storage.getItem(ACCOUNT_KEY)).toBeNull();
  });
});

describe("createSyncedStores", () => {
  it("saves here first, then sends the save to the account", async () => {
    const storage = new MemoryStorage();
    const local = {
      progress: createLocalProgressStore(() => storage),
      rewards: createLocalRewardStore(() => storage),
    };
    const { cloud, state } = fakeCloud();
    const stores = createSyncedStores(local, cloud);

    await stores.progress.save(progressWith("sintel", 1));
    await stores.rewards.saveActivity(
      recordRetry(emptyActivity(), d("01"), "x"),
    );
    await vi.waitFor(() => expect(state.progress.size).toBe(1));
    expect(await local.progress.get("sintel")).toEqual(
      progressWith("sintel", 1),
    );
    expect(state.activity?.days[d("01")]?.retries).toEqual(["x"]);

    await stores.progress.remove("sintel");
    await vi.waitFor(() => expect(state.progress.size).toBe(0));
  });

  it("keeps working offline: a failed upload is reported, the save still stands", async () => {
    const storage = new MemoryStorage();
    const local = {
      progress: createLocalProgressStore(() => storage),
      rewards: createLocalRewardStore(() => storage),
    };
    const { cloud } = fakeCloud();
    vi.mocked(cloud.saveProgress).mockRejectedValue(new Error("offline"));
    const onUploadError = vi.fn();
    const stores = createSyncedStores(local, cloud, onUploadError);

    await stores.progress.save(progressWith("sintel", 1));
    expect(await stores.progress.get("sintel")).toEqual(
      progressWith("sintel", 1),
    );
    await vi.waitFor(() => expect(onUploadError).toHaveBeenCalled());
  });
});
