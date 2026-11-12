import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuizStats } from "@/components/QuizStats";
import { VocabQuiz } from "@/components/VocabQuiz";
import type { PracticeMaterial } from "@/lib/practice-material";
import type { QuizAttempt } from "@/lib/quiz-records";
import type { QuizWord } from "@/lib/vocab-quiz";
import { renderWithIntl } from "../render";

vi.mock("@/app/videos/[id]/quiz/actions", () => ({ wordAudioUrl: vi.fn() }));
vi.mock("@/lib/supabase/browser", () => ({
  loadBrowserSupabase: async () => null,
}));

/** The vocabulary quiz (D136), two words with stand-in audio. */
const video: PracticeMaterial = {
  id: "p-0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d",
  title: "Station",
  sentences: [
    { i: 0, start: 0, end: 0, en: "The station is near.", zh: "車站很近。" },
    { i: 1, start: 0, end: 0, en: "It was quiet.", zh: "很安靜。" },
  ],
  vocab: [],
  grammar: [],
  audioUrls: ["a.mp3", "b.mp3"],
};

const candidates: QuizWord[] = [
  { word: "station", pos: "n.", zh: "車站", sentence: 0 },
  {
    word: "quiet",
    pos: "adj.",
    zh: "安靜的",
    sentence: 1,
    example: { en: "A quiet room.", zh: "安靜的房間。" },
  },
];
const others = [
  { word: "garden", pos: "n.", zh: "花園" },
  { word: "ticket", pos: "n.", zh: "票" },
  { word: "happy", pos: "adj.", zh: "快樂的" },
  { word: "busy", pos: "adj.", zh: "忙碌的" },
];

class FakeAudio {
  src = "";
  currentTime = 0;
  playbackRate = 1;
  preservesPitch = true;
  static plays: number[] = [];
  play() {
    FakeAudio.plays.push(this.playbackRate);
    return Promise.resolve();
  }
}

function seed(answers: (string | null)[]) {
  localStorage.setItem(
    `ll-progress:v1:${video.id}`,
    JSON.stringify({
      videoId: video.id,
      week: 1,
      startedAt: "2026-11-10",
      status: "in-progress",
      history: [],
      days: {
        "1": { done: true, score: 0.5, date: "2026-11-10", answers },
      },
    }),
  );
}

const save = vi.fn(async () => "signed-out" as const);
const audioUrl = vi.fn(async () => ({
  ok: true as const,
  url: "https://x/w.mp3",
}));

function setup() {
  renderWithIntl(
    <VocabQuiz
      video={video}
      day={1}
      candidates={candidates}
      others={others}
      accent="us"
      audioUrl={audioUrl}
      save={save}
    />,
  );
}

const click = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

beforeEach(() => {
  localStorage.clear();
  FakeAudio.plays = [];
  vi.stubGlobal("Audio", FakeAudio);
  save.mockClear();
  audioUrl.mockClear();
});

describe("VocabQuiz (D136)", () => {
  it("waits for the day's dictation", async () => {
    renderWithIntl(
      <VocabQuiz
        video={video}
        day={7}
        candidates={candidates}
        others={others}
        accent="us"
        audioUrl={audioUrl}
        save={save}
      />,
    );
    expect(await screen.findByText(/完成第 7 天的聽寫後/)).toBeDefined();
  });

  it("asks the misheard word first, plays it, and checks spelling letter by letter", async () => {
    seed(["the station is near", "it was quite"]);
    setup();
    expect(await screen.findByText(/第 1 個／共 2 個/)).toBeDefined();
    // quiet was misheard: it comes first, and its sound plays by itself.
    await vi.waitFor(() =>
      expect(audioUrl).toHaveBeenCalledWith(video.id, "quiet"),
    );
    await vi.waitFor(() => expect(FakeAudio.plays).toEqual([1]));
    await click("慢速播放");
    expect(FakeAudio.plays).toEqual([1, 0.7]);

    await click("提示：字母數");
    expect(screen.getByText("_ _ _ _ _")).toBeDefined();
    await click("提示：第一個字母");
    expect(screen.getByText("q _ _ _ _")).toBeDefined();

    fireEvent.change(screen.getByLabelText("你聽到的單字"), {
      target: { value: "QUITE" },
    });
    await click("送出");
    expect(screen.getByText(/拼錯了/)).toBeDefined();
    expect(screen.getByLabelText("正確拼法是 quiet")).toBeDefined();
  });

  it("then the meaning: four choices, and the notes after", async () => {
    seed(["the station is near", "it was quite"]);
    setup();
    await screen.findByText(/第 1 個／共 2 個/);
    fireEvent.change(screen.getByLabelText("你聽到的單字"), {
      target: { value: "quiet" },
    });
    await click("送出");
    expect(screen.getByText("拼對了！")).toBeDefined();
    await click(/下一關：選翻譯/);
    const options = screen.getAllByRole("radio");
    expect(options).toHaveLength(4);
    fireEvent.click(screen.getByLabelText("快樂的"));
    await click("送出");
    expect(screen.getByText("答錯了。")).toBeDefined();
    expect(screen.getByText("安靜的房間。")).toBeDefined();
  });

  it("ends with the counts, saves, and puts missed words on the review list", async () => {
    seed(["the station is near", "it was quite"]);
    setup();
    await screen.findByText(/第 1 個／共 2 個/);
    // quiet: spelled with a hint, meaning wrong.
    await click("提示：字母數");
    fireEvent.change(screen.getByLabelText("你聽到的單字"), {
      target: { value: "quiet" },
    });
    await click("送出");
    await click(/下一關/);
    fireEvent.click(screen.getByLabelText("快樂的"));
    await click("送出");
    await click("下一個單字");
    // station: all right.
    fireEvent.change(screen.getByLabelText("你聽到的單字"), {
      target: { value: "station" },
    });
    await click("送出");
    await click(/下一關/);
    fireEvent.click(screen.getByLabelText("車站"));
    await click("送出");
    await click("看結果");

    expect(screen.getByRole("heading", { name: "測驗結果" })).toBeDefined();
    expect(screen.getByText("2 / 2")).toBeDefined();
    expect(screen.getByText("1 / 2")).toBeDefined();
    expect(screen.getByText(/用了 1 次提示/)).toBeDefined();
    expect(screen.getByText(/1 個字已加入錯字複習/)).toBeDefined();
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(null, {
      videoId: video.id,
      day: 1,
      summary: {
        total: 2,
        spelled: 2,
        translated: 1,
        hints: 1,
        missed: ["quiet"],
      },
      words: [
        { word: "quiet", spelled: true, hints: 1, translated: false },
        { word: "station", spelled: true, hints: 0, translated: true },
      ],
    });
    expect(screen.getByText(/登入後會保存測驗紀錄/)).toBeDefined();
    const activity = JSON.parse(localStorage.getItem("ll-activity:v1")!);
    expect(Object.keys(activity.review)).toEqual(["quiet"]);
    expect(activity.review.quiet).toMatchObject({
      en: "It was quiet.",
      videoId: video.id,
      i: 1,
      stage: 0,
    });
  });
});

describe("QuizStats (D136)", () => {
  const attempts: QuizAttempt[] = [
    {
      videoId: video.id,
      day: 1,
      takenAt: "2026-11-10T10:00:00Z",
      total: 2,
      spelled: 1,
      translated: 1,
      hints: 0,
      words: [
        { word: "quiet", spelled: true, hints: 0, translated: true },
        { word: "station", spelled: false, hints: 0, translated: false },
      ],
    },
    {
      videoId: video.id,
      day: 7,
      takenAt: "2026-11-16T10:00:00Z",
      total: 2,
      spelled: 2,
      translated: 2,
      hints: 1,
      words: [
        { word: "quiet", spelled: true, hints: 1, translated: true },
        { word: "station", spelled: true, hints: 0, translated: true },
      ],
    },
  ];

  it("shows the count, the average, and words mastered; the trend with full stats", async () => {
    renderWithIntl(
      <QuizStats full titleOf={() => "Station"} load={async () => attempts} />,
    );
    expect(await screen.findByText("測驗次數")).toBeDefined();
    expect(screen.getByText("75%")).toBeDefined();
    // quiet needed a hint last time; station is mastered.
    expect(screen.getByText("已掌握單字").parentElement?.textContent).toContain(
      "1",
    );
    expect(screen.getByText("單字測驗正確率")).toBeDefined();
  });

  it("keeps the trend for the full stats", async () => {
    renderWithIntl(
      <QuizStats
        full={false}
        titleOf={() => "Station"}
        load={async () => attempts}
      />,
    );
    await screen.findByText("測驗次數");
    expect(screen.queryByText("單字測驗正確率")).toBeNull();
  });
});
