import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShadowingSession } from "@/components/ShadowingSession";
import { toLocalDate } from "@/lib/dates";
import { SILENCE_MS } from "@/components/speech/useSpeechRecognition";
import type { Progress } from "@/lib/progress";
import { startShadowing, submitShadowing } from "@/lib/shadowing";
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

/** Stand-in for the browser's SpeechRecognition; tests drive its events. */
class FakeRecognition {
  static last: FakeRecognition | undefined;
  lang = "";
  interimResults = false;
  continuous = false;
  maxAlternatives = 0;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {}
  stop() {}
  abort() {}
}

const video: Video = {
  id: "test-video",
  youtubeId: "abcdefghijk",
  title: "Test",
  level: "beginner",
  category: "story",
  collection: "blender-open-movies",
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

// The session stamps the real date, so compare with it.
const today = toLocalDate(new Date());

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

async function renderSession(store = memoryStore(), startInRetry = false) {
  renderWithIntl(
    <ShadowingSession
      video={video}
      day={2}
      title="第 2 天：跟讀"
      store={store}
      startInRetry={startInRetry}
    />,
  );
  await act(async () => {}); // load progress
  return store;
}

const button = (name: string) => screen.getByRole("button", { name });

/** Ends the playing segment, as the player does after `end`. */
function finishPlaying() {
  const onEnd = playSegment.mock.lastCall?.[2] as (() => void) | undefined;
  act(() => onEnd?.());
}

/** Says `words`, then stays quiet until the attempt ends. */
function say(words: string) {
  act(() =>
    FakeRecognition.last?.onresult?.({ results: [[{ transcript: words }]] }),
  );
  act(() => vi.advanceTimersByTime(SILENCE_MS));
}

function shadow(words: string) {
  fireEvent.click(
    screen.queryByRole("button", { name: "播放並跟讀" }) ?? button("再試一次"),
  );
  finishPlaying();
  say(words);
}

/** Plays the sentence, then recognition fails with `code`. */
function shadowFails(code: string) {
  fireEvent.click(button("播放並跟讀"));
  finishPlaying();
  act(() => FakeRecognition.last?.onerror?.({ error: code }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  playSegment.mockClear();
  FakeRecognition.last = undefined;
  (
    window as unknown as { webkitSpeechRecognition: unknown }
  ).webkitSpeechRecognition = FakeRecognition;
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { webkitSpeechRecognition?: unknown })
    .webkitSpeechRecognition;
});

describe("ShadowingSession", () => {
  it("starts at sentence 1 with English shown, Chinese folded, and saves a fresh day", async () => {
    const store = await renderSession();
    expect(screen.getByText("第 1 / 2 句")).toBeDefined();
    expect(screen.getByText(/CC 按鈕關閉/)).toBeDefined();
    expect(screen.getAllByText("Go home.").length).toBeGreaterThan(0);
    expect(screen.getByText("回家。").closest("details")).not.toBeNull();
    expect(store.saved()?.days[2]).toEqual({
      done: false,
      sentences: [
        { done: false, coverage: null },
        { done: false, coverage: null },
      ],
    });
  });

  it("plays the sentence, listens after it ends, and passes at 70%+", async () => {
    const store = await renderSession();
    fireEvent.click(button("播放並跟讀"));
    // Padded segment, with a callback for when it ends.
    expect(playSegment).toHaveBeenLastCalledWith(
      0.85,
      2.25,
      expect.any(Function),
    );
    expect(button("播放中…").hasAttribute("disabled")).toBe(true);

    finishPlaying();
    expect(screen.getByText("正在聽你念…")).toBeDefined();
    say("go home");

    expect(screen.getByText(/念完了 · 涵蓋率 100%/)).toBeDefined();
    expect(store.saved()?.days[2]?.sentences?.[0]).toEqual({
      done: true,
      coverage: 1,
    });

    // Focus is on "next"; it plays sentence 2 straight away.
    const next = button("下一句");
    expect(document.activeElement).toBe(next);
    fireEvent.click(next);
    expect(playSegment).toHaveBeenLastCalledWith(
      2.85,
      5.25,
      expect.any(Function),
    );
    expect(screen.getByText("第 2 / 2 句")).toBeDefined();
  });

  it("underlines missed words below 70% and lets the learner try again", async () => {
    const store = await renderSession();
    fireEvent.click(button("播放並跟讀"));
    finishPlaying();
    say("go");

    expect(screen.getByText(/涵蓋率 50% · 還差一點/)).toBeDefined();
    const missed = screen.getByText("（漏念）").parentElement;
    expect(missed?.textContent).toBe("home.（漏念）");
    expect(missed?.className).toContain("underline");
    expect(store.saved()?.days[2]?.sentences?.[0]).toEqual({
      done: false,
      coverage: 0.5,
    });

    shadow("go home");
    expect(screen.getByText(/念完了 · 涵蓋率 100%/)).toBeDefined();
    expect(store.saved()?.days[2]?.sentences?.[0]?.done).toBe(true);
  });

  it("goes back to ready with a message when nothing is heard", async () => {
    await renderSession();
    fireEvent.click(button("播放並跟讀"));
    finishPlaying();
    act(() => FakeRecognition.last?.onerror?.({ error: "no-speech" }));
    expect(screen.getByText(/沒有聽到聲音/)).toBeDefined();
    expect(button("播放並跟讀")).toBeDefined();
    expect(screen.queryByRole("button", { name: "我念完了" })).toBeNull();
  });

  it("switches to “I said it” when the microphone is blocked", async () => {
    const store = await renderSession();
    fireEvent.click(button("播放並跟讀"));
    finishPlaying();
    act(() => FakeRecognition.last?.onerror?.({ error: "not-allowed" }));

    expect(screen.getByRole("alert").textContent).toContain("無法使用麥克風");
    expect(button("播放")).toBeDefined();
    fireEvent.click(button("我念完了"));
    expect(store.saved()?.days[2]?.sentences?.[0]).toEqual({
      done: true,
      coverage: null,
    });
    expect(screen.getByText("第 2 / 2 句")).toBeDefined();
  });

  it("offers “I said it” from the start without speech recognition", async () => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
    const store = await renderSession();
    expect(screen.getByRole("alert").textContent).toContain(
      "這個瀏覽器不支援語音辨識",
    );
    // Plain playback, no listening afterwards.
    fireEvent.click(button("播放"));
    expect(playSegment).toHaveBeenLastCalledWith(0.85, 2.25, undefined);

    fireEvent.click(button("我念完了"));
    fireEvent.click(button("我念完了"));
    expect(store.saved()?.days[2]?.done).toBe(true);
    expect(screen.getByText("今天的跟讀完成了！")).toBeDefined();
    expect(screen.getAllByText("自行完成")).toHaveLength(2);
  });

  it("offers “I said it” right away in Brave", async () => {
    Object.defineProperty(navigator, "brave", {
      value: {},
      configurable: true,
    });
    try {
      const store = await renderSession();
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Brave 瀏覽器不支援語音辨識");
      expect(alert.textContent).toContain("請改用 Chrome 或 Edge");
      expect(screen.queryByRole("button", { name: "播放並跟讀" })).toBeNull();
      fireEvent.click(button("我念完了"));
      expect(store.saved()?.days[2]?.sentences?.[0]).toEqual({
        done: true,
        coverage: null,
      });
    } finally {
      delete (navigator as { brave?: unknown }).brave;
    }
  });

  it("switches to “I said it” after two network errors in a row", async () => {
    await renderSession();
    shadowFails("network");
    // The first one only asks to try again.
    expect(screen.getByText(/語音辨識需要網路連線/)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();

    shadowFails("network");
    expect(screen.getByRole("alert").textContent).toContain(
      "這個瀏覽器目前無法使用語音辨識",
    );
    expect(screen.queryByText(/語音辨識需要網路連線/)).toBeNull();
    expect(button("我念完了")).toBeDefined();
  });

  it("finishes the day with the average coverage", async () => {
    const store = await renderSession();
    shadow("go home");
    fireEvent.click(button("下一句"));
    finishPlaying();
    say("we moved to city");

    fireEvent.click(button("查看結果"));
    expect(store.saved()?.days[2]).toMatchObject({ done: true, date: today });
    expect(screen.getByText("今日任務完成")).toBeDefined();
    expect(screen.getByText(/完成 2 \/ 2 句 · 平均涵蓋率 90%/)).toBeDefined();
    expect(screen.getByText("第 3 天（跟讀）明天開放。")).toBeDefined();
    expect(screen.getByRole("link", { name: "看雙語講義" })).toBeDefined();
  });

  it("retries in memory without changing the saved day", async () => {
    let done = startShadowing(null, video.id, 2, 2, today);
    done = submitShadowing(done, 2, 0, { coverage: 0.8 }, today);
    done = submitShadowing(done, 2, 1, { coverage: 1 }, today);
    const store = await renderSession(memoryStore(done), true);

    expect(screen.getByText(/練習模式/)).toBeDefined();
    expect(screen.getByText("第 1 / 2 句")).toBeDefined();
    shadow("go");
    shadow("go home");
    fireEvent.click(button("下一句"));
    finishPlaying();
    say("we moved to the city");
    fireEvent.click(button("查看結果"));

    expect(screen.getByText("練習完成！")).toBeDefined();
    expect(screen.getByText("今天的紀錄不變。")).toBeDefined();
    expect(store.saved()).toBe(done);
  });

  it("lists each sentence with its best coverage", async () => {
    await renderSession();
    shadow("go");
    const list = screen.getByRole("list");
    const first = within(list).getAllByRole("listitem")[0];
    expect(first.getAttribute("aria-current")).toBe("step");
    expect(first.textContent).toContain("50%");
  });
});
