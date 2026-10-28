/**
 * Creates a draft video from metadata and its English sentences:
 *
 *   npm run video:new -- <meta.json> <sentences.txt>
 *
 * meta.json: id, youtubeId, title, level, category, source, attribution,
 * from, to (see lib/draft-video.ts → DraftMeta). sentences.txt: one English
 * sentence per line. Writes data/videos/<id>.json (draft: true, estimated
 * times, Chinese to do), lists it in data/videos/index.ts, and validates
 * it. Next: write the Chinese, vocab, and grammar; tune times with tap mode
 * at /videos/<id>/timing (docs/content-workflow.md).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { addToIndex, draftVideo, type DraftMeta } from "../lib/draft-video.ts";
import { validateVideo } from "../lib/videos.ts";

const [metaPath, linesPath] = process.argv.slice(2);
if (!metaPath || !linesPath) {
  console.error("Usage: npm run video:new -- <meta.json> <sentences.txt>");
  process.exit(1);
}

const meta = JSON.parse(readFileSync(metaPath, "utf8")) as DraftMeta;
const lines = readFileSync(linesPath, "utf8").split("\n");
const video = draftVideo(meta, lines);

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
