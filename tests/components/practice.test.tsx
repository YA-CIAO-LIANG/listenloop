import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DayTracker } from "@/components/DayTracker";
import { MAX_SEGMENTS, ProgressBar } from "@/components/ProgressBar";
import { ScoreBadge } from "@/components/ScoreBadge";
import { SentenceRow } from "@/components/SentenceRow";
import type { DayStatus } from "@/lib/cycle";
import { renderWithIntl } from "../render";

describe("ProgressBar", () => {
  it("exposes its value to assistive tech", () => {
    renderWithIntl(<ProgressBar value={8} max={24} label="今日進度" />);
    const bar = screen.getByRole("progressbar", { name: "今日進度" });
    expect(bar.getAttribute("aria-valuenow")).toBe("8");
    expect(bar.getAttribute("aria-valuemax")).toBe("24");
    expect(screen.getByText("8 / 24")).toBeDefined();
  });

  it("draws one segment per step up to the limit", () => {
    renderWithIntl(
      <ProgressBar value={8} max={MAX_SEGMENTS} label="今日進度" />,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.dataset.mode).toBe("segmented");
    expect(bar.children).toHaveLength(MAX_SEGMENTS);
    expect(bar.querySelectorAll("[data-filled]")).toHaveLength(8);
  });

  it("switches to a continuous bar above the limit", () => {
    renderWithIntl(
      <ProgressBar value={20} max={MAX_SEGMENTS + 1} label="今日進度" />,
    );
    expect(screen.getByRole("progressbar").dataset.mode).toBe("continuous");
  });

  it("can hide the count when the label already says where you are", () => {
    renderWithIntl(
      <ProgressBar value={2} max={12} label="第 3 / 12 句" showCount={false} />,
    );
    expect(screen.getByText("第 3 / 12 句")).toBeDefined();
    expect(screen.queryByText("2 / 12")).toBeNull();
    expect(
      screen
        .getByRole("progressbar", { name: "第 3 / 12 句" })
        .getAttribute("aria-valuenow"),
    ).toBe("2");
  });

  it("clamps values outside 0…max", () => {
    renderWithIntl(<ProgressBar value={99} max={10} label="今日進度" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "10",
    );
  });
});

describe("ScoreBadge", () => {
  it("shows the percentage without a pass label below 80%", () => {
    renderWithIntl(<ScoreBadge score={0.79} />);
    expect(screen.getByText("79%")).toBeDefined();
    expect(screen.queryByText("通過")).toBeNull();
  });

  it("adds a text label (not only color) at 80% and above", () => {
    renderWithIntl(<ScoreBadge score={0.8} />, "en");
    expect(screen.getByText("80%")).toBeDefined();
    expect(screen.getByText("Passed")).toBeDefined();
  });
});

describe("SentenceRow", () => {
  it("marks English text with lang=en", () => {
    renderWithIntl(
      <SentenceRow index={0} status="pending">
        We moved to the city.
      </SentenceRow>,
    );
    expect(screen.getByText("We moved to the city.").getAttribute("lang")).toBe(
      "en",
    );
  });

  it("flags the current sentence and announces its status", () => {
    renderWithIntl(
      <SentenceRow index={3} status="current">
        It took a while.
      </SentenceRow>,
    );
    const row = screen.getByText("It took a while.").closest("[aria-current]");
    expect(row?.getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("第 4 句")).toBeDefined();
    expect(screen.getByText("進行中")).toBeDefined();
  });

  it("hides the text until answered", () => {
    renderWithIntl(
      <SentenceRow index={0} status="pending" hidden>
        Secret sentence.
      </SentenceRow>,
    );
    expect(screen.queryByText("Secret sentence.")).toBeNull();
    expect(screen.getByText("尚未作答")).toBeDefined();
  });

  it("becomes a button when selectable", async () => {
    const onSelect = vi.fn();
    renderWithIntl(
      <SentenceRow index={0} status="done" score={1} onSelect={onSelect}>
        Done sentence.
      </SentenceRow>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByText("100%")).toBeDefined();
  });
});

describe("DayTracker", () => {
  const statuses: DayStatus[] = [
    "done",
    "done",
    "today",
    "available",
    "locked",
    "locked",
    "locked",
  ];

  it("lists seven days with full screen-reader labels", () => {
    renderWithIntl(<DayTracker statuses={statuses} />);
    const list = screen.getByRole("list", { name: "七天進度" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("第 1 天，聽寫，已完成")).toBeDefined();
    expect(screen.getByText("第 3 天，跟讀，今天")).toBeDefined();
    expect(screen.getByText("第 7 天，重新聽寫，未解鎖")).toBeDefined();
  });

  it("only makes unlocked days clickable", async () => {
    const onSelect = vi.fn();
    renderWithIntl(
      <DayTracker statuses={statuses} onSelect={onSelect} />,
      "en",
    );

    expect(screen.getAllByRole("button")).toHaveLength(4);
    await userEvent.click(
      screen.getByRole("button", { name: "Day 4, Shadowing, Available" }),
    );
    expect(onSelect).toHaveBeenCalledWith(4);
  });
});
