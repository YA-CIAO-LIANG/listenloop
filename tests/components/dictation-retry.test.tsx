import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DictationSession } from "@/components/DictationSession";
import { startDictation, submitAnswer } from "@/lib/dictation";
import type { Progress } from "@/lib/progress";
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
  sentences: [
    { i: 0, start: 1, end: 2, en: "Go home.", zh: "回家。" },
    {
      i: 1,
      start: 3,
      end: 5,
      en: "We moved to the city.",
      zh: "我們搬到城市。",
    },
  ],
  vocab: [],
  grammar: [],
};

const today = "2026-10-27";

/** Official Day 1 finished with 2/7 words right (≈ 29%). */
function officiallyDone(): Progress {
  let progress = startDictation(null, video.id, 1, 2, today);
  progress = submitAnswer(progress, 1, 0, "go", video.sentences, today);
  progress = submitAnswer(progress, 1, 1, "we", video.sentences, today);
  return progress;
}

function memoryStore(initial: Progress | null) {
  let saved = initial;
  const store: ProgressStore & { saved: () => Progress | null } = {
    get: vi.fn(async () => saved),
    save: vi.fn(async (progress: Progress) => {
      saved = progress;
    }),
    list: vi.fn(async () => (saved ? [saved] : [])),
    remove: vi.fn(async () => {
      saved = null;
    }),
    saved: () => saved,
  };
  return store;
}

async function renderSession(store: ProgressStore, startInRetry = false) {
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

describe("official result screen", () => {
  it("checks off today's task with the official score and offers a retry", async () => {
    await renderSession(memoryStore(officiallyDone()));
    expect(screen.getByText(/今日任務完成 · 正式成績 29%/)).toBeDefined();
    expect(screen.getByText("29%")).toBeDefined();
    expect(screen.getByRole("button", { name: "再練一次" })).toBeDefined();
    expect(
      screen.getByRole("link", { name: "看雙語講義" }).getAttribute("href"),
    ).toBe("/videos/test-video/handout");
  });
});

describe("retry", () => {
  it("never changes the saved official score", async () => {
    const store = memoryStore(officiallyDone());
    const before = structuredClone(store.saved());
    await renderSession(store);

    await userEvent.click(screen.getByRole("button", { name: "再練一次" }));
    expect(
      screen.getByText("練習模式：這次的分數不會改變正式成績（29%）。"),
    ).toBeDefined();
    expect(screen.getByText("第 1 / 2 句")).toBeDefined();

    await userEvent.type(input(), "go home{Enter}");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(input(), "we moved to the city{Enter}");
    await userEvent.keyboard("{Enter}");

    // This attempt: 100%; the official score stays 29%.
    expect(screen.getByText("這次的成績")).toBeDefined();
    // The big score (ScoreBadge) comes first; sentence review rows repeat 100%.
    expect(screen.getAllByText("100%")[0].className).toContain("font-display");
    expect(screen.getByText("正式成績 29%（不變）")).toBeDefined();
    expect(store.saved()).toEqual(before);
    expect(
      vi
        .mocked(store.save)
        .mock.calls.every(
          ([progress]) => progress.days[1]?.score === before?.days[1]?.score,
        ),
    ).toBe(true);
  });

  it("can practice again after a retry", async () => {
    await renderSession(memoryStore(officiallyDone()));
    await userEvent.click(screen.getByRole("button", { name: "再練一次" }));
    await userEvent.type(input(), "go home{Enter}");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(input(), "x{Enter}");
    await userEvent.keyboard("{Enter}");

    await userEvent.click(screen.getByRole("button", { name: "再練一次" }));
    expect(screen.getByText("第 1 / 2 句")).toBeDefined();
    expect((input() as HTMLTextAreaElement).value).toBe("");
  });

  it("starts right away with ?retry=1 when the official run is done", async () => {
    await renderSession(memoryStore(officiallyDone()), true);
    expect(screen.getByText(/練習模式/)).toBeDefined();
    expect(input()).toBeDefined();
  });

  it("ignores ?retry=1 until the official run is done", async () => {
    await renderSession(memoryStore(null), true);
    expect(screen.queryByText(/練習模式/)).toBeNull();
    expect(screen.getByText("第 1 / 2 句")).toBeDefined();
  });
});
