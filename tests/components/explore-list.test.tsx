import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExploreList } from "@/components/ExploreList";
import type { PublicPracticeSummary } from "@/lib/custom-practice/explore";
import { renderWithIntl } from "../render";

const practice = (
  title: string,
  sourceLanguage: "en" | "zh",
  sentenceCount: number,
  mine = false,
): PublicPracticeSummary => ({
  id: `p-${title.length}${sentenceCount}`,
  title,
  sourceLanguage,
  voice: "gb-male",
  sentenceCount,
  createdAt: "2026-11-04T00:00:00Z",
  mine,
});

const practices = [
  practice("Job Interview", "en", 6, true),
  practice("搬家到台北", "zh", 12),
  practice("Campus Tour", "en", 40),
];

const cardTitles = () =>
  screen
    .queryAllByRole("link")
    .map((link) => link.querySelector("p + p")?.textContent);

describe("ExploreList", () => {
  it("shows a card per practice with its source, voice, length, and owner", () => {
    renderWithIntl(<ExploreList practices={practices} />);
    expect(cardTitles()).toEqual([
      "Job Interview",
      "搬家到台北",
      "Campus Tour",
    ]);
    const first = screen.getAllByRole("link")[0];
    expect(first.getAttribute("href")).toBe("/videos/p-136");
    expect(first.textContent).toContain("英文原文 · 英式英語・男聲");
    expect(first.textContent).toContain("6 句 · 你建立的");
    expect(screen.getAllByRole("link")[1].textContent).not.toContain(
      "你建立的",
    );
  });

  it("searches titles and filters by language and length", () => {
    renderWithIntl(<ExploreList practices={practices} />);
    fireEvent.change(screen.getByLabelText("搜尋標題"), {
      target: { value: "tour" },
    });
    expect(cardTitles()).toEqual(["Campus Tour"]);
    expect(screen.getByText("顯示 1 份練習")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    fireEvent.click(screen.getByRole("button", { name: "中文（1）" }));
    expect(cardTitles()).toEqual(["搬家到台北"]);

    // Two lengths: either matches; with Chinese still on, none do.
    fireEvent.click(screen.getByRole("button", { name: "10 句以內（1）" }));
    fireEvent.click(screen.getByRole("button", { name: "31 句以上（1）" }));
    expect(cardTitles()).toEqual([]);
    expect(screen.getByText("沒有符合的練習。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "中文（1）" }));
    expect(cardTitles()).toEqual(["Job Interview", "Campus Tour"]);

    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    expect(cardTitles()).toHaveLength(3);
    expect(screen.queryAllByRole("button", { pressed: true })).toEqual([]);
  });

  it("says so when nothing is shared yet", () => {
    renderWithIntl(<ExploreList practices={[]} />);
    expect(screen.getByText("目前還沒有公開的練習。")).toBeTruthy();
    expect(screen.queryByLabelText("搜尋標題")).toBeNull();
  });
});
