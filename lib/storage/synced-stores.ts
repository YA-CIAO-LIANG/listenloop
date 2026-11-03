import type { CloudData } from "./cloud-store";
import type { ProgressStore } from "./progress-store";
import type { RewardStore } from "./reward-store";

/**
 * Stores for a signed-in learner: this device's storage stays the one
 * that's read (fast, works offline), and every save is also sent to the
 * account. A failed upload is left for the next sync (lib/sync/sync.ts),
 * which pushes whatever this device has more of, so nothing waits on the
 * network and nothing is lost offline.
 */
export function createSyncedStores(
  local: { progress: ProgressStore; rewards: RewardStore },
  cloud: CloudData,
  onUploadError: (error: unknown) => void = () => {},
): { progress: ProgressStore; rewards: RewardStore } {
  const upload = (send: () => Promise<void>) => {
    send().catch(onUploadError);
  };

  return {
    progress: {
      get: (videoId) => local.progress.get(videoId),
      list: () => local.progress.list(),
      async save(progress) {
        await local.progress.save(progress);
        upload(() => cloud.saveProgress([progress]));
      },
      async remove(videoId) {
        await local.progress.remove(videoId);
        upload(() => cloud.removeProgress(videoId));
      },
    },
    rewards: {
      // The wallet belongs to the paused aquarium (docs/decisions.md D14).
      getWallet: () => local.rewards.getWallet(),
      saveWallet: (wallet) => local.rewards.saveWallet(wallet),
      getActivity: () => local.rewards.getActivity(),
      async saveActivity(activity) {
        await local.rewards.saveActivity(activity);
        upload(() => cloud.saveActivity(activity));
      },
    },
  };
}
