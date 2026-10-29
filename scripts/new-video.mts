/**
 * Creates a draft video from metadata and its English sentences:
 *
 *   npm run video:new -- <meta.json> <subtitles.srt | transcript.txt | sentences.txt> [--transcript]
 *
 * meta.json: id, youtubeId, title, level, category, source, attribution,
 * and then either
 * - for subtitles — an official .srt, or a transcript copied from YouTube's
 *   "Show transcript" (detected when the file starts with a time like
 *   "0:05"; --transcript forces it): cues { from, to, skip?, merge? } —
 *   subtitle numbers; text and times come from the subtitles (SrtDraftMeta);
 * - for sentences.txt (one English sentence per line): from, to — the
 *   excerpt in seconds; times are estimated by word count (DraftMeta).
 * See lib/draft-video.ts. Writes data/videos/<id>.json (draft: true,
 * Chinese to do), lists it in data/videos/index.ts, and validates it.
 * Next: write the Chinese, vocab, and grammar; tune times with tap mode
 * at /videos/<id>/timing (docs/content-workflow.md).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addToIndex,
  draftVideo,
  draftVideoFromCues,
  isYouTubeTranscript,
  parseSrt,
  parseYouTubeTranscript,
  type DraftMeta,
  type SrtDraftMeta,
} from "../lib/draft-video.ts";
import { validateVideo } from "../lib/videos.ts";

const args = process.argv.slice(2);
const forceTranscript = args.includes("--transcript");
const [metaPath, linesPath] = args.filter((arg) => !arg.startsWith("--"));
if (!metaPath || !linesPath) {
  console.error(
    "Usage: npm run video:new -- <meta.json> <subtitles.srt | transcript.txt | sentences.txt> [--transcript]",
  );
  process.exit(1);
}

const meta: unknown = JSON.parse(readFileSync(metaPath, "utf8"));
const text = readFileSync(linesPath, "utf8");
const video = linesPath.toLowerCase().endsWith(".srt")
  ? draftVideoFromCues(meta as SrtDraftMeta, parseSrt(text))
  : forceTranscript || isYouTubeTranscript(text)
    ? draftVideoFromCues(meta as SrtDraftMeta, parseYouTubeTranscript(text))
    : draftVideo(meta as DraftMeta, text.split("\n"));

const problems = validateVideo(video);
if (problems.length > 0) {
  console.error(`Invalid draft:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

const dir = join(process.cwd(), "data/videos");
const file = join(dir, `${video.id}.json`);
if (existsSync(file)) {
  console.error(`${file} already exists; not overwriting.`);
  process.exit(1);
}
writeFileSync(file, `${JSON.stringify(video, null, 2)}\n`);
const index = join(dir, "index.ts");
writeFileSync(index, addToIndex(readFileSync(index, "utf8"), video.id));

console.log(
  `Draft ${video.id}: ${video.sentences.length} sentences, ` +
    `${video.sentences[0].start}s–${video.sentences.at(-1)?.end}s.\n` +
    `Next: Chinese, vocab, grammar; then tap mode at /videos/${video.id}/timing.`,
);
