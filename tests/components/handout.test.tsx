import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Handout } from "@/components/Handout";
import { HandoutGate } from "@/components/HandoutGate";
import { videos } from "@/data/videos";
import { startDictation, submitAnswer } from "@/lib/dictation";
import type { Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { renderWithIntl } from "../render";

const sintel = videos.find((v) => v.id === "sintel")!;
const today = "2026-10-27";

function storeWith(progress: Progress | null): ProgressStore {
  return {
    get: async () => progress,
    save: async () => {},
    list: async () => [],
    remove: async () => {},
  };
}

function day1Done(): Progress {
  let progress = startDictation(
    null,
    "sintel",
    1,
    sintel.sentences.length,
    today,
  );
  sintel.sentences.forEach((_, i) => {
    progress = submitAnswer(progress, 1, i, "x", sintel.sentences, today);
  });
  return progress;
}

describe("Handout", () => {
  it("pairs each English sentence with its Chinese translation", () => {
    renderWithIntl(<Handout video={sintel} />);
    const english = screen.getByText("This blade has a dark past.");
    expect(english.getAttribute("lang")).toBe("en");
    const item = english.closest("li")!;
    expect(within(item).getByText("這把刀有一段黑暗的過去。")).toBeDefined();
    expect(within(item).getByText("01")).toBeDefined();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(
      sintel.sentences.length,
    );
  });

  it("lists every vocabulary item as a table row", () => {
    renderWithIntl(<Handout video={sintel} />);
    const table = screen.getByRole("table", { name: "單字" });
    // Header row + one row per word.
    expect(within(table).getAllByRole("row")).toHaveLength(
      sintel.vocab.length + 1,
    );
    expect(within(table).getByText("kindred spirit")).toBeDefined();
    expect(within(table).getByText("志趣相投的人")).toBeDefined();
  });

  it("shows grammar points and the video credit", () => {
    renderWithIntl(<Handout video={sintel} />);
    expect(screen.getByText("What brings you to + 地點?")).toBeDefined();
    expect(
      screen.getByText("© copyright Blender Foundation | durian.blender.org"),
    ).toBeDefined();
  });
});

describe("HandoutGate", () => {
  it("keeps the handout locked until Day 1 is done", async () => {
    renderWithIntl(
      <HandoutGate videoId="sintel" store={storeWith(null)}>
        <p>Handout content</p>
      </HandoutGate>,
    );
    await act(async () => {});
    expect(screen.queryByText("Handout content")).toBeNull();
    expect(screen.getByText(/完成第 1 天的聽寫後/)).toBeDefined();
    expect(
      screen.getByRole("link", { name: "前往第 1 天" }).getAttribute("href"),
    ).toBe("/videos/sintel/day/1");
  });

  it("opens after Day 1 and prints with the browser dialog", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderWithIntl(
      <HandoutGate videoId="sintel" store={storeWith(day1Done())}>
        <p>Handout content</p>
      </HandoutGate>,
    );
    await waitFor(() =>
      expect(screen.getByText("Handout content")).toBeDefined(),
    );
    expect(screen.getByText(/^ListenLoop · \d{4}-\d{2}-\d{2}$/)).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "輸出 PDF" }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it("stays open after repeating a week (Day 1 not redone yet)", async () => {
    const repeating: Progress = {
      ...day1Done(),
      week: 2,
      days: {},
      history: [
        {
          week: 1,
          startedAt: today,
          day1Score: 0.5,
          day7Score: 0.6,
          passed: false,
        },
      ],
    };
    renderWithIntl(
      <HandoutGate videoId="sintel" store={storeWith(repeating)}>
        <p>Handout content</p>
      </HandoutGate>,
    );
    await act(async () => {});
    expect(screen.getByText("Handout content")).toBeDefined();
  });

  it("stays locked when progress can't be read", async () => {
    const broken: ProgressStore = {
      ...storeWith(null),
      get: async () => {
        throw new Error("blocked");
      },
    };
    renderWithIntl(
      <HandoutGate videoId="sintel" store={broken}>
        <p>Handout content</p>
      </HandoutGate>,
    );
    await act(async () => {});
    expect(screen.queryByText("Handout content")).toBeNull();
  });
});

describe("Handout highlighter (D68)", () => {
  it("marks the words misheard on Day 1, with a note on what the marks mean", async () => {
    renderWithIntl(
      <HandoutGate videoId="sintel" store={storeWith(day1Done())}>
        <Handout video={sintel} />
      </HandoutGate>,
    );
    await waitFor(() =>
      expect(screen.getByText(/第 1 天聽錯或漏掉的字/)).toBeDefined(),
    );
    // Every answer was "x", so every sentence has misheard words.
    const first = screen.getAllByRole("listitem")[0];
    expect(first.querySelector("mark.mark-miss")).not.toBeNull();
  });

  it("shows version 2 notes: chunks, sounds, IPA, and examples in Chinese", () => {
    const en =
      "If you're going to the library later, could you pick up the book I reserved for my history class?";
    renderWithIntl(
      <Handout
        video={{
          id: "p-1",
          title: "Library",
          sentences: [
            { i: 0, start: 0, end: 0, en, zh: "如果你等一下要去圖書館……" },
          ],
          vocab: [],
          grammar: [],
          audioUrls: ["a.mp3"],
          richNotes: [
            {
              v: 2,
              difficulty: "hard",
              highlights: [{ text: "pick up", note: "去拿" }],
              vocab: [
                {
                  term: "pick up",
                  inSentence: "pick up",
                  kind: "phrase",
                  pos: "phr. v.",
                  zh: "去拿",
                  ipa: "/pɪk ʌp/",
                  collocations: ["pick up a package"],
                  examples: [
                    { en: "Can you pick up milk?", zh: "可以買牛奶嗎？" },
                  ],
                },
              ],
              grammar: [],
              chunks: [
                {
                  text: "If you're going to the library later,",
                  role: "subordinate",
                  zh: "如果你等一下要去圖書館，",
                },
                {
                  text: "could you pick up the book I reserved for my history class?",
                  role: "main",
                  zh: "可以幫我拿我預約的書嗎？",
                },
              ],
              connected: [
                { text: "could you", soundsLike: "couldja", note: "連音" },
              ],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("［從屬子句］")).toBeDefined();
    expect(screen.getByText(/聽起來像「couldja」/)).toBeDefined();
    expect(screen.getByText("/pɪk ʌp/")).toBeDefined();
    expect(screen.getByText("可以買牛奶嗎？")).toBeDefined();
    // The key words are marked in the sentence.
    const sentence = screen.getAllByRole("listitem")[0];
    expect(sentence.querySelector("mark.mark-key")?.textContent).toBe(
      "重點：pick up",
    );
  });
});
