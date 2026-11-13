import type { MarketingDoc } from "../docx-builder.mts";
import { beta } from "./beta.mts";
import { brand } from "./brand.mts";
import { forums } from "./forums.mts";
import { launchPlan } from "./launch-plan.mts";
import { partnerships } from "./partnerships.mts";
import { playStore } from "./play-store.mts";
import { pressKit } from "./press-kit.mts";
import { shortVideos } from "./short-videos.mts";
import { social } from "./social.mts";

/** Every marketing document, in the order of marketing/word/README.md. */
export const documents: readonly MarketingDoc[] = [
  brand,
  launchPlan,
  social,
  shortVideos,
  forums,
  partnerships,
  pressKit,
  beta,
  playStore,
];
