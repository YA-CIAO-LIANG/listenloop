import { videos } from "@/data/videos";
import type { Video } from "./videos";

/** Every published video, in library order (drafts are left out). */
export function getAllVideos(): readonly Video[] {
  return videos.filter((video) => !video.draft);
}

/** A published video, or undefined (drafts answer 404 like unknown ids). */
export function getVideo(id: string): Video | undefined {
  return getAllVideos().find((video) => video.id === id);
}

/** Any video, drafts too: only for the timing tool, where drafts get tuned. */
export function getVideoIncludingDrafts(id: string): Video | undefined {
  return videos.find((video) => video.id === id);
}
