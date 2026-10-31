// Imports carry .ts so scripts/new-video.mts can run this with plain Node.
import { TODO_ZH, type Attribution, type Video } from "./videos.ts";

type VideoMeta = Pick<
  Video,
  "id" | "youtubeId" | "title" | "level" | "category" | "collection" | "source"
> & {
  attribution: Attribution;
};

/** What scripts/new-video.mts needs besides a text file of sentences. */
export type DraftMeta = VideoMeta & {
  /** The excerpt, in seconds: first sentence starts, last one ends. */
  from: number;
  to: number;
};

/**
 * What scripts/new-video.mts needs besides subtitles: an .srt file or a
 * transcript copied from YouTube ("Show transcript").
 */
export type SrtDraftMeta = VideoMeta & {
  /** The excerpt, by subtitle number (inclusive), minus any to skip. */
  cues: CueRange;
};

export type CueRange = {
  from: number;
  to: number;
  /** Subtitles to leave out (e.g. rude words, screams). */
  skip?: number[];
  /** Runs of subtitles [first, last] that make one sentence. */
  merge?: [number, number][];
};

/** One subtitle from an .srt file; times in seconds. */
export type SrtCue = {
  index: number;
  start: number;
  end: number;
  text: string;
};

type TimedLine = { start: number; end: number; en: string };

const round = (seconds: number) => Math.round(seconds * 100) / 100;

/**
 * Rough times for sentences spoken between `from` and `to`, shared out by
 * word count with a short pause between sentences. Good enough to find
 * each line; the timing tool's tap mode makes them exact.
 */
export function estimateTimes(
  lines: readonly string[],
  from: number,
  to: number,
): { start: number; end: number }[] {
  const PAUSE = 0.3;
  const words = lines.map((line) =>
    Math.max(1, line.trim().split(/\s+/).length),
  );
  const total = words.reduce((sum, n) => sum + n, 0);
  const speaking = Math.max(0, to - from - PAUSE * (lines.length - 1));
  let at = from;
  return words.map((n) => {
    const start = at;
    const end = start + (speaking * n) / total;
    at = end + PAUSE;
    return { start: round(start), end: round(end) };
  });
}

/**
 * A draft video from its metadata and one English sentence per line:
 * estimated times, TODO_ZH Chinese, no vocab or grammar yet.
 */
export function draftVideo(meta: DraftMeta, lines: readonly string[]): Video {
  const sentences = lines.map((line) => line.trim()).filter(Boolean);
  const times = estimateTimes(sentences, meta.from, meta.to);
  return buildDraft(
    meta,
    sentences.map((en, i) => ({ ...times[i], en })),
  );
}

/**
 * A draft video from official subtitles: the chosen cues' text and times
 * as they are, TODO_ZH Chinese, no vocab or grammar yet.
 */
export function draftVideoFromCues(
  meta: SrtDraftMeta,
  cues: readonly SrtCue[],
): Video {
  return buildDraft(meta, cuesToLines(cues, meta.cues));
}

function buildDraft(meta: VideoMeta, lines: readonly TimedLine[]): Video {
  return {
    id: meta.id,
    youtubeId: meta.youtubeId,
    title: meta.title,
    level: meta.level,
    category: meta.category,
    collection: meta.collection,
    source: meta.source,
    attribution: meta.attribution,
    draft: true,
    sentences: lines.map(({ start, end, en }, i) => ({
      i,
      start,
      end,
      en,
      zh: TODO_ZH,
    })),
    vocab: [],
    grammar: [],
  };
}

/**
 * Subtitles from an .srt file. A cue's lines join into one sentence; a
 * byte-order mark and Windows line endings are fine.
 */
export function parseSrt(text: string): SrtCue[] {
  const TIME = /(\d+):(\d{2}):(\d{2})[,.](\d{3})/;
  const seconds = (stamp: string) => {
    const match = TIME.exec(stamp);
    if (!match) throw new Error(`Bad .srt time: ${stamp}`);
    const [, h, m, s, ms] = match.map(Number);
    return round(h * 3600 + m * 60 + s + ms / 1000);
  };
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim().split("\n"))
    .filter((lines) => lines.length >= 3)
    .map(([index, times, ...lines]) => {
      const [from, to] = times.split("-->");
      if (to === undefined) throw new Error(`Bad .srt times: ${times}`);
      return {
        index: Number(index),
        start: seconds(from),
        end: seconds(to),
        text: lines.map((line) => line.trim()).join(" "),
      };
    });
}

/**
 * Subtitles merged into one sentence may pause at most this long (seconds)
 * between them; a longer pause would play as silence inside one sentence,
 * so it becomes two sentences instead (docs/content-workflow.md).
 */
export const MAX_MERGE_GAP = 2;

/**
 * The cues numbered `from` to `to`, minus `skip`, as timed sentences; each
 * `merge` run becomes one sentence (first start, last end, text joined).
 * Throws on a range, skip, or merge that doesn't match the file, so a typo
 * in meta.json can't quietly drop or add a line, and on a merge that
 * pauses longer than MAX_MERGE_GAP.
 */
export function cuesToLines(
  cues: readonly SrtCue[],
  { from, to, skip = [], merge = [] }: CueRange,
): TimedLine[] {
  const byIndex = new Map(cues.map((cue) => [cue.index, cue]));
  const inRange = (n: number) => n >= from && n <= to;
  for (const n of skip) {
    if (!inRange(n)) throw new Error(`skip ${n} is outside ${from}–${to}`);
  }
  for (const [first, last] of merge) {
    if (!inRange(first) || !inRange(last) || last <= first) {
      throw new Error(
        `merge ${first}–${last} is not a run inside ${from}–${to}`,
      );
    }
    for (let n = first; n <= last; n++) {
      if (skip.includes(n)) throw new Error(`${n} is both merged and skipped`);
    }
  }
  const lines: TimedLine[] = [];
  for (let n = from; n <= to; n++) {
    const cue = byIndex.get(n);
    if (!cue) throw new Error(`No subtitle number ${n}`);
    if (skip.includes(n)) continue;
    const run = merge.find(([first, last]) => n >= first && n <= last);
    if (run && n !== run[0]) {
      const line = lines[lines.length - 1];
      const gap = round(cue.start - line.end);
      if (gap > MAX_MERGE_GAP) {
        throw new Error(
          `merge ${run[0]}–${run[1]} pauses ${gap} s before ${n} ` +
            `(over ${MAX_MERGE_GAP} s); split it into two sentences`,
        );
      }
      line.end = cue.end;
      line.en = `${line.en} ${cue.text}`;
      continue;
    }
    lines.push({ start: cue.start, end: cue.end, en: cue.text });
  }
  if (lines.length === 0) throw new Error("No subtitles left to use");
  return lines;
}

/** Same as TAP_GAP (lib/player/tap-timing.ts): a line ends this long before the next. */
export const TRANSCRIPT_GAP = 0.1;

/** Seconds per word for the last line, whose end a transcript doesn't give. */
const LAST_LINE_WORD_SECONDS = 0.4;

const TIMESTAMP = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\s+(.*))?$/;
// Screen-reader labels some copies include under a time ("5 seconds",
// "1 minute, 5 seconds", "5 秒", "1 分鐘 5 秒").
const DURATION_LABEL =
  /^(?:\d+\s*(?:hours?|minutes?|seconds?|小時|分鐘|分|秒鐘|秒)[,、，\s]*)+$/i;

/** Whether text looks like a YouTube transcript (it starts with a time). */
export function isYouTubeTranscript(text: string): boolean {
  const first = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim() !== "");
  return first !== undefined && TIMESTAMP.test(first.trim());
}

/**
 * Lines from a transcript copied out of YouTube's "Show transcript" panel:
 * a time ("0:05" or "1:02:03") on its own line or before the text, then the
 * text (several lines join). Numbered from 1 like .srt cues. A transcript
 * only has start times, so each line ends TRANSCRIPT_GAP before the next;
 * the last one gets an estimate by word count (tap mode makes it exact).
 */
export function parseYouTubeTranscript(text: string): SrtCue[] {
  const lines: { start: number; text: string[] }[] = [];
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    const time = TIMESTAMP.exec(line);
    if (time) {
      const [, h = "0", m, sec, rest] = time;
      lines.push({
        start: Number(h) * 3600 + Number(m) * 60 + Number(sec),
        text: rest ? [rest.trim()] : [],
      });
      continue;
    }
    if (DURATION_LABEL.test(line)) continue;
    if (lines.length === 0)
      throw new Error(`Text before the first time: ${line}`);
    lines[lines.length - 1].text.push(line);
  }
  return lines
    .filter((line) => line.text.length > 0)
    .map((line, i, all) => {
      const en = line.text.join(" ");
      const next = all[i + 1];
      const end = next
        ? next.start - TRANSCRIPT_GAP
        : line.start +
          Math.max(1, en.split(/\s+/).length * LAST_LINE_WORD_SECONDS);
      return {
        index: i + 1,
        start: round(line.start),
        end: round(Math.max(line.start, end)),
        text: en,
      };
    });
}

/** "voa-lesson-7" → "voaLesson7", a name for the JSON import. */
export function importName(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * data/videos/index.ts with the video imported and appended to the list
 * (unchanged if it's already there).
 */
export function addToIndex(source: string, id: string): string {
  const name = importName(id);
  if (source.includes(`./${id}.json"`)) return source;
  const imports = [
    ...source.matchAll(/^import \w+ from "\.\/[\w-]+\.json";$/gm),
  ];
  const last = imports.at(-1);
  if (!last || last.index === undefined) {
    throw new Error("data/videos/index.ts: no JSON imports found");
  }
  const after = last.index + last[0].length;
  const withImport = `${source.slice(0, after)}\nimport ${name} from "./${id}.json";${source.slice(after)}`;
  return withImport.replace(
    /\[([^\]]*)\]\.map\(parseVideo\)/,
    (_, list: string) =>
      `[${list.trim().replace(/,\s*$/, "")}, ${name}].map(parseVideo)`,
  );
}
