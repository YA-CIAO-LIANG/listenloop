/**
 * Hands-free practice (D125): after one tap on "Start practice", sentences
 * play by themselves; shadowing listens after each one, moves on when it
 * passes, and plays again when it doesn't. On by default; a per-device
 * choice, since it depends on the device's speakers and microphone.
 */
export const HANDS_FREE_KEY = "ll-hands-free:v1";

/** Waits after a shadowing result before moving on or trying again. */
export const HANDS_FREE_NEXT_MS = 1200;
export const HANDS_FREE_RETRY_MS = 1800;

/** Stored as "off" when turned off; anything else (or nothing) is on. */
export function readHandsFree(
  storage: Pick<Storage, "getItem"> | null,
): boolean {
  try {
    return storage?.getItem(HANDS_FREE_KEY) !== "off";
  } catch {
    return true;
  }
}
