import { videos } from "@/data/videos";
import type { Video } from "./videos";

export function getAllVideos(): readonly Video[] {
  return videos;
}

export function getVideo(id: string): Video | undefined {
  return videos.find((video) => video.id === id);
}
