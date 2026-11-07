import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OfficialLibrary } from "@/components/OfficialLibrary";
import type { PublicPracticeSummary } from "@/lib/custom-practice/explore";
import { renderWithIntl } from "../render";

const practice = (
  title: string,
  category: string | null,
  exam: string | null = null,
): PublicPracticeSummary => ({
  id: `p-${title}`,
  title,
  sourceLanguage: "en",
  voice: "us-female",
  sentenceCount: 10,
  createdAt: "2026-11-07T00:00:00Z",
  mine: false,
  category,
  exam,
});

describe("OfficialLibrary (D57)", () => {
  it("filters by category, then by exam", () => {
    renderWithIntl(
      <OfficialLibrary
        practices={[
          practice("Coffee", "daily-life"),
          practice("Lecture", "exam", "toefl"),
          practice("Part 1", "exam", "ielts"),
        ]}
      />,
    );
    const titles = () =>
      screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(titles()).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "考試聽力" }));
    expect(titles()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "雅思 IELTS 風格" }));
    expect(titles()).toHaveLength(1);
    expect(titles()[0]).toContain("Part 1");
    // Pressing the chosen category again shows everything.
    fireEvent.click(screen.getByRole("button", { name: /考試聽力/ }));
    expect(titles()).toHaveLength(3);
  });

  it("has no filters when everything is in one category", () => {
    renderWithIntl(
      <OfficialLibrary
        practices={[practice("A", "news"), practice("B", "news")]}
      />,
    );
    expect(screen.queryByRole("group")).toBeNull();
  });
});
