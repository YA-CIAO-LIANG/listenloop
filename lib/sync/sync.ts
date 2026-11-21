import { LEVEL_TEST_KEY } from "@/lib/level-test";
import {
  applySettings,
  mergeSettings,
  readSettings,
} from "@/lib/personal-settings";
import { WALLET_KEY } from "@/lib/storage/local-reward-store";
import { isWritingStorageKey } from "@/lib/writing/store";
import { emptyActivity } from "../activity";
import { updateActivity } from "../claim-rewards";
import type { CloudData } from "../storage/cloud-store";
import type { ProgressStore } from "../storage/progress-store";
import type { RewardStore } from "../storage/reward-store";
import { mergeActivity, planProgressSync, sameData } from "./merge";

/**
 * Which account this device's practice data belongs to, and which videos
 * both sides had after the last sync: { userId, synced }. Missing means
 * guest data, which joins the first account that signs in. `synced` tells
 * a progress removed on another device from one started here (D15).
 */
export const ACCOUNT_KEY = "ll-account:v1";

type AccountRecord = { userId: string; synced: string[] };

function readAccount(storage: Storage): AccountRecord | null {
  try {
    const raw = storage.getItem(ACCOUNT_KEY);
    const data: unknown = raw === null ? null : JSON.parse(raw);
    if (
      typeof data !== "object" ||
      data === null ||
      !("userId" in data) ||
      typeof data.userId !== "string"
    ) {
      return null;
    }
    const synced =
      "synced" in data && Array.isArray(data.synced)
        ? data.synced.filter((id): id is string => typeof id === "string")
        : [];
    return { userId: data.userId, synced };
  } catch {
    return null;
  }
}

type SyncOptions = {
  userId: string;
  local: { progress: ProgressStore; rewards: RewardStore };
  cloud: CloudData;
  storage: Storage;
};

/**
 * Brings this device and the account into agreement (docs/decisions.md
 * D3, D14), run once per page load while signed in:
 * - guest data, or data already this account's: each video keeps the copy
 *   with more progress, activity logs are combined;
 * - another account's data: replaced by this account's (the other
 *   account's copy is in its own cloud).
 * Uploads what the account lacks, so an earlier failed upload is retried.
 * Returns whether this device's data changed (pages should read again).
 */
export async function syncWithCloud({
  userId,
  local,
  cloud,
  storage,
}: SyncOptions): Promise<{ changedLocal: boolean }> {
  const [cloudProgress, cloudActivity] = await Promise.all([
    cloud.listProgress(),
    cloud.getActivity(),
  ]);
  let changedLocal = false;
  let [localProgress, localActivity] = await Promise.all([
    local.progress.list(),
    local.rewards.getActivity(),
  ]);

  const account = readAccount(storage);
  const sameAccount = account?.userId === userId;
  // Personal settings follow the account (D138).
  const settings = cloud.getSettings
    ? mergeSettings(
        readSettings(storage),
        await cloud.getSettings(),
        sameAccount,
      )
    : null;
  if (settings?.toLocal) {
    applySettings(storage, settings.use);
    changedLocal = true;
  }
  if (account !== null && !sameAccount) {
    // Another account's wallet and level test go too (D138).
    storage.removeItem(WALLET_KEY);
    storage.removeItem(LEVEL_TEST_KEY);
    // And its writing (D187), before the writing sync brings this one's.
    const writing = Array.from({ length: storage.length }, (_, i) =>
      storage.key(i),
    ).filter((key): key is string => !!key && isWritingStorageKey(key));
    for (const key of writing) storage.removeItem(key);
    await Promise.all(
      localProgress.map((p) => local.progress.remove(p.videoId)),
    );
    changedLocal = localProgress.length > 0;
    localProgress = [];
    localActivity = emptyActivity();
  }

  const { toLocal, toCloud, removeLocal, removeCloud } = planProgressSync(
    localProgress,
    cloudProgress,
    new Set(sameAccount ? account.synced : []),
  );
  for (const progress of toLocal) await local.progress.save(progress);
  for (const videoId of removeLocal) await local.progress.remove(videoId);
  changedLocal ||= toLocal.length > 0 || removeLocal.length > 0;

  // Merged with this device's activity as it is now, in the same queue
  // as the page's own writes: an answer given while the sync was reading
  // the cloud isn't overwritten by the older copy read at the start.
  const switched = account !== null && !sameAccount;
  let activityChanged = false;
  const activity = await updateActivity(local.rewards, (current) => {
    const merged = mergeActivity(
      switched ? localActivity : current,
      cloudActivity ?? emptyActivity(),
    );
    if (sameData(merged, current)) return current;
    activityChanged = true;
    return merged;
  });
  changedLocal ||= activityChanged;

  await Promise.all([
    settings?.toCloud && cloud.saveSettings
      ? cloud.saveSettings(settings.use)
      : null,
    cloud.saveProgress(toCloud),
    ...removeCloud.map((videoId) => cloud.removeProgress(videoId)),
    sameData(activity, cloudActivity) ? null : cloud.saveActivity(activity),
  ]);
  const synced = (await local.progress.list()).map((p) => p.videoId).sort();
  storage.setItem(ACCOUNT_KEY, JSON.stringify({ userId, synced }));
  return { changedLocal };
}
