import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkYouTubeConnection,
  getYouTubeLookup,
  youtubeEnabled,
} from "@/auth/youtube";
import { YOUTUBE_LINK_PRACTICES_ENABLED } from "@/lib/features";
import { materialFromCustomPractice } from "@/lib/practice-material";

afterEach(() => vi.unstubAllEnvs());

describe("YouTube link practices are paused (D131)", () => {
  it("is switched off", () => {
    expect(YOUTUBE_LINK_PRACTICES_ENABLED).toBe(false);
  });

  it("offers nothing even with a key or the fake", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "key");
    expect(youtubeEnabled()).toBe(false);
    expect(getYouTubeLookup()).toBeNull();
    expect(await checkYouTubeConnection()).toBeNull();
    vi.stubEnv("YOUTUBE_PROVIDER", "fake");
    expect(youtubeEnabled()).toBe(false);
    expect(getYouTubeLookup()).toBeNull();
  });

  it("still plays a practice already made from a link", () => {
    const material = materialFromCustomPractice(
      {
        id: "0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d",
        title: "Sleep",
        vocab: [],
        grammar: [],
        notes_generated_at: "2026-11-10T00:00:00Z",
        youtube_id: "ccVideo0001",
        youtube_channel: "Open Science Channel",
        youtube_license: "creativeCommon",
        practice_sentences: [
          {
            i: 0,
            en: "Hi.",
            zh: "嗨。",
            audio_path: null,
            start_sec: 1,
            end_sec: 2,
          },
        ],
      },
      () => null,
    );
    expect(material).toMatchObject({ youtubeId: "ccVideo0001" });
  });
});
