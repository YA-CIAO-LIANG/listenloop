import { parseProgress, type Progress } from "../progress";
import type { ProgressStore } from "./progress-store";

/** Versioned so a future format change can migrate or ignore old data. */
export const PROGRESS_KEY_PREFIX = "ll-progress:v1:";

const keyFor = (videoId: string) => `${PROGRESS_KEY_PREFIX}${videoId}`;

/**
 * ProgressStore backed by Web Storage. `getStorage` is a function so the
 * store can be created during server rendering and only touch localStorage
 * when used in the browser; tests pass an in-memory Storage.
 */
export function createLocalProgressStore(
  getStorage: () => Storage = () => window.localStorage,
): ProgressStore {
  function read(videoId: string): Progress | null {
    try {
      const raw = getStorage().getItem(keyFor(videoId));
      const progress = raw === null ? null : parseProgress(JSON.parse(raw));
      // Data copied under the wrong key doesn't belong to this video.
      return progress?.videoId === videoId ? progress : null;
    } catch {
      // Blocked storage or corrupted JSON: behave as if there's no progress.
      return null;
    }
  }

  return {
    async get(videoId) {
      return read(videoId);
    },

    async save(progress) {
      getStorage().setItem(keyFor(progress.videoId), JSON.stringify(progress));
    },

    async list() {
      const storage = getStorage();
      const videoIds = Array.from({ length: storage.length }, (_, i) =>
        storage.key(i),
      )
        .filter((key): key is string => !!key?.startsWith(PROGRESS_KEY_PREFIX))
        .map((key) => key.slice(PROGRESS_KEY_PREFIX.length));
      return videoIds
        .map(read)
        .filter((progress): progress is Progress => progress !== null);
    },

    async remove(videoId) {
      getStorage().removeItem(keyFor(videoId));
    },
  };
}
