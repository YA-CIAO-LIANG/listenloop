import { videos } from "@/data/videos";
import { videoCollections, type Video, type VideoCollection } from "./videos";

/** Every published video, in library order (drafts are left out). */
export function getAllVideos(): readonly Video[] {
  return videos.filter((video) => !video.draft);
}

/**
 * The library grouped by collection: collections in videoCollections order
 * (empty ones left out), videos in library order within each.
 */
export function getVideosByCollection(): {
  collection: VideoCollection;
  videos: Video[];
}[] {
  const all = getAllVideos();
  return videoCollections
    .map((collection) => ({
      collection,
      videos: all.filter((video) => video.collection === collection),
    }))
    .filter((group) => group.videos.length > 0);
}

/** A published video, or undefined (drafts answer 404 like unknown ids). */
export function getVideo(id: string): Video | undefined {
  return getAllVideos().find((video) => video.id === id);
}

/** Any video, drafts too: only for the timing tool, where drafts get tuned. */
export function getVideoIncludingDrafts(id: string): Video | undefined {
  return videos.find((video) => video.id === id);
}
