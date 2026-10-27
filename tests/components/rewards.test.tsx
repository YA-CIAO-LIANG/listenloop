import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DictationSession } from "@/components/DictationSession";
import { GAIN_VISIBLE_MS, RewardBadge } from "@/components/RewardBadge";
import { REWARDS_EVENT } from "@/components/useRewards";
import { startDictation, submitAnswer } from "@/lib/dictation";
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

function memoryStore(initial: Progress | null = null) {
  let saved = initial;
  const store: ProgressStore = {
    get: vi.fn(async () => saved),
    save: vi.fn(async (progress: Progress) => {
      saved = progress;
    }),
    list: vi.fn(async () => (saved ? [saved] : [])),
    remove: vi.fn(async () => {}),
  };
  return store;
}

const savedWallet = () =>
  JSON.parse(localStorage.getItem(WALLET_KEY) ?? "null");

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("RewardBadge (header)", () => {
  it("back-fills past practice and shows both balances", async () => {
    let done = startDictation(null, video.id, 1, 1, "2026-10-20");
    done = submitAnswer(done, 1, 0, "go home", video.sentences, "2026-10-20");
    renderWithIntl(<RewardBadge stores={{ progress: memoryStore(done) }} />);
    await act(async () => {});

    // 10 + round(1 × 10) points; the starter portion + one day of feed.
    expect(screen.getByText("點數 20、飼料 2 份，前往魚店")).toBeDefined();
    expect(savedWallet().points.earned).toHaveLength(1);
  });

  it("shows +N briefly and announces it", async () => {
    renderWithIntl(<RewardBadge stores={{ progress: memoryStore() }} />);
    await act(async () => {});
    vi.useFakeTimers();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(REWARDS_EVENT, {
          detail: {
            gained: { points: 12, feed: 1 },
            balance: { points: 12, feed: 2 },
          },
        }),
      );
    });
    expect(screen.getByText("+12")).toBeDefined();
    expect(screen.getByText("獲得 12 點數 · 1 份飼料")).toBeDefined();

    act(() => vi.advanceTimersByTime(GAIN_VISIBLE_MS));
    expect(screen.queryByText("+12")).toBeNull();
    expect(screen.getByText("點數 12、飼料 2 份，前往魚店")).toBeDefined();
  });

  it("stays hidden until rewards are loaded", () => {
    const { container } = renderWithIntl(
      <RewardBadge stores={{ progress: memoryStore() }} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("rewards from practice", () => {
  async function renderDay1(store: ProgressStore, startInRetry = false) {
    renderWithIntl(
      <DictationSession
        video={video}
        day={1}
        title="第 1 天：精聽聽寫"
        store={store}
        startInRetry={startInRetry}
      />,
    );
    await act(async () => {});
  }

  const input = () => screen.getByRole("textbox", { name: "你聽到的句子" });

  it("finishing an official day earns points and feed, shown on the result", async () => {
    await renderDay1(memoryStore());
    await userEvent.type(input(), "go home{Enter}");
    await act(async () => {});
    await userEvent.keyboard("{Enter}");

    expect(screen.getByText("獲得 20 點數 · 2 份飼料")).toBeDefined();
    expect(savedWallet().feed.earned.map((e: { id: string }) => e.id)).toEqual(
      expect.arrayContaining(["feed:starter"]),
    );
  });

  it("a finished retry earns 2 points once a day", async () => {
    let done = startDictation(null, video.id, 1, 1, "2026-10-20");
    done = submitAnswer(done, 1, 0, "go home", video.sentences, "2026-10-20");
    const store = memoryStore(done);
    await renderDay1(store, true);

    await userEvent.type(input(), "go{Enter}");
    await act(async () => {});
    const retryIds = savedWallet()
      .points.earned.map((e: { id: string }) => e.id)
      .filter((id: string) => id.startsWith("retry:"));
    expect(retryIds).toHaveLength(1);
  });
});
