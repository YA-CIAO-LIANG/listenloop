import { describe, expect, it, vi } from "vitest";
import {
  checkYouTubeConnection,
  FAKE_VIDEOS,
  getYouTubeLookup,
  PROBE_VIDEO_ID,
  videoFromApi,
  youtubeEnabled,
} from "@/auth/youtube";
import { parseYouTubeTranscript } from "@/lib/draft-video";

// These tests are about the feature itself, so it's on here; it's paused
// on the site (D131, tests/youtube-paused.test.ts).
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  YOUTUBE_LINK_PRACTICES_ENABLED: true,
}));
import { materialFromCustomPractice } from "@/lib/practice-material";
import {
  excerptSeconds,
  parseIsoDuration,
  parseYouTubeUrl,
  transcriptSentences,
  youtubeAttribution,
} from "@/lib/youtube";

describe("YouTube practices (D97)", () => {
  it("finds the video id in every kind of link", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "dQw4w9WgXcQ",
    ]) {
      expect(parseYouTubeUrl(link), link).toBe("dQw4w9WgXcQ");
    }
    for (const bad of ["https://vimeo.com/123", "hello", "https://youtu.be/"]) {
      expect(parseYouTubeUrl(bad)).toBeNull();
    }
  });

  it("reads ISO 8601 durations", () => {
    expect(parseIsoDuration("PT4M13S")).toBe(253);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("4:13")).toBeNull();
  });

  it("joins captions into sentences at punctuation, pauses, and length", () => {
    const cues = parseYouTubeTranscript(
      [
        "0:00",
        "[Music]",
        "0:01",
        "so today we're going to",
        "0:03",
        "talk about sleep.",
        "0:05",
        "Why do we dream?",
        "0:12",
        "after a long pause",
        "0:14",
        "this is new",
      ].join("\n"),
    );
    const sentences = transcriptSentences(cues);
    expect(sentences.map((s) => s.en)).toEqual([
      "so today we're going to talk about sleep.",
      "Why do we dream?",
      "after a long pause this is new",
    ]);
    expect(sentences[0]).toMatchObject({ start: 1, end: 4.9 });
    expect(excerptSeconds(sentences)).toBe(14);
    // A range keeps captions that start inside it.
    expect(
      transcriptSentences(cues, { from: 5, to: 12 }).map((s) => s.en),
    ).toEqual(["Why do we dream?"]);
  });

  it("credits the channel, with CC BY 3.0 for Creative Commons videos", () => {
    expect(
      youtubeAttribution({
        id: "ccVideo0001",
        channel: "Open Science",
        license: "creativeCommon",
      }),
    ).toMatchObject({
      credit: "© Open Science (YouTube)",
      license: "CC BY 3.0",
      sourceUrl: "https://www.youtube.com/watch?v=ccVideo0001",
    });
    expect(
      youtubeAttribution({ id: "x", channel: "c", license: "youtube" }).license,
    ).toBe("YouTube Standard License");
  });

  it("reads videos.list answers, and the fake knows its test videos", async () => {
    expect(
      videoFromApi({
        id: "abcdefghijk",
        snippet: { title: "Talk", channelTitle: "Chan" },
        status: { license: "creativeCommon", embeddable: true },
        contentDetails: { duration: "PT2M" },
      }),
    ).toEqual({
      id: "abcdefghijk",
      title: "Talk",
      channel: "Chan",
      license: "creativeCommon",
      durationSeconds: 120,
      embeddable: true,
    });
    expect(videoFromApi(undefined)).toBeNull();
    vi.stubEnv("YOUTUBE_PROVIDER", "fake");
    expect(await getYouTubeLookup()!("ccVideo0001")).toEqual(
      FAKE_VIDEOS.ccVideo0001,
    );
    vi.unstubAllEnvs();
  });

  it("asks the YouTube Data API with the key, when there is one", async () => {
    vi.stubEnv("YOUTUBE_PROVIDER", "");
    vi.stubEnv("YOUTUBE_API_KEY", "test-key");
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                id: "abcdefghijk",
                snippet: { title: "Talk", channelTitle: "Chan" },
                status: { license: "youtube" },
                contentDetails: { duration: "PT1M" },
              },
            ],
          }),
        ),
    );
    const lookup = getYouTubeLookup(fetchImpl as unknown as typeof fetch)!;
    expect((await lookup("abcdefghijk"))?.license).toBe("youtube");
    const [askedUrl, init] = fetchImpl.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    const asked = new URL(String(askedUrl));
    // The key goes in a header, never the URL (D129).
    expect(asked.searchParams.get("key")).toBeNull();
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "test-key",
    );
    expect(asked.searchParams.get("part")).toBe(
      "snippet,status,contentDetails",
    );
    vi.stubEnv("YOUTUBE_API_KEY", "");
    expect(getYouTubeLookup()).toBeNull();
    vi.unstubAllEnvs();
  });

  it("tests the connection with a free query, and knows when there's no key (D129)", async () => {
    vi.stubEnv("YOUTUBE_PROVIDER", "");
    vi.stubEnv("YOUTUBE_API_KEY", "");
    expect(youtubeEnabled()).toBe(false);
    expect(await checkYouTubeConnection(vi.fn())).toBeNull();

    vi.stubEnv("YOUTUBE_API_KEY", ' "good-key" ');
    expect(youtubeEnabled()).toBe(true);
    const ok = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await checkYouTubeConnection(ok as unknown as typeof fetch)).toEqual(
      { ok: true, status: 200 },
    );
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      `https://www.googleapis.com/youtube/v3/videos?part=id&id=${PROBE_VIDEO_ID}`,
    );
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "good-key",
    );

    // An API that isn't enabled answers 403 with Google's reason.
    const off = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { code: 403, status: "PERMISSION_DENIED" } }),
          { status: 403 },
        ),
    );
    expect(
      await checkYouTubeConnection(off as unknown as typeof fetch),
    ).toEqual({ ok: false, status: 403, code: "403" });

    vi.stubEnv("YOUTUBE_PROVIDER", "fake");
    expect(await checkYouTubeConnection(vi.fn())).toEqual({ ok: true });
    vi.unstubAllEnvs();
  });

  it("plays a saved YouTube practice through the video, with its credit", () => {
    const material = materialFromCustomPractice(
      {
        id: "4d8e0a52-6c1b-4f3e-9a7d-2b5c8e1f0a93",
        title: "Talk",
        vocab: [],
        grammar: [],
        notes_generated_at: "2026-11-08",
        youtube_id: "ccVideo0001",
        youtube_channel: "Open Science",
        youtube_license: "creativeCommon",
        practice_sentences: [
          {
            i: 0,
            en: "Why do we dream?",
            zh: "我們為什麼做夢？",
            audio_path: null,
            start_sec: 5,
            end_sec: 7.5,
          },
        ],
      },
      () => null,
    );
    expect(material).toMatchObject({
      youtubeId: "ccVideo0001",
      sentences: [{ start: 5, end: 7.5, en: "Why do we dream?" }],
      attribution: { license: "CC BY 3.0" },
    });
    expect(material?.audioUrls).toBeUndefined();
  });

  it("shows a material's own stored credit instead of the channel's (D118)", () => {
    const own = {
      credit: "© copyright Blender Foundation | orange.blender.org",
      license: "CC BY 2.5",
      licenseUrl: "https://creativecommons.org/licenses/by/2.5/",
      sourceUrl: "https://orange.blender.org/",
      transcriptUrl: "https://commons.wikimedia.org/wiki/TimedText:x",
      changes: "Excerpt (0:15–3:14)",
    };
    const row = {
      id: "4d8e0a52-6c1b-4f3e-9a7d-2b5c8e1f0a93",
      title: "Elephants Dream (1)",
      vocab: [],
      grammar: [],
      notes_generated_at: "2026-11-12",
      youtube_id: "TLkA0RELQ1g",
      youtube_channel: "Blender",
      youtube_license: "creativeCommon",
      practice_sentences: [
        {
          i: 0,
          en: "Emo?",
          zh: "Emo？",
          audio_path: null,
          start_sec: 24.5,
          end_sec: 25.8,
        },
      ],
    };
    expect(
      materialFromCustomPractice({ ...row, attribution: own }, () => null)
        ?.attribution,
    ).toEqual(own);
    // An incomplete one falls back to the channel's.
    expect(
      materialFromCustomPractice(
        { ...row, attribution: { ...own, license: "" } },
        () => null,
      )?.attribution?.credit,
    ).toBe("© Blender (YouTube)");
  });
});
