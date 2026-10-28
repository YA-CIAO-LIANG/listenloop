// Imports carry .ts so scripts/new-video.mts can run this with plain Node.
import { TODO_ZH, type Attribution, type Video } from "./videos.ts";

/** What scripts/new-video.mts needs besides the sentences. */
export type DraftMeta = Pick<
  Video,
  "id" | "youtubeId" | "title" | "level" | "category" | "source"
> & {
  attribution: Attribution;
  /** The excerpt, in seconds: first sentence starts, last one ends. */
  from: number;
  to: number;
};

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
  return {
    id: meta.id,
    youtubeId: meta.youtubeId,
    title: meta.title,
    level: meta.level,
    category: meta.category,
    source: meta.source,
    attribution: meta.attribution,
    draft: true,
    sentences: sentences.map((en, i) => ({
      i,
      ...times[i],
      en,
      zh: TODO_ZH,
    })),
    vocab: [],
    grammar: [],
  };
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
