import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeeklyReport } from "@/components/WeeklyReport";
import { WEEKLY_REPORT_DISMISSED_KEY } from "@/lib/weekly-report";
import { renderWithIntl } from "../render";

// 2026-11-23 is a Monday; last week is 11-16 to 11-22.
const activity = {
  days: {
    "2026-11-16": {
      official: false,
      retries: [],
      time: { phone: { sintel: 900 } },
    },
    "2026-11-18": {
      official: false,
      retries: [],
      time: { phone: { sintel: 300 } },
    },
  },
};

async function renderOn(date: Date) {
  vi.setSystemTime(date);
  renderWithIntl(<WeeklyReport />);
  await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  localStorage.setItem("ll-activity:v1", JSON.stringify(activity));
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("WeeklyReport", () => {
  it("sums up last week on Monday, with a suggestion", async () => {
    await renderOn(new Date(2026, 10, 23, 9));
    const report = screen.getByRole("region", { name: "上週學習報告" });
    expect(report.textContent).toContain("20 分鐘");
    expect(report.textContent).toContain("2 / 7 天");
    expect(report.textContent).toContain("沒有聽寫");
    expect(report.textContent).toContain("這週試著多練幾天");
  });

  it("stays hidden later in the week", async () => {
    await renderOn(new Date(2026, 10, 27, 9));
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("hides for the week once dismissed", async () => {
    await renderOn(new Date(2026, 10, 23, 9));
    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(screen.queryByRole("region")).toBeNull();
    expect(localStorage.getItem(WEEKLY_REPORT_DISMISSED_KEY)).toBe(
      "2026-11-23",
    );
  });
});
