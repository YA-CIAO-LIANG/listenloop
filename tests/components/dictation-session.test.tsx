import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DictationSession } from "@/components/DictationSession";
import { startDictation, submitAnswer } from "@/lib/dictation";
import type { Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import type { Video } from "@/lib/videos";
import { renderWithIntl } from "../render";

const playSegment = vi.hoisted(() => vi.fn());
vi.mock("@/components/youtube/useYouTubePlayer", () => ({
  useYouTubePlayer: () => ({
    containerRef: { current: null },
    status: "ready",
    error: null,
    isPlaying: false,
    playSegment,
    stop: vi.fn(),
  }),
}));

// A short fixture keeps the flow readable; real videos are tested elsewhere.
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

function memoryStore(initial: Progress | null = null) {
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

async function renderSession(store = memoryStore()) {
  renderWithIntl(<DictationSession video={video} day={1} store={store} />);
  await act(async () => {}); // load progress
  return store;
}

const input = () => screen.getByRole("textbox", { name: "你聽到的句子" });

describe("DictationSession", () => {
  beforeEach(() => playSegment.mockClear());

  it("starts at sentence 1 with the caption reminder and saves a fresh progress", async () => {
    const store = await renderSession();
    expect(screen.getByText("第 1 句，共 2 句")).toBeDefined();
    expect(screen.getByText(/CC 按鈕關閉/)).toBeDefined();
    expect(store.saved()?.days[1]).toEqual({
      done: false,
      answers: [null, null],
    });
    expect(document.activeElement).toBe(input());
  });

  it("won't submit an empty answer", async () => {
    await renderSession();
    expect(
      screen.getByRole("button", { name: "送出" }).hasAttribute("disabled"),
    ).toBe(true);
    await userEvent.type(input(), "   {Enter}");
    expect(screen.queryByText("你的答案")).toBeNull();
  });

  it("shows two-line feedback after Enter, then plays the next sentence", async () => {
    const store = await renderSession();
    await userEvent.type(input(), "go hom{Enter}");

    const feedback = screen.getByRole("status");
    expect(within(feedback).getByText("你的答案")).toBeDefined();
    expect(within(feedback).getByText("hom").tagName).toBe("DEL");
    expect(within(feedback).getByText("home.")).toBeDefined();
    expect(within(feedback).getByText("這句正確率 50%")).toBeDefined();
    expect(store.saved()?.days[1]?.answers).toEqual(["go hom", null]);

    // Focus moved to "next"; Enter continues and auto-plays sentence 2 (padded).
    const next = screen.getByRole("button", { name: "下一句" });
    expect(document.activeElement).toBe(next);
    await userEvent.keyboard("{Enter}");
    expect(playSegment).toHaveBeenLastCalledWith(2.85, 5.25);
    expect(screen.getByText("第 2 句，共 2 句")).toBeDefined();
    expect(document.activeElement).toBe(input());
  });

  it("finishes the day and shows the score and review", async () => {
    const store = await renderSession();
    await userEvent.type(input(), "go home{Enter}");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(input(), "we move to the city{Enter}");

    expect(screen.getByRole("button", { name: "查看結果" })).toBeDefined();
    await userEvent.keyboard("{Enter}");

    // 2/2 + 4/5 = 6/7 ≈ 86%, passed styling comes from ScoreBadge.
    expect(screen.getByText("86%")).toBeDefined();
    expect(screen.getByText("第 1 天完成！明天開始跟讀。")).toBeDefined();
    expect(screen.getByRole("heading", { name: "逐句回顧" })).toBeDefined();
    expect(store.saved()?.days[1]).toMatchObject({ done: true, score: 6 / 7 });
    expect(
      screen.getByRole("link", { name: "回影片頁" }).getAttribute("href"),
    ).toBe("/videos/test-video");
  });

  it("resumes at the first unanswered sentence", async () => {
    const partly = submitAnswer(
      startDictation(null, video.id, 1, 2, "2026-10-27"),
      1,
      0,
      "go home",
      video.sentences,
      "2026-10-27",
    );
    await renderSession(memoryStore(partly));
    expect(screen.getByText("第 2 句，共 2 句")).toBeDefined();
    expect(screen.getByText("Go home.")).toBeDefined(); // done row revealed
    expect(screen.getByText("1 / 2")).toBeDefined();
  });

  it("shows the results directly when the day is already done", async () => {
    let done = startDictation(null, video.id, 1, 2, "2026-10-27");
    done = submitAnswer(done, 1, 0, "go home", video.sentences, "2026-10-27");
    done = submitAnswer(done, 1, 1, "x", video.sentences, "2026-10-27");
    await renderSession(memoryStore(done));
    expect(screen.getByRole("heading", { name: "逐句回顧" })).toBeDefined();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("tells the user when progress can't be saved", async () => {
    const store = memoryStore();
    store.save = vi.fn(async () => {
      throw new Error("QuotaExceededError");
    });
    await renderSession(store);
    expect(screen.getByRole("alert").textContent).toContain("無法儲存進度");
  });
});
