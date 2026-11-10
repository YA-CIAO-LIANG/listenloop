import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlanProvider } from "@/components/PlanProvider";
import { YouTubeCreate } from "@/components/YouTubeCreate";
import type { PlanId } from "@/lib/plans";
import { renderWithIntl } from "../render";

vi.mock("@/app/materials/actions", () => ({
  generatePracticeAudio: vi.fn(),
  generatePracticeNotes: vi.fn(),
  translateSentences: vi.fn(),
}));
vi.mock("@/app/materials/youtube-actions", () => ({
  createYouTubePractice: vi.fn(),
  lookupYouTube: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const video = {
  id: "ccVideo0001",
  title: "Open Lecture: How Sleep Works",
  channel: "Open Science Channel",
  license: "creativeCommon" as const,
  durationSeconds: 300,
  embeddable: true,
};

const record = vi.fn(async () => ({ ok: true }));

function setup(plan: PlanId = "paid") {
  record.mockClear();
  const lookup = vi.fn(async () => ({ ok: true as const, video }));
  const translate = vi.fn(async (lines: string[]) => ({
    ok: true as const,
    translations: lines.map((line) => `中：${line}`),
  }));
  const create = vi.fn(async () => ({ ok: true as const, id: "p1" }));
  const generateNotes = vi.fn(async () => ({
    ok: true as const,
    annotated: 2,
    total: 2,
  }));
  const generate = vi.fn(async () => ({
    ok: true as const,
    voiced: 2,
    total: 2,
  }));
  renderWithIntl(
    <PlanProvider plan={plan}>
      <YouTubeCreate
        lookup={lookup}
        translate={translate}
        create={create}
        generateNotes={generateNotes}
        generate={generate}
        record={record}
      />
    </PlanProvider>,
  );
  return { lookup, translate, create, generateNotes };
}

const click = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

describe("YouTubeCreate (D97)", () => {
  it("reads the video, splits its transcript by time, translates, and saves", async () => {
    const { lookup, translate, create, generateNotes } = setup();
    fireEvent.change(screen.getByLabelText("YouTube 影片連結"), {
      target: { value: "https://youtu.be/ccVideo0001" },
    });
    await click("讀取影片");
    expect(lookup).toHaveBeenCalledWith("https://youtu.be/ccVideo0001");
    expect(screen.getByText(/可以設為公開/)).toBeDefined();

    fireEvent.change(screen.getByLabelText("字幕記錄（含時間）"), {
      target: {
        value: "0:01\nso how does\n0:03\nsleep work?\n0:05\nLet's find out.",
      },
    });
    await click(/斷句並翻譯/);
    expect(translate).toHaveBeenCalledWith(
      ["so how does sleep work?", "Let's find out."],
      "en",
    );
    expect(screen.getByText("0:01–0:04")).toBeDefined();
    expect((screen.getByLabelText("英文標題") as HTMLInputElement).value).toBe(
      video.title,
    );

    await click("建立練習");
    expect(create).toHaveBeenCalledWith({
      url: "ccVideo0001",
      titleEn: video.title,
      titleZh: "",
      sentences: [
        expect.objectContaining({
          en: "so how does sleep work?",
          zh: "中：so how does sleep work?",
          start: 1,
          end: 4.9,
        }),
        expect.objectContaining({ en: "Let's find out.", start: 5 }),
      ],
    });
    expect(generateNotes).toHaveBeenCalledWith("p1");
    expect(
      screen.getByRole("link", { name: /開始練習/ }).getAttribute("href"),
    ).toBe("/videos/p-p1");
  });

  it("keeps a part within the plan's length", async () => {
    setup("paid");
    fireEvent.change(screen.getByLabelText("YouTube 影片連結"), {
      target: { value: "ccVideo0001" },
    });
    await click("讀取影片");
    const long = Array.from(
      { length: 40 },
      (_, i) =>
        `${Math.floor((i * 10) / 60)}:${String((i * 10) % 60).padStart(2, "0")}\nLine ${i}.`,
    ).join("\n");
    fireEvent.change(screen.getByLabelText("字幕記錄（含時間）"), {
      target: { value: long },
    });
    await click(/斷句並翻譯/);
    expect(screen.getByRole("alert").textContent).toContain("超過你的方案上限");
    fireEvent.change(screen.getByLabelText("到"), {
      target: { value: "1:00" },
    });
    await click(/斷句並翻譯/);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("is a paid feature: the free plan sees what it is and the plans", () => {
    setup("free");
    expect(screen.queryByLabelText("YouTube 影片連結")).toBeNull();
    expect(
      screen.getByRole("link", { name: /看方案/ }).getAttribute("href"),
    ).toBe("/pricing?from=youtube");
    // Opening it is interest in paying, recorded once (D129).
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({
      step: "unlock_click",
      item: "youtube-practice",
      source: "youtube",
    });
  });

  it("records nothing for plans that can use it", () => {
    setup("paid");
    expect(record).not.toHaveBeenCalled();
  });
});
