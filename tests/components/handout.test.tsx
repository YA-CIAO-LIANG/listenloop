import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DayOneStatus } from "@/components/DayOneStatus";
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

describe("handout entry points", () => {
  it("video page: says the handout unlocks after Day 1", async () => {
    renderWithIntl(<DayOneStatus videoId="sintel" store={storeWith(null)} />);
    await act(async () => {});
    expect(screen.getByText("雙語講義：完成第 1 天後開放")).toBeDefined();
    expect(screen.queryByRole("link", { name: "看雙語講義" })).toBeNull();
  });

  it("video page: links to the handout once Day 1 is done", async () => {
    renderWithIntl(
      <DayOneStatus videoId="sintel" store={storeWith(day1Done())} />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "看雙語講義" }).getAttribute("href"),
      ).toBe("/videos/sintel/handout"),
    );
  });
});
