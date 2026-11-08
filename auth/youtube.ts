import {
  parseIsoDuration,
  type YouTubeLicense,
  type YouTubeVideoInfo,
} from "@/lib/youtube";

/**
 * Reading a video's details for a YouTube practice (D97), from the
 * YouTube Data API v3 (`videos.list`, 1 quota unit a call, no charge). It
 * needs YOUTUBE_API_KEY; without it the feature is hidden. Tests and the
 * E2E build use the fake (YOUTUBE_PROVIDER=fake): no network.
 */
export type YouTubeLookup = (id: string) => Promise<YouTubeVideoInfo | null>;

/** Videos the fake knows: a Creative Commons one and a standard one. */
export const FAKE_VIDEOS: Record<string, YouTubeVideoInfo> = {
  ccVideo0001: {
    id: "ccVideo0001",
    title: "Open Lecture: How Sleep Works",
    channel: "Open Science Channel",
    license: "creativeCommon",
    durationSeconds: 300,
    embeddable: true,
  },
  stdVideo001: {
    id: "stdVideo001",
    title: "A Day in My Life",
    channel: "Some Vlogger",
    license: "youtube",
    durationSeconds: 600,
    embeddable: true,
  },
  noEmbed0001: {
    id: "noEmbed0001",
    title: "Music Video",
    channel: "Label",
    license: "youtube",
    durationSeconds: 200,
    embeddable: false,
  },
};

export function youtubeEnabled(): boolean {
  return (
    process.env.YOUTUBE_PROVIDER === "fake" || !!process.env.YOUTUBE_API_KEY
  );
}

type ApiVideo = {
  id?: string;
  snippet?: { title?: string; channelTitle?: string };
  status?: { license?: string; embeddable?: boolean; privacyStatus?: string };
  contentDetails?: { duration?: string };
};

/** One video from a videos.list answer, or null if it's not usable. */
export function videoFromApi(
  item: ApiVideo | undefined,
): YouTubeVideoInfo | null {
  if (!item?.id || !item.snippet?.title) return null;
  if (item.status?.privacyStatus === "private") return null;
  const duration = parseIsoDuration(item.contentDetails?.duration ?? "");
  if (duration === null) return null;
  const license: YouTubeLicense =
    item.status?.license === "creativeCommon" ? "creativeCommon" : "youtube";
  return {
    id: item.id,
    title: item.snippet.title.slice(0, 200),
    channel: (item.snippet.channelTitle ?? "").slice(0, 200),
    license,
    durationSeconds: duration,
    embeddable: item.status?.embeddable !== false,
  };
}

export function getYouTubeLookup(
  fetchImpl: typeof fetch = fetch,
): YouTubeLookup | null {
  if (process.env.YOUTUBE_PROVIDER === "fake") {
    return async (id) => FAKE_VIDEOS[id] ?? null;
  }
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  return async (id) => {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,status,contentDetails");
    url.searchParams.set("id", id);
    url.searchParams.set("key", key);
    const response = await fetchImpl(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`YouTube Data API: ${response.status}`);
    }
    const body = (await response.json()) as { items?: ApiVideo[] };
    return videoFromApi(body.items?.[0]);
  };
}
