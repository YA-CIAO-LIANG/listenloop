import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoreSection } from "@/components/ScoreSection";
import { recordTask, type Activity } from "@/lib/activity";
import { renderWithIntl } from "../render";

const recordIntent = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("@/app/intent-actions", () => ({ recordIntent }));

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-accent");
});

/** `days` official days in a row, each with 5 perfect sentences. */
function activityWith(days: number): Activity {
  let activity: Activity = { days: {} };
  for (let i = 0; i < days; i++) {
    const date = `2026-11-${String(i + 1).padStart(2, "0")}`;
    activity = recordTask(activity, date, {
      videoId: "sintel",
      week: 1,
      day: (i % 7) + 1,
      perfect: 5,
    });
  }
  return activity;
}

function renderScore(days: number) {
  renderWithIntl(
    <ScoreSection
      progresses={[]}
      activity={activityWith(days)}
      titleOf={() => "Sintel"}
    />,
  );
}

describe("ScoreSection (D93)", () => {
  it("shows the score, its history, and what it unlocks", () => {
    renderScore(4); // 4 × (10 + 10) + 3 × 5 = 95
    expect(screen.getByText("95")).toBeDefined();
    expect(screen.getByText("再 5 分解鎖「青綠」")).toBeDefined();
    expect(screen.getAllByText("完成「Sintel」第 1 天").length).toBe(1);
    expect(
      screen.getByRole("radio", { name: /青綠/ }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("switches the site's accent to an unlocked color and remembers it", () => {
    renderScore(5); // 5 × 20 + 4 × 5 = 120
    fireEvent.click(screen.getByRole("radio", { name: /青綠/ }));
    expect(document.documentElement.getAttribute("data-accent")).toBe("teal");
    expect(localStorage.getItem("ll-accent")).toBe("teal");
    fireEvent.click(screen.getByRole("radio", { name: /橘/ }));
    expect(document.documentElement.hasAttribute("data-accent")).toBe(false);
  });

  it("offers a paid unlock as a fake door: records interest, charges nothing", () => {
    renderScore(1);
    fireEvent.click(
      screen.getAllByRole("button", { name: "NT$30 永久解鎖" })[0],
    );
    expect(recordIntent).toHaveBeenLastCalledWith({
      step: "unlock_click",
      item: "accent-teal",
      source: "color-unlock",
    });
    expect(screen.getByText(/現在不會收費/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "加入名單" }));
    expect(recordIntent).toHaveBeenLastCalledWith({
      step: "waitlist_join",
      item: "accent-teal",
      source: "color-unlock",
    });
    expect(screen.getByText("已加入名單，謝謝！")).toBeDefined();
  });
});
