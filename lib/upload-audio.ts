import { PLANS, type PlanId } from "./plans";
import { transcriptSentences, type TimedSentence } from "./youtube";

/**
 * Practices from the learner's own recording (D130): an MP3 or an MP4
 * whose sound is taken out in the browser, stored as one small MP3, and
 * written down by speech to text. The pure parts live here: which files
 * are accepted, the limits, finding where speech pauses, WAV for the
 * recognizer, and turning what was heard into practice sentences.
 */

/** What the file picker accepts: MP3, and MP4 (video or audio-only M4A). */
export const UPLOAD_ACCEPT = ".mp3,.mp4,.m4a,audio/mpeg,audio/mp4,video/mp4";

export function isUploadFile(file: { name: string; type: string }): boolean {
  const type = file.type.toLowerCase();
  if (["audio/mpeg", "audio/mp3", "audio/mp4", "video/mp4"].includes(type)) {
    return true;
  }
  // Some systems leave the type empty: go by the name.
  return type === "" && /\.(mp3|mp4|m4a)$/i.test(file.name);
}

/**
 * Whether a file's first bytes are really an MP3 (D159): an ID3 tag, or
 * an MPEG audio frame header (11 sync bits, a real layer and bit rate).
 * The name and the type the browser reports can say anything.
 */
export function looksLikeMp3(head: Uint8Array): boolean {
  if (head.length < 4) return false;
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return true;
  const sync = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
  const version = (head[1] >> 3) & 0b11; // 01 is reserved
  const layer = (head[1] >> 1) & 0b11; // 00 is reserved
  const bitRate = head[2] >> 4; // 1111 is invalid
  const sampleRate = (head[2] >> 2) & 0b11; // 11 is reserved
  return (
    sync &&
    version !== 0b01 &&
    layer !== 0b00 &&
    bitRate !== 0b1111 &&
    sampleRate !== 0b11
  );
}

export const UPLOAD_LIMITS = {
  /**
   * The stored MP3, in bytes: Supabase's single-file upload limit on the
   * free plan is 50 MB (the bucket says the same). At the bit rate below
   * that is over 3 hours, far past any plan's length.
   */
  storedBytes: 50 * 1024 * 1024,
  /** The picked file, for plans without their own cap (admins). */
  sourceBytes: 500 * 1024 * 1024,
  /** The longest recording anyone may upload (admins too): 30 minutes. */
  seconds: 30 * 60,
  /** What's stored and sent to the recognizer: 16 kHz mono. */
  sampleRate: 16_000,
  /** The stored MP3's bit rate: clear speech, ~240 KB a minute. */
  bitRateKbps: 32,
  /** No piece sent to the recognizer is longer (its limit is 60 s). */
  segmentSeconds: 15,
  /** Seconds of audio sent in one request to our server (~800 KB). */
  batchSeconds: 25,
  /** Pieces in one request to our server, at most. */
  batchPieces: 12,
} as const;

/** How big and how long a file this plan may upload. */
export function uploadLimits(plan: PlanId): {
  bytes: number;
  seconds: number;
} {
  const limits = PLANS[plan];
  return {
    bytes:
      limits.uploadMegabytes === null
        ? UPLOAD_LIMITS.sourceBytes
        : limits.uploadMegabytes * 1024 * 1024,
    seconds: Math.min(
      limits.maxPracticeSeconds ?? UPLOAD_LIMITS.seconds,
      UPLOAD_LIMITS.seconds,
    ),
  };
}

/** A stretch of the recording, in seconds. */
export type AudioSegment = { start: number; end: number };

const FRAME_SECONDS = 0.02;
/** A quieter stretch at least this long ends a piece of speech. */
const PAUSE_SECONDS = 0.35;
/** Sounds shorter than this (a click, a breath) aren't speech. */
const MIN_SPEECH_SECONDS = 0.25;
/** Quieter than this (about −50 dBFS) is never speech. */
const MIN_SPEECH_LEVEL = 0.003;
/** Kept around each piece, so no word starts or ends cut off. */
const EDGE_SECONDS = 0.15;

function frameLevels(samples: Float32Array, frame: number): Float32Array {
  const count = Math.ceil(samples.length / frame);
  const levels = new Float32Array(count);
  for (let f = 0; f < count; f++) {
    let sum = 0;
    const end = Math.min(samples.length, (f + 1) * frame);
    for (let i = f * frame; i < end; i++) sum += samples[i] * samples[i];
    levels[f] = Math.sqrt(sum / Math.max(1, end - f * frame));
  }
  return levels;
}

function percentile(values: Float32Array, share: number): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
}

/**
 * Where someone is speaking, from the loudness of each 20 ms: louder
 * than the background (its quiet 10%) by a margin, joined across pauses
 * shorter than PAUSE_SECONDS. A piece longer than `maxSeconds` is cut at
 * its quietest moment in the second half, so each one fits a request.
 */
export function findSpeechSegments(
  samples: Float32Array,
  sampleRate: number,
  maxSeconds: number = UPLOAD_LIMITS.segmentSeconds,
): AudioSegment[] {
  const frame = Math.max(1, Math.round(sampleRate * FRAME_SECONDS));
  const levels = frameLevels(samples, frame);
  if (levels.length === 0) return [];
  const floor = percentile(levels, 0.1);
  const loud = percentile(levels, 0.95);
  // Louder than the background by a margin, but at most half the loudest
  // (a recording with no pauses at all), and never mere hiss.
  const threshold = Math.max(
    Math.min(Math.max(floor * 2.5, floor + (loud - floor) * 0.08), loud * 0.5),
    MIN_SPEECH_LEVEL,
  );
  const seconds = (frames: number) => frames * FRAME_SECONDS;
  const pauseFrames = Math.round(PAUSE_SECONDS / FRAME_SECONDS);

  // Runs of speech frames, joined across short pauses.
  const runs: [number, number][] = [];
  let start = -1;
  let quiet = 0;
  for (let f = 0; f <= levels.length; f++) {
    const speaking = f < levels.length && levels[f] > threshold;
    if (speaking) {
      if (start < 0) start = f;
      quiet = 0;
    } else if (start >= 0) {
      quiet++;
      if (quiet >= pauseFrames || f === levels.length) {
        runs.push([start, f - quiet + 1]);
        start = -1;
        quiet = 0;
      }
    }
  }

  const maxFrames = Math.round(maxSeconds / FRAME_SECONDS);
  const pieces: [number, number][] = [];
  for (const [from, to] of runs) {
    if (seconds(to - from) < MIN_SPEECH_SECONDS) continue;
    let s = from;
    while (to - s > maxFrames) {
      // The quietest frame between half and all of the longest piece.
      let cut = s + maxFrames;
      for (let f = s + Math.floor(maxFrames / 2); f < s + maxFrames; f++) {
        if (levels[f] < levels[cut]) cut = f;
      }
      pieces.push([s, cut]);
      s = cut;
    }
    pieces.push([s, to]);
  }

  const total = samples.length / sampleRate;
  const round = (value: number) => Math.round(value * 100) / 100;
  return pieces.map(([from, to], i) => {
    // Edges grow into the silence, never into the next piece.
    const previousEnd = i > 0 ? seconds(pieces[i - 1][1]) : 0;
    const nextStart = i < pieces.length - 1 ? seconds(pieces[i + 1][0]) : total;
    const startSec = Math.max(previousEnd, seconds(from) - EDGE_SECONDS, 0);
    const endSec = Math.min(nextStart, seconds(to) + EDGE_SECONDS, total);
    // Cut pieces of one long run already touch: keep them as they are.
    return {
      start: round(startSec),
      end: round(Math.max(endSec, startSec + 0.01)),
    };
  });
}

/** The samples between two times. */
export function sliceSamples(
  samples: Float32Array,
  sampleRate: number,
  segment: AudioSegment,
): Float32Array {
  const from = Math.max(0, Math.floor(segment.start * sampleRate));
  const to = Math.min(samples.length, Math.ceil(segment.end * sampleRate));
  return samples.subarray(from, Math.max(from, to));
}

/** 16-bit PCM WAV, mono: the recognizer's short-audio format. */
export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      bytes[offset + i] = text.charCodeAt(i);
    }
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}

/** Pieces grouped so each request carries at most `maxSeconds` of audio. */
export function segmentBatches(
  segments: readonly AudioSegment[],
  maxSeconds: number = UPLOAD_LIMITS.batchSeconds,
  maxPieces: number = UPLOAD_LIMITS.batchPieces,
): AudioSegment[][] {
  const batches: AudioSegment[][] = [];
  let current: AudioSegment[] = [];
  let seconds = 0;
  for (const segment of segments) {
    const length = segment.end - segment.start;
    if (
      current.length > 0 &&
      (seconds + length > maxSeconds || current.length >= maxPieces)
    ) {
      batches.push(current);
      current = [];
      seconds = 0;
    }
    current.push(segment);
    seconds += length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** What the recognizer heard in one piece, where the piece is. */
export type HeardSegment = AudioSegment & { text: string };

/**
 * Practice sentences from what was heard: a piece holding several
 * sentences is shared out by their length (the learner can adjust the
 * times in the preview), then pieces join into sentences the way
 * captions do (lib/youtube.ts transcriptSentences).
 */
export function heardSentences(
  heard: readonly HeardSegment[],
): TimedSentence[] {
  const cues = heard.flatMap((piece) => {
    const text = piece.text.replace(/\s+/g, " ").trim();
    if (!text) return [];
    const parts = text.split(/(?<=[.!?]["”’)]?)\s+(?=\S)/);
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const length = piece.end - piece.start;
    let at = piece.start;
    return parts.map((part) => {
      const start = at;
      at += (length * part.length) / total;
      return { start, end: at, text: part };
    });
  });
  return transcriptSentences(cues.map((cue, i) => ({ ...cue, index: i })));
}

/** "1:05.3" for 65.3 seconds: how the preview shows and reads times. */
export function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}

/** The seconds in "1:05.3", "65.3", or "1:05"; null if not a time. */
export function parseSeconds(text: string): number | null {
  const match = /^\s*(?:(\d{1,3}):)?(\d{1,4}(?:\.\d{1,2})?)\s*$/.exec(text);
  if (!match) return null;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  if (match[1] !== undefined && seconds >= 60) return null;
  return Math.round((minutes * 60 + seconds) * 100) / 100;
}
