import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DictationSession,
  SKIP_CONFIRM_MS,
} from "@/components/DictationSession";
import { startDictation, submitAnswer } from "@/lib/dictation";
import type { Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import type { Video } from "@/lib/videos";
import { renderWithIntl } from "../render";

const playSegment = vi.hoisted(() => vi.fn());
vi.mock("@/components/youtube/useYouTubePlayer", () => ({
  useYouTubePlayer: () => ({
    containerRef: () => {},
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
  vocab: [
    { sentence: 1, word: "move", pos: "v.", zh: "搬家", example: "We moved." },
  ],
  grammar: [
    {
      sentence: 1,
      point: "move to + place",
      explanation: "搬到某個地方。",
      example: "They moved to Tainan.",
    },
  ],
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
  renderWithIntl(
    <DictationSession
      video={video}
      day={1}
      title="第 1 天：精聽聽寫"
      store={store}
    />,
  );
  await act(async () => {}); // load progress
  return store;
}

const input = () => screen.getByRole("textbox", { name: "你聽到的句子" });

describe("DictationSession", () => {
  beforeEach(() => playSegment.mockClear());

  it("starts at sentence 1 with the caption reminder and saves a fresh progress", async () => {
    const store = await renderSession();
    expect(screen.getByText("第 1 / 2 句")).toBeDefined();
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
    expect(playSegment).toHaveBeenLastCalledWith(2.85, 5.25, undefined);
    expect(screen.getByText("第 2 / 2 句")).toBeDefined();
    expect(document.activeElement).toBe(input());
  });

  it("explains each sentence once it is answered", async () => {
    await renderSession();
    expect(screen.queryByText("回家。")).toBeNull();

    // Sentence 1 has no vocabulary or grammar: translation only.
    await userEvent.type(input(), "go home{Enter}");
    expect(screen.getByText("回家。")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "單字" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "文法重點" })).toBeNull();

    await userEvent.keyboard("{Enter}");
    expect(screen.queryByText("回家。")).toBeNull();
    await userEvent.type(input(), "we moved to the city{Enter}");
    expect(screen.getByText("我們搬到城市。")).toBeDefined();
    expect(screen.getByRole("heading", { name: "單字" })).toBeDefined();
    expect(screen.getByText("move").getAttribute("lang")).toBe("en");
    expect(screen.getByText(/搬家/)).toBeDefined();
    expect(screen.getByRole("heading", { name: "文法重點" })).toBeDefined();
    expect(screen.getByText("move to + place")).toBeDefined();
    expect(screen.getByText("搬到某個地方。")).toBeDefined();
    // Examples stay in the handout.
    expect(screen.queryByText("We moved.")).toBeNull();
  });

  it("explains a skipped sentence too", async () => {
    await renderSession();
    await userEvent.click(screen.getByRole("button", { name: "跳過" }));
    await userEvent.click(screen.getByRole("button", { name: "確定跳過？" }));
    expect(screen.getByText("回家。")).toBeDefined();
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
    expect(screen.getByText("第 2 / 2 句")).toBeDefined();
    expect(screen.getByText("Go home.")).toBeDefined(); // done row revealed
    // Progress bar shows 1 of 2 answered; the label says where you are.
    expect(
      screen
        .getByRole("progressbar", { name: "第 2 / 2 句" })
        .getAttribute("aria-valuenow"),
    ).toBe("1");
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

describe("DictationSession controls", () => {
  beforeEach(() => playSegment.mockClear());

  it("uses a textarea where Enter submits instead of adding a new line", async () => {
    await renderSession();
    expect(input().tagName).toBe("TEXTAREA");
    await userEvent.type(input(), "go home{Enter}");
    expect(screen.getByText("你的答案")).toBeDefined();
  });

  it("doesn't submit on Enter while an input method is composing", async () => {
    await renderSession();
    await userEvent.type(input(), "go home");
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 229 });
    expect(screen.queryByText("你的答案")).toBeNull();
    expect((input() as HTMLTextAreaElement).value).toBe("go home");
  });

  it("plays and then replays the current sentence from the button", async () => {
    await renderSession();
    await userEvent.click(screen.getByRole("button", { name: "播放" }));
    expect(playSegment).toHaveBeenLastCalledWith(0.85, 2.25, undefined);
    expect(screen.getByRole("button", { name: "重播" })).toBeDefined();
  });

  it.each([
    ["Ctrl+Space", "{Control>} {/Control}"],
    ["Ctrl+Enter", "{Control>}{Enter}{/Control}"],
  ])("replays with %s without typing or submitting", async (_, keys) => {
    await renderSession();
    await userEvent.type(input(), "go");
    await userEvent.keyboard(keys);
    expect(playSegment).toHaveBeenCalledTimes(1);
    expect((input() as HTMLTextAreaElement).value).toBe("go");
    expect(screen.queryByText("你的答案")).toBeNull();
  });

  it("replays with the shortcut while the feedback is showing", async () => {
    await renderSession();
    await userEvent.type(input(), "go home{Enter}");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(playSegment).toHaveBeenCalledTimes(1);
    // Ctrl+Enter must not trigger the focused "next" button.
    expect(screen.getByText("你的答案")).toBeDefined();
  });

  it("asks for a second click before skipping", async () => {
    const store = await renderSession();
    await userEvent.click(screen.getByRole("button", { name: "跳過" }));
    expect(screen.queryByText("你的答案")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "確定跳過？" }));
    const feedback = screen.getByRole("status");
    expect(within(feedback).getByText("（未作答）")).toBeDefined();
    expect(within(feedback).getByText("這句正確率 0%")).toBeDefined();
    expect(store.saved()?.days[1]?.answers).toEqual(["", null]);
  });

  it("cancels a pending skip after a few seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await renderSession();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByRole("button", { name: "跳過" }));
      expect(screen.getByRole("button", { name: "確定跳過？" })).toBeDefined();
      act(() => vi.advanceTimersByTime(SKIP_CONFIRM_MS));
      expect(screen.getByRole("button", { name: "跳過" })).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the keyboard shortcuts", async () => {
    await renderSession();
    expect(
      screen.getByText("Enter 送出 · Ctrl＋空白 或 Ctrl＋Enter 重播"),
    ).toBeDefined();
  });
});

describe("DictationSession replay shortcut default handling", () => {
  beforeEach(() => playSegment.mockClear());

  // user-event never types or clicks while Ctrl is held, so check the browser
  // default is cancelled directly: that's what stops a typed space, a new
  // line, or the focused "next" button from firing in real browsers.
  it.each([
    ["Ctrl+Space", { key: " ", code: "Space", ctrlKey: true }],
    ["Ctrl+Enter", { key: "Enter", code: "Enter", ctrlKey: true }],
  ])("cancels the browser default for %s", async (_, init) => {
    await renderSession();
    const notCancelled = fireEvent.keyDown(input(), init);
    expect(notCancelled).toBe(false);
    expect(playSegment).toHaveBeenCalledTimes(1);
  });

  it("leaves other Ctrl shortcuts alone", async () => {
    await renderSession();
    const notCancelled = fireEvent.keyDown(input(), {
      key: "a",
      ctrlKey: true,
    });
    expect(notCancelled).toBe(true);
    expect(playSegment).not.toHaveBeenCalled();
  });
});

describe("DictationSession loading state", () => {
  it("shows the page content below the practice area while loading", () => {
    // A store that never resolves keeps the session in its loading state.
    const pending: ProgressStore = {
      get: () => new Promise(() => {}),
      save: async () => {},
      list: async () => [],
      remove: async () => {},
    };
    renderWithIntl(
      <DictationSession video={video} day={1} title="第 1 天" store={pending}>
        <p>Credits</p>
      </DictationSession>,
    );
    expect(screen.getByText("載入進度中…")).toBeDefined();
    expect(screen.getByText("Credits")).toBeDefined();
  });
});

describe("DictationSession layout by screen width", () => {
  const scrolled: { element: Element; options: unknown }[] = [];

  /** Pretends the screen is wide (≥ 64rem) or not, with optional reduced motion. */
  function screenIs(wide: boolean, reduceMotion = false) {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes("min-width: 64rem")
        ? wide
        : query.includes("reduce")
          ? reduceMotion
          : false,
    })) as unknown as typeof window.matchMedia;
  }

  beforeEach(() => {
    scrolled.length = 0;
    playSegment.mockClear();
    Element.prototype.scrollIntoView = function (options) {
      scrolled.push({ element: this, options });
    };
  });

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("reserves the notes column with a hint on wide screens", async () => {
    screenIs(true);
    await renderSession();
    expect(screen.getByText(/送出後，這裡會顯示/)).toBeDefined();

    await userEvent.type(input(), "go home{Enter}");
    expect(screen.queryByText(/送出後，這裡會顯示/)).toBeNull();
    expect(screen.getByText("回家。")).toBeDefined();
    // Everything fits beside the video: no scrolling.
    expect(scrolled).toEqual([]);
  });

  it("scrolls the feedback to the top on narrow screens after answering", async () => {
    screenIs(false);
    await renderSession();
    scrolled.length = 0; // ignore the input focus on load
    await userEvent.type(input(), "go home{Enter}");

    const feedback = screen.getByRole("status");
    expect(scrolled.at(-1)).toEqual({
      element: feedback,
      options: { block: "start", behavior: "smooth" },
    });
  });

  it("brings the video back before replaying on narrow screens", async () => {
    screenIs(false);
    await renderSession();
    await userEvent.type(input(), "go home{Enter}");
    scrolled.length = 0;

    await userEvent.click(screen.getByRole("button", { name: /播放|重播/ }));
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0].element.contains(screen.getByText(/CC 按鈕關閉/))).toBe(
      true,
    );
    expect(playSegment).toHaveBeenCalled();

    scrolled.length = 0;
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(scrolled).toHaveLength(1);
  });

  it("jumps instead of smooth-scrolling with reduced motion", async () => {
    screenIs(false, true);
    await renderSession();
    await userEvent.type(input(), "go home{Enter}");
    expect(scrolled.at(-1)?.options).toEqual({
      block: "start",
      behavior: "auto",
    });
  });
});
