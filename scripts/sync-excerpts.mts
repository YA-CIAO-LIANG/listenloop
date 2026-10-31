/**
 * Copies each excerpt's sentences (English, Chinese, times) from its source
 * video, so tuning the source in /videos/<id>/timing is enough:
 *
 *   npm run video:sync
 *
 * An excerpt is a video with excerptOf: { video, from } (lib/videos.ts);
 * it keeps its own sentence count, vocab, and grammar. Rewrites only the
 * files that change, then checks every excerpt (excerptProblems).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  excerptProblems,
  excerptSentences,
  parseVideo,
  type Video,
} from "../lib/videos.ts";

const dir = join(process.cwd(), "data/videos");
const files = readdirSync(dir).filter((file) => file.endsWith(".json"));
const videos = new Map<string, { file: string; video: Video }>();
for (const file of files) {
  const video = parseVideo(JSON.parse(readFileSync(join(dir, file), "utf8")));
  videos.set(video.id, { file, video });
}

let changed = 0;
for (const { file, video } of videos.values()) {
  if (!video.excerptOf) continue;
  const source = videos.get(video.excerptOf.video)?.video;
  const sentences = source && excerptSentences(video, video.excerptOf, source);
  if (!sentences) continue; // reported by excerptProblems below
  if (JSON.stringify(sentences) === JSON.stringify(video.sentences)) continue;
  video.sentences = sentences;
  writeFileSync(join(dir, file), `${JSON.stringify(video, null, 2)}\n`);
  console.log(`Updated ${video.id} from ${video.excerptOf.video}.`);
  changed++;
}

const problems = excerptProblems(
  [...videos.values()].map(({ video }) => video),
);
if (problems.length > 0) {
  console.error(`Excerpts out of sync:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(changed === 0 ? "Excerpts already in sync." : "Excerpts in sync.");
