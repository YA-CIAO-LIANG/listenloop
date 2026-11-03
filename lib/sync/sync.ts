import { emptyActivity } from "../activity";
import type { CloudData } from "../storage/cloud-store";
import type { ProgressStore } from "../storage/progress-store";
import type { RewardStore } from "../storage/reward-store";
import { mergeActivity, planProgressSync, sameData } from "./merge";

/**
 * Which account this device's practice data belongs to: { userId }.
 * Missing means guest data, which joins the first account that signs in.
 */
export const ACCOUNT_KEY = "ll-account:v1";

function readOwner(storage: Storage): string | null {
  try {
    const raw = storage.getItem(ACCOUNT_KEY);
    const owner: unknown = raw === null ? null : JSON.parse(raw);
    return typeof owner === "object" &&
      owner !== null &&
      "userId" in owner &&
      typeof owner.userId === "string"
      ? owner.userId
      : null;
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

  const owner = readOwner(storage);
  if (owner !== null && owner !== userId) {
    await Promise.all(
      localProgress.map((p) => local.progress.remove(p.videoId)),
    );
    changedLocal = localProgress.length > 0;
    localProgress = [];
    localActivity = emptyActivity();
  }

  const { toLocal, toCloud } = planProgressSync(localProgress, cloudProgress);
  for (const progress of toLocal) await local.progress.save(progress);
  changedLocal ||= toLocal.length > 0;

  const activity = mergeActivity(
    localActivity,
    cloudActivity ?? emptyActivity(),
  );
  if (!sameData(activity, await local.rewards.getActivity())) {
    await local.rewards.saveActivity(activity);
    changedLocal = true;
  }

  await Promise.all([
    cloud.saveProgress(toCloud),
    sameData(activity, cloudActivity) ? null : cloud.saveActivity(activity),
  ]);
  storage.setItem(ACCOUNT_KEY, JSON.stringify({ userId }));
  return { changedLocal };
}
