import type { Progress } from "../progress";

/**
 * Where progress lives. Async on purpose: the MVP uses localStorage
 * (synchronous), but a future backend such as Supabase will not be, and
 * callers shouldn't have to change when it's swapped in.
 */
export interface ProgressStore {
  get(videoId: string): Promise<Progress | null>;
  /** Rejects if the progress can't be saved (e.g. storage full or blocked). */
  save(progress: Progress): Promise<void>;
  list(): Promise<Progress[]>;
  remove(videoId: string): Promise<void>;
}
