import { ACCOUNT_KEY } from "../sync/sync";
import { PROGRESS_KEY_PREFIX } from "./local-progress-store";
import { ACTIVITY_KEY, WALLET_KEY } from "./local-reward-store";

/**
 * Removes every piece of practice data from this browser (after deleting
 * the account): progress for each video, the activity log, the wallet,
 * and which account the data belonged to. Preferences such as the theme
 * stay. Blocked storage is ignored: there's nothing to remove.
 */
export function clearPracticeData(storage: Storage): void {
  try {
    const keys = Array.from({ length: storage.length }, (_, i) =>
      storage.key(i),
    ).filter(
      (key): key is string =>
        key !== null &&
        (key.startsWith(PROGRESS_KEY_PREFIX) ||
          [ACTIVITY_KEY, WALLET_KEY, ACCOUNT_KEY].includes(key)),
    );
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage blocked: nothing was saved here.
  }
}
