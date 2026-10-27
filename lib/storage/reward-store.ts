import type { Activity } from "../activity";
import type { Wallet } from "../wallet";

/**
 * Where the wallet and the activity log live. Async like ProgressStore so a
 * future backend can replace localStorage without changing callers.
 */
export interface RewardStore {
  /** An empty wallet when nothing (valid) is saved. */
  getWallet(): Promise<Wallet>;
  /** Rejects if the wallet can't be saved (e.g. storage full or blocked). */
  saveWallet(wallet: Wallet): Promise<void>;
  /** An empty log when nothing (valid) is saved. */
  getActivity(): Promise<Activity>;
  saveActivity(activity: Activity): Promise<void>;
}
