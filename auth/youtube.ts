import { probeProvider } from "@/lib/ai/http";
import { readEnv } from "@/lib/ai/providers";
import type { ConnectionCheck } from "@/lib/ai/types";
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
  return process.env.YOUTUBE_PROVIDER === "fake" || !!youtubeKey();
}

/** The key, tidied like the AI keys (full-width, quotes, D47). */
const youtubeKey = () => readEnv(process.env, "YOUTUBE_API_KEY");

const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

/** A public video every check can ask about: Sintel (Blender, CC BY). */
export const PROBE_VIDEO_ID = "eRsGyueVLvQ";

/**
 * "Test connection" for YouTube on /admin/usage (D129): one videos.list
 * call for a public video, 1 unit of the free daily quota, no charge.
 * Null when there's no key (the setup check says so); the fake always
 * passes, without the network.
 */
export async function checkYouTubeConnection(
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionCheck | null> {
  if (process.env.YOUTUBE_PROVIDER === "fake") return { ok: true };
  const key = youtubeKey();
  if (!key) return null;
  const url = new URL(VIDEOS_URL);
  url.searchParams.set("part", "id");
  url.searchParams.set("id", PROBE_VIDEO_ID);
  return probeProvider(
    url.toString(),
    { method: "GET", headers: { "x-goog-api-key": key } },
    fetchImpl,
    (status) => status === 200,
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
  const key = youtubeKey();
  if (!key) return null;
  return async (id) => {
    const url = new URL(VIDEOS_URL);
    url.searchParams.set("part", "snippet,status,contentDetails");
    url.searchParams.set("id", id);
    // The key in a header, never the URL, so it stays out of logs (D129).
    const response = await fetchImpl(url, {
      cache: "no-store",
      headers: { "x-goog-api-key": key },
    });
    if (!response.ok) {
      throw new Error(`YouTube Data API: ${response.status}`);
    }
    const body = (await response.json()) as { items?: ApiVideo[] };
    return videoFromApi(body.items?.[0]);
  };
}
