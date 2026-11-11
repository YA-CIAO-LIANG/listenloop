import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanProvider } from "@/components/PlanProvider";
import { UploadCreate, type BrowserAudio } from "@/components/UploadCreate";
import type { PlanId } from "@/lib/plans";
import { renderWithIntl } from "../render";

vi.mock("@/app/materials/actions", () => ({
  generatePracticeAudio: vi.fn(),
  generatePracticeNotes: vi.fn(),
  translateSentences: vi.fn(),
}));
vi.mock("@/app/materials/upload-actions", () => ({
  createUploadPractice: vi.fn(),
  startAudioUpload: vi.fn(),
  transcribeAudio: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const RATE = 16_000;
const PATH =
  "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.mp3";

/** 1 s quiet, 2 s "speech", 1 s quiet, 2 s "speech", 1 s quiet. */
function samples(): Float32Array {
  const parts: [number, boolean][] = [
    [1, false],
    [2, true],
    [1, false],
    [2, true],
    [1, false],
  ];
  const out = new Float32Array(7 * RATE);
  let at = 0;
  for (const [seconds, loud] of parts) {
    for (let i = at; i < at + seconds * RATE; i++) {
      out[i] = loud ? 0.3 * Math.sin(i / 10) : 0.0005 * Math.sin(i);
    }
    at += seconds * RATE;
  }
  return out;
}

const record = vi.fn(async () => ({ ok: true }));

function setup(plan: PlanId = "paid") {
  record.mockClear();
  const browser: BrowserAudio = {
    duration: vi.fn(async () => 7),
    decode: vi.fn(async () => samples()),
    encode: vi.fn(async () => new Blob(["mp3"], { type: "audio/mpeg" })),
    upload: vi.fn(async () => true),
  };
  const start = vi.fn(async () => ({
    ok: true as const,
    path: PATH,
    token: "t0k",
  }));
  const transcribe = vi.fn(async (form: FormData) => {
    const pieces = JSON.parse(String(form.get("pieces"))) as {
      start: number;
      end: number;
    }[];
    return {
      ok: true as const,
      heard: pieces.map((piece, i) => ({
        ...piece,
        text: ["Good morning everyone.", "Let's talk about sleep."][i] ?? "",
      })),
    };
  });
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
      <UploadCreate
        browser={browser}
        start={start}
        transcribe={transcribe}
        create={create}
        translate={translate}
        generateNotes={generateNotes}
        generate={generate}
        record={record}
      />
    </PlanProvider>,
  );
  return { browser, start, transcribe, translate, create, generateNotes };
}

const click = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText("選擇 MP3 或 MP4 檔案"), {
    target: { files: [file] },
  });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:recording");
  URL.revokeObjectURL = vi.fn();
});

describe("UploadCreate (D130)", () => {
  it("takes out the sound, uploads it, writes it down, and saves", async () => {
    const { browser, start, transcribe, translate, create, generateNotes } =
      setup();
    const video = new File(["x".repeat(2000)], "talk.mp4", {
      type: "video/mp4",
    });
    pick(video);
    await click(/讀取並轉成文字/);

    // Only the sound goes up: the MP3 the browser made, not the video.
    expect(start).toHaveBeenCalledWith({
      sourceBytes: 2000,
      bytes: 3,
      seconds: 7,
    });
    expect(browser.upload).toHaveBeenCalledWith(PATH, "t0k", expect.any(Blob));
    // Two pieces of speech, sent as WAV with their places.
    const form = transcribe.mock.calls[0][0];
    const pieces = JSON.parse(String(form.get("pieces")));
    expect(pieces).toHaveLength(2);
    expect(form.get("piece-0")).toBeInstanceOf(Blob);
    expect(form.get("path")).toBe(PATH);

    // The preview: each sentence's words and times can be changed.
    const first = screen.getByLabelText("第 1 句英文") as HTMLTextAreaElement;
    expect(first.value).toBe("Good morning everyone.");
    fireEvent.change(first, { target: { value: "Good morning, everyone." } });
    fireEvent.change(screen.getByLabelText("第 2 句開始時間"), {
      target: { value: "0:04.2" },
    });

    await click("翻譯");
    expect(translate).toHaveBeenCalledWith(
      ["Good morning, everyone.", "Let's talk about sleep."],
      "en",
    );
    expect(
      (screen.getByLabelText("第 2 句中文") as HTMLTextAreaElement).value,
    ).toBe("中：Let's talk about sleep.");

    await click("建立練習");
    expect(create).toHaveBeenCalledWith({
      path: PATH,
      seconds: 7,
      titleEn: "Good morning everyone.",
      titleZh: "",
      sentences: [
        expect.objectContaining({ en: "Good morning, everyone." }),
        expect.objectContaining({
          en: "Let's talk about sleep.",
          start: 4.2,
        }),
      ],
    });
    expect(generateNotes).toHaveBeenCalledWith("p1");
    expect(
      screen.getByRole("link", { name: /開始練習/ }).getAttribute("href"),
    ).toBe("/videos/p-p1");
  });

  it("joins and removes sentences in the preview", async () => {
    const { create } = setup();
    pick(new File(["x"], "talk.mp3", { type: "audio/mpeg" }));
    await click(/讀取並轉成文字/);
    await click("第 1 句與下一句合併");
    expect(
      (screen.getByLabelText("第 1 句英文") as HTMLTextAreaElement).value,
    ).toBe("Good morning everyone. Let's talk about sleep.");
    expect(screen.queryByLabelText("第 2 句英文")).toBeNull();
    await click("翻譯");
    await click("建立練習");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sentences: [
          expect.objectContaining({
            en: "Good morning everyone. Let's talk about sleep.",
          }),
        ],
      }),
    );
  });

  it("says why a file can't be used, before uploading anything", async () => {
    const { start, browser } = setup();
    pick(new File(["x"], "talk.wav", { type: "audio/wav" }));
    await click(/讀取並轉成文字/);
    expect(screen.getByRole("alert").textContent).toContain("只能上傳 MP3");
    // Longer than Plus allows (5 minutes).
    vi.mocked(browser.duration).mockResolvedValue(400);
    pick(new File(["x"], "long.mp3", { type: "audio/mpeg" }));
    await click(/讀取並轉成文字/);
    expect(screen.getByRole("alert").textContent).toContain("超過你的方案上限");
    // Nothing but silence.
    vi.mocked(browser.duration).mockResolvedValue(3);
    vi.mocked(browser.decode).mockResolvedValue(new Float32Array(3 * RATE));
    pick(new File(["x"], "quiet.mp3", { type: "audio/mpeg" }));
    await click(/讀取並轉成文字/);
    expect(screen.getByRole("alert").textContent).toContain("聽不到說話");
    expect(start).not.toHaveBeenCalled();
  });

  it("explains a used-up month", async () => {
    const { transcribe } = setup();
    transcribe.mockResolvedValueOnce({ ok: false, reason: "limit" } as never);
    pick(new File(["x"], "talk.mp3", { type: "audio/mpeg" }));
    await click(/讀取並轉成文字/);
    expect(screen.getByRole("alert").textContent).toContain(
      "語音轉文字額度已經用完",
    );
  });

  it("is a Plus feature: the free plan sees what it is and the plans", () => {
    setup("free");
    expect(screen.queryByLabelText("選擇 MP3 或 MP4 檔案")).toBeNull();
    expect(
      screen.getByRole("link", { name: /看方案/ }).getAttribute("href"),
    ).toBe("/pricing?from=upload");
    expect(record).toHaveBeenCalledWith({
      step: "unlock_click",
      item: "upload-practice",
      source: "upload",
    });
  });
});
