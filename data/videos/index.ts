import { parseVideo, type Video } from "@/lib/videos";
import sintel from "./sintel.json";

/**
 * Every published video, in library order. Imported statically so the JSON
 * ships with the build, and validated at import so a bad file fails the
 * build instead of a page. tests/videos.test.ts checks that every JSON file
 * in this folder is listed here.
 */
export const videos: readonly Video[] = [sintel].map(parseVideo);
