import { parseVideo, type Video } from "@/lib/videos";
import sintel from "./sintel.json";
import voaLesson6 from "./voa-lesson-6.json";
import voaLesson7 from "./voa-lesson-7.json";
import voaLesson8 from "./voa-lesson-8.json";
import voaLesson10 from "./voa-lesson-10.json";
import voaLesson12 from "./voa-lesson-12.json";

/**
 * Every published video, in library order. Imported statically so the JSON
 * ships with the build, and validated at import so a bad file fails the
 * build instead of a page. tests/videos.test.ts checks that every JSON file
 * in this folder is listed here.
 */
export const videos: readonly Video[] = [
  sintel,
  voaLesson6,
  voaLesson7,
  voaLesson8,
  voaLesson10,
  voaLesson12,
].map(parseVideo);
