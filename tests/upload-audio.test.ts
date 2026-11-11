import { describe, expect, it } from "vitest";
import { can } from "@/lib/plans";
import {
  encodeWav,
  findSpeechSegments,
  formatSeconds,
  heardSentences,
  isUploadFile,
  parseSeconds,
  segmentBatches,
  sliceSamples,
  UPLOAD_LIMITS,
  uploadLimits,
} from "@/lib/upload-audio";

const RATE = 16_000;

/** A recording: [seconds, loud?] parts, with a little background noise. */
function recording(parts: [number, boolean][]): Float32Array {
  const total = parts.reduce((sum, [seconds]) => sum + seconds, 0);
  const samples = new Float32Array(Math.round(total * RATE));
  let at = 0;
  let seed = 1;
  for (const [seconds, loud] of parts) {
    const end = at + Math.round(seconds * RATE);
    for (let i = at; i < end; i++) {
      seed = (seed * 16807) % 2147483647;
      const noise = (seed / 2147483647 - 0.5) * 0.004;
      samples[i] =
        noise + (loud ? 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE) : 0);
    }
    at = end;
  }
  return samples;
}

describe("uploaded recordings (D130)", () => {
  it("accepts MP3 and MP4, by type or by name", () => {
    expect(isUploadFile({ name: "talk.mp3", type: "audio/mpeg" })).toBe(true);
    expect(isUploadFile({ name: "clip.mp4", type: "video/mp4" })).toBe(true);
    expect(isUploadFile({ name: "voice.m4a", type: "audio/mp4" })).toBe(true);
    expect(isUploadFile({ name: "talk.MP3", type: "" })).toBe(true);
    expect(isUploadFile({ name: "talk.wav", type: "audio/wav" })).toBe(false);
    expect(isUploadFile({ name: "movie.mov", type: "video/quicktime" })).toBe(
      false,
    );
  });

  it("is Plus and up, each plan with its own file size and length", () => {
    expect(can("free", { kind: "upload-audio" })).toEqual({
      ok: false,
      limit: "uploadAudio",
    });
    expect(can("paid", { kind: "upload-audio", bytes: 50e6 }).ok).toBe(true);
    expect(
      can("paid", { kind: "upload-audio", bytes: 101 * 1024 * 1024 }),
    ).toEqual({
      ok: false,
      limit: "uploadMegabytes",
      max: 100,
    });
    expect(can("admin", { kind: "upload-audio", bytes: 400e6 }).ok).toBe(true);
    expect(uploadLimits("paid")).toEqual({
      bytes: 100 * 1024 * 1024,
      seconds: 300,
    });
    expect(uploadLimits("pro")).toEqual({
      bytes: 200 * 1024 * 1024,
      seconds: 600,
    });
    // Admins: the technical caps.
    expect(uploadLimits("admin")).toEqual({
      bytes: UPLOAD_LIMITS.sourceBytes,
      seconds: UPLOAD_LIMITS.seconds,
    });
    // The stored MP3 stays under Supabase's 50 MB single-file limit.
    expect(UPLOAD_LIMITS.storedBytes).toBeLessThanOrEqual(50 * 1024 * 1024);
    const mp3Bytes =
      (UPLOAD_LIMITS.seconds * UPLOAD_LIMITS.bitRateKbps * 1000) / 8;
    expect(mp3Bytes).toBeLessThan(UPLOAD_LIMITS.storedBytes);
  });

  it("finds where someone speaks, split at pauses", () => {
    const samples = recording([
      [0.5, false],
      [1.2, true],
      [0.8, false],
      [2, true],
      [1, false],
    ]);
    const segments = findSpeechSegments(samples, RATE);
    expect(segments).toHaveLength(2);
    expect(segments[0].start).toBeCloseTo(0.35, 1);
    expect(segments[0].end).toBeCloseTo(1.85, 1);
    expect(segments[1].start).toBeCloseTo(2.35, 1);
    expect(segments[1].end).toBeCloseTo(4.65, 1);
  });

  it("keeps a short pause inside a piece, and skips clicks", () => {
    const samples = recording([
      [0.5, false],
      [1, true],
      [0.2, false],
      [1, true],
      [1, false],
      [0.1, true],
      [1, false],
    ]);
    const segments = findSpeechSegments(samples, RATE);
    expect(segments).toHaveLength(1);
    expect(segments[0].end - segments[0].start).toBeGreaterThan(2);
  });

  it("cuts speech that runs on into pieces the recognizer takes", () => {
    const samples = recording([[40, true]]);
    const segments = findSpeechSegments(samples, RATE);
    expect(segments.length).toBeGreaterThanOrEqual(3);
    for (const segment of segments) {
      expect(segment.end - segment.start).toBeLessThanOrEqual(
        UPLOAD_LIMITS.segmentSeconds + 0.4,
      );
    }
    // Together they cover it all, in order, without overlapping.
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].start).toBeGreaterThanOrEqual(segments[i - 1].end);
    }
  });

  it("finds nothing in silence", () => {
    expect(findSpeechSegments(new Float32Array(RATE * 3), RATE)).toEqual([]);
    expect(findSpeechSegments(recording([[3, false]]), RATE)).toEqual([]);
  });

  it("writes 16 kHz mono 16-bit WAV for the recognizer", () => {
    const samples = new Float32Array([0, 1, -1, 0.5, 2]);
    const wav = encodeWav(samples, RATE);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.subarray(8, 12))).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(RATE);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(10);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
    // Out of range is clipped.
    expect(view.getInt16(52, true)).toBe(32767);
    const piece = sliceSamples(new Float32Array(RATE * 2), RATE, {
      start: 0.5,
      end: 1.5,
    });
    expect(piece.length).toBe(RATE);
  });

  it("sends at most 25 s and 12 pieces a request", () => {
    const pieces = Array.from({ length: 30 }, (_, i) => ({
      start: i * 2,
      end: i * 2 + 1,
    }));
    const batches = segmentBatches(pieces);
    expect(batches.map((b) => b.length)).toEqual([12, 12, 6]);
    const long = [
      { start: 0, end: 14 },
      { start: 15, end: 29 },
      { start: 30, end: 31 },
    ];
    expect(segmentBatches(long).map((b) => b.length)).toEqual([1, 2]);
  });

  it("turns what was heard into sentences with times", () => {
    const sentences = heardSentences([
      // Two sentences in one piece share it by their length.
      {
        start: 1,
        end: 7,
        text: "Good morning everyone. Today we talk about sleep.",
      },
      // Pieces without an end of sentence join the next.
      { start: 7.5, end: 9, text: "Most adults need" },
      { start: 9.2, end: 11, text: "7 to 9 hours a night." },
      { start: 12, end: 13, text: "" },
    ]);
    expect(sentences.map((s) => s.en)).toEqual([
      "Good morning everyone.",
      "Today we talk about sleep.",
      "Most adults need 7 to 9 hours a night.",
    ]);
    expect(sentences[0].start).toBe(1);
    expect(sentences[0].end).toBeCloseTo(3.75, 2);
    expect(sentences[1].start).toBeCloseTo(3.75, 2);
    expect(sentences[1].end).toBe(7);
    expect(sentences[2]).toMatchObject({ start: 7.5, end: 11 });
  });

  it("reads and writes times as minutes:seconds", () => {
    expect(formatSeconds(65.3)).toBe("1:05.3");
    expect(formatSeconds(4)).toBe("0:04.0");
    expect(parseSeconds("1:05.3")).toBe(65.3);
    expect(parseSeconds("65.25")).toBe(65.25);
    expect(parseSeconds(" 2:00 ")).toBe(120);
    expect(parseSeconds("1:75")).toBeNull();
    expect(parseSeconds("abc")).toBeNull();
    expect(parseSeconds("")).toBeNull();
  });
});
