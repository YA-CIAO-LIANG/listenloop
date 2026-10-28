import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ShopPage, { generateMetadata } from "@/app/shop/page";
import { DictationSession } from "@/components/DictationSession";
import { SiteHeader } from "@/components/SiteHeader";
import { claimAndAnnounce } from "@/components/useRewards";
import { AQUARIUM_ENABLED } from "@/lib/features";
import type { Progress } from "@/lib/progress";
import { WALLET_KEY } from "@/lib/storage/local-reward-store";
import type { ProgressStore } from "@/lib/storage/progress-store";
import type { Video } from "@/lib/videos";
import { renderWithIntl } from "../render";

vi.mock("@/components/youtube/useYouTubePlayer", () => ({
  useYouTubePlayer: () => ({
    containerRef: () => {},
    status: "ready",
    error: null,
    isPlaying: false,
    playSegment: vi.fn(),
    stop: vi.fn(),
  }),
}));

const video: Video = {
  id: "test-video",
  youtubeId: "abcdefghijk",
  title: "Test",
  level: "beginner",
  category: "story",
  source: "Test",
  attribution: {
    credit: "Test",
    license: "Public Domain",
    licenseUrl: "https://example.com/license",
    sourceUrl: "https://example.com/source",
    transcriptUrl: "https://example.com/transcript",
    changes: "None",
  },
  sentences: [{ i: 0, start: 1, end: 2, en: "Go home.", zh: "回家。" }],
  vocab: [],
  grammar: [],
};

function memoryStore(): ProgressStore {
  let saved: Progress | null = null;
  return {
    get: async () => saved,
    save: async (progress) => {
      saved = progress;
    },
    list: async () => (saved ? [saved] : []),
    remove: async () => {},
  };
}

describe("with the aquarium feature off (M2.5 paused)", () => {
  it("is off", () => {
    expect(AQUARIUM_ENABLED).toBe(false);
  });

  it("shows no points or feed in the header", () => {
    renderWithIntl(<SiteHeader />);
    expect(screen.queryByRole("link", { name: /前往魚店/ })).toBeNull();
    expect(screen.queryByText(/點數/)).toBeNull();
  });

  it("answers 404 for the fish shop", async () => {
    await expect(ShopPage()).rejects.toThrow();
    expect(await generateMetadata()).toEqual({});
  });

  it("doesn't claim rewards or touch the wallet", async () => {
    expect(await claimAndAnnounce()).toBeNull();
    expect(localStorage.getItem(WALLET_KEY)).toBeNull();
  });

  it("finishes practice without an “earned …” line", async () => {
    renderWithIntl(
      <DictationSession
        video={video}
        day={1}
        title="第 1 天：精聽聽寫"
        store={memoryStore()}
      />,
    );
    await act(async () => {});
    await userEvent.type(
      screen.getByRole("textbox", { name: "你聽到的句子" }),
      "go home{Enter}",
    );
    await act(async () => {});
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText(/第 1 天完成/)).toBeDefined();
    expect(screen.queryByText(/獲得/)).toBeNull();
    expect(localStorage.getItem(WALLET_KEY)).toBeNull();
  });
});
