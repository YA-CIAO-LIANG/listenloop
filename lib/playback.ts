import { DEFAULT_SPEED, isSpeed, type Speed } from "./speed";

/**
 * How sentences play, set once and kept everywhere (D220): in listening's
 * dictation, shadowing, and listening mode, and in WritingLoop's days
 * 2–6. A personal setting (lib/personal-settings.ts): in this browser,
 * and in the account when signed in. Listening mode's subtitles and loop
 * keep their own setting (ll-listen:v1, D135), and dictation's loop
 * switch its own (ll-loop:v1, D90); both are personal settings too.
 */
export const PLAYBACK_KEY = "ll-playback:v1";

/** Times a sentence plays when it arrives. */
export const REPEATS = [1, 2, 3] as const;
export type Repeats = (typeof REPEATS)[number];

/** Seconds between plays (repeats and loop). */
export const GAPS = [1, 1.5, 2, 3, 5] as const;
export type Gap = (typeof GAPS)[number];

/** WritingLoop's sentence voice (lib/writing/audio.ts). */
export const PLAYBACK_VOICES = ["female", "male"] as const;
export type PlaybackVoice = (typeof PLAYBACK_VOICES)[number];

export type Playback = {
  repeats: Repeats;
  gap: Gap;
  /** Audio practices and writing sentences (YouTube stays at 1×). */
  speed: Speed;
  /** A sentence plays by itself when it arrives. */
  autoplay: boolean;
  voice: PlaybackVoice;
  /** Writing's loop switch (replay until checked). */
  loop: boolean;
};

export const DEFAULT_PLAYBACK: Playback = {
  repeats: 1,
  gap: 1.5,
  speed: DEFAULT_SPEED,
  autoplay: true,
  voice: "female",
  loop: false,
};

const pick = <T>(list: readonly T[], value: unknown, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

export function parsePlayback(raw: string | null): Playback {
  let v: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw ?? "{}") as unknown;
    if (parsed && typeof parsed === "object") {
      v = parsed as Record<string, unknown>;
    }
  } catch {
    // Unreadable: the defaults.
  }
  return {
    repeats: pick(REPEATS, v.repeats, DEFAULT_PLAYBACK.repeats),
    gap: pick(GAPS, v.gap, DEFAULT_PLAYBACK.gap),
    speed: isSpeed(v.speed) ? v.speed : DEFAULT_PLAYBACK.speed,
    autoplay: v.autoplay !== false,
    voice: pick(PLAYBACK_VOICES, v.voice, DEFAULT_PLAYBACK.voice),
    loop: v.loop === true,
  };
}
