import { parseVideo, type Video } from "@/lib/videos";
import sintel from "./sintel.json";
import tearsOfSteel1 from "./tears-of-steel-1.json";
import tearsOfSteel2 from "./tears-of-steel-2.json";
import tearsOfSteel3 from "./tears-of-steel-3.json";
import tearsOfSteelFull from "./tears-of-steel-full.json";

/**
 * Every published video, in library order. Imported statically so the JSON
 * ships with the build, and validated at import so a bad file fails the
 * build instead of a page. tests/videos.test.ts checks that every JSON file
 * in this folder is listed here.
 */
export const videos: readonly Video[] = [
  sintel,
  tearsOfSteel1,
  tearsOfSteel2,
  tearsOfSteel3,
  tearsOfSteelFull,
].map(parseVideo);
