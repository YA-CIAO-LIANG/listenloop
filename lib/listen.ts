/**
 * Listening mode (D135): listen to the whole text without a test, after
 * Day 1. The pure parts: what to show, what plays next, the three-pass
 * method, and the saved settings.
 */

/** What's shown under the player: nothing, English, both, or Chinese. */
export const SUBTITLE_MODES = ["blind", "en", "both", "zh"] as const;
export type SubtitleMode = (typeof SUBTITLE_MODES)[number];

/** Off, the same sentence again and again, or the whole text again. */
export const LOOP_MODES = ["off", "one", "all"] as const;
export type LoopMode = (typeof LOOP_MODES)[number];

/** The three-pass method: blind, then English, then both. */
export const THREE_PASSES: readonly SubtitleMode[] = ["blind", "en", "both"];

/** A short pause between sentences, so they don't run together. */
export const SENTENCE_GAP_MS = 300;

export const LISTEN_STORAGE_KEY = "ll-listen:v1";

export type ListenSettings = { subtitles: SubtitleMode; loop: LoopMode };

export const DEFAULT_LISTEN_SETTINGS: ListenSettings = {
  subtitles: "both",
  loop: "off",
};

export function parseListenSettings(raw: string | null): ListenSettings {
  try {
    const data = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    return {
      subtitles: (SUBTITLE_MODES as readonly unknown[]).includes(data.subtitles)
        ? (data.subtitles as SubtitleMode)
        : DEFAULT_LISTEN_SETTINGS.subtitles,
      loop: (LOOP_MODES as readonly unknown[]).includes(data.loop)
        ? (data.loop as LoopMode)
        : DEFAULT_LISTEN_SETTINGS.loop,
    };
  } catch {
    return DEFAULT_LISTEN_SETTINGS;
  }
}

/** Where playback goes after sentence `index` ends. */
export type Next =
  { kind: "play"; index: number; pass?: number } | { kind: "stop" };

/**
 * After `index` of `count` ends: the same one again (loop one), the next,
 * back to the start (loop all, or the next of the three passes), or the
 * end. `pass` is the three-pass method's pass (1–3), or null.
 */
export function nextAfter(
  index: number,
  count: number,
  loop: LoopMode,
  pass: number | null,
): Next {
  if (count === 0) return { kind: "stop" };
  if (pass === null && loop === "one") return { kind: "play", index };
  if (index + 1 < count) {
    return pass === null
      ? { kind: "play", index: index + 1 }
      : { kind: "play", index: index + 1, pass };
  }
  if (pass !== null) {
    return pass < THREE_PASSES.length
      ? { kind: "play", index: 0, pass: pass + 1 }
      : { kind: "stop" };
  }
  return loop === "all" ? { kind: "play", index: 0 } : { kind: "stop" };
}

/** What's shown during pass `pass` of the three, or the learner's choice. */
export function shownSubtitles(
  chosen: SubtitleMode,
  pass: number | null,
): SubtitleMode {
  return pass === null ? chosen : THREE_PASSES[pass - 1];
}

/** The sentence a key moves to: ← ↑ back, → ↓ forward, within the text. */
export function stepIndex(index: number, count: number, step: -1 | 1): number {
  return Math.min(Math.max(index + step, 0), Math.max(count - 1, 0));
}
