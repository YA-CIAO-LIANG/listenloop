"use client";

import { YouTubeFrame } from "@/components/youtube/YouTubeFrame";
import { useYouTubePlayer } from "@/components/youtube/useYouTubePlayer";

/** Full video with YouTube's own controls (overview page). */
export function VideoPlayerPanel({ youtubeId }: { youtubeId: string }) {
  const player = useYouTubePlayer(youtubeId);
  return <YouTubeFrame {...player} />;
}
