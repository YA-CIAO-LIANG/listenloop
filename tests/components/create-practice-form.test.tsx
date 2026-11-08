import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreatePracticeForm } from "@/components/CreatePracticeForm";
import { PlanProvider } from "@/components/PlanProvider";
import type { PlanId } from "@/lib/plans";
import { renderWithIntl } from "../render";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// The real Server Actions can't run in a test DOM; the form takes them as props.
vi.mock("@/app/materials/actions", () => ({
  splitText: vi.fn(),
  translateSentences: vi.fn(),
  createPractice: vi.fn(),
  generatePracticeAudio: vi.fn(),
  generatePracticeNotes: vi.fn(),
  generatePracticeText: vi.fn(),
  describeDraft: vi.fn(),
}));

const split = vi.fn();
const translate = vi.fn();
const chinese: Record<string, string> = {
  "We moved here.": "我們搬來這裡。",
  "Do you like it?": "你喜歡嗎？",
};
const create = vi.fn();
const generate = vi.fn();
const generateNotes = vi.fn();
const generateText = vi.fn();
const describeTitles = vi.fn();

beforeEach(() => {
  router.refresh.mockReset();
  split.mockReset().mockResolvedValue({
    ok: true,
    sentences: ["We moved here.", "Do you like it?"],
  });
  translate.mockReset().mockImplementation(async (sentences: string[]) => ({
    ok: true,
    translations: sentences.map((en) => chinese[en] ?? `[zh] ${en}`),
  }));
  create.mockReset().mockResolvedValue({ ok: true, id: "p1" });
  generate.mockReset().mockResolvedValue({ ok: true, voiced: 1, total: 1 });
  generateNotes
    .mockReset()
    .mockResolvedValue({ ok: true, annotated: 1, total: 1 });
  // Writes what's missing, keeping what was typed (D83).
  describeTitles
    .mockReset()
    .mockImplementation(
      async (input: { titleEn: string; titleZh: string }) => ({
        ok: true,
        titleEn: input.titleEn.trim() || "Written English",
        titleZh: input.titleZh.trim() || "寫好的中文",
        subtitle: "寫好的副標題",
      }),
    );
});

/** On the paid plan by default: every length is offered (D94). */
async function renderForm(plan: PlanId = "paid") {
  await act(async () => {
    renderWithIntl(
      <PlanProvider plan={plan}>
        <CreatePracticeForm
          split={split}
          translate={translate}
          create={create}
          generate={generate}
          generateNotes={generateNotes}
          generateText={generateText}
          describe={describeTitles}
        />
      </PlanProvider>,
    );
  });
}

const textBox = () => screen.getByLabelText("文字內容");
const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

describe("CreatePracticeForm", () => {
  it("splits, lets the learner edit and delete, then creates", async () => {
    await renderForm();
    fireEvent.change(screen.getByLabelText("英文標題"), {
      target: { value: "Moving" },
    });
    fireEvent.change(textBox(), {
      target: { value: "We moved here. Do you like it?" },
    });
    await click("斷句並翻譯");
    expect(split).toHaveBeenCalledWith("We moved here. Do you like it?", "en");
    expect(translate).toHaveBeenCalledWith(
      ["We moved here.", "Do you like it?"],
      "en",
    );

    expect(screen.getByText("共 2 句")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("第 1 句英文"), {
      target: { value: "We moved here last year." },
    });
    await click("刪除第 2 句");
    fireEvent.click(screen.getByRole("button", { name: /^聲音：/ }));
    fireEvent.click(
      screen.getByRole("radio", { name: "William・男聲・澳洲英語" }),
      {
        detail: 1,
      },
    );
    await click("建立練習");
    expect(create).toHaveBeenCalledWith({
      // Typed English kept; the Chinese title and subtitle written (D83).
      titleEn: "Moving",
      titleZh: "寫好的中文",
      subtitle: "寫好的副標題",
      sourceLanguage: "en",
      voice: "au-male",
      meta: null,
      sentences: [{ en: "We moved here last year.", zh: "我們搬來這裡。" }],
    });
    // Notes come first, so they match the reviewed English; then audio.
    expect(generateNotes).toHaveBeenCalledWith("p1");
    expect(generate).toHaveBeenCalledWith("p1");
    expect(generateNotes.mock.invocationCallOrder[0]).toBeLessThan(
      generate.mock.invocationCallOrder[0],
    );
    expect(screen.getByRole("status").textContent).toContain(
      "已建立「Moving｜寫好的中文」，講解和音檔都完成了",
    );
    expect(router.refresh).toHaveBeenCalled();
    expect((textBox() as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps the practice and says so when its audio stops halfway", async () => {
    generate.mockResolvedValue({
      ok: false,
      reason: "limit",
      voiced: 1,
      total: 2,
    });
    await renderForm();
    fireEvent.change(screen.getByLabelText("英文標題"), {
      target: { value: "T" },
    });
    fireEvent.change(textBox(), { target: { value: "A. B." } });
    await click("斷句並翻譯");
    await click("建立練習");
    const status = screen.getByRole("status").textContent;
    expect(status).toContain("講解或音檔還沒有全部完成");
    expect(status).toContain("今天的聲音用量已經用完");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("guesses Chinese from the text until the learner picks a language", async () => {
    await renderForm();
    fireEvent.change(textBox(), { target: { value: "我們搬到城市了。" } });
    expect((screen.getByLabelText("中文") as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByLabelText("英文"));
    fireEvent.change(textBox(), { target: { value: "你好，再見。" } });
    expect((screen.getByLabelText("英文") as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("loads a .txt file and uses its name as the title", async () => {
    await renderForm();
    const file = new File(["﻿你好。"], "第一課.txt", { type: "text/plain" });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("選擇 .txt 檔"), {
        target: { files: [file] },
      });
    });
    expect((textBox() as HTMLTextAreaElement).value).toBe("你好。");
    // A Chinese file name is a Chinese title (D83).
    expect((screen.getByLabelText("中文標題") as HTMLInputElement).value).toBe(
      "第一課",
    );
  });

  it.each([
    [
      new File(["x"], "a.pdf", { type: "application/pdf" }),
      "請選擇 .txt 文字檔。",
    ],
    [
      new File([new Uint8Array([0xa7, 0x41])], "big5.txt", {
        type: "text/plain",
      }),
      "這個檔案無法正確讀取",
    ],
  ])("explains a file it can't use (%#)", async (file, message) => {
    await renderForm();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("選擇 .txt 檔"), {
        target: { files: [file] },
      });
    });
    expect(screen.getByRole("alert").textContent).toContain(message);
  });

  it("keeps the text and explains when today's limit is used up", async () => {
    translate.mockResolvedValue({ ok: false, reason: "limit" });
    await renderForm();
    fireEvent.change(textBox(), { target: { value: "Hello." } });
    await click("斷句並翻譯");
    expect(screen.getByRole("alert").textContent).toContain("今天的翻譯用量");
    expect((textBox() as HTMLTextAreaElement).value).toBe("Hello.");
  });

  it("points at the sentence the server rejected", async () => {
    create.mockResolvedValue({
      ok: false,
      reason: "invalid",
      problem: "sentence-empty",
      sentence: 1,
    });
    await renderForm();
    fireEvent.change(screen.getByLabelText("英文標題"), {
      target: { value: "T" },
    });
    fireEvent.change(textBox(), { target: { value: "A. B." } });
    await click("斷句並翻譯");
    await click("建立練習");
    expect(screen.getByRole("alert").textContent).toBe("第 2 句的英文是空的。");
    // Still on the review step with the sentences kept.
    expect(screen.getByLabelText("第 2 句英文")).toBeTruthy();
  });

  it("shows the real progress of each step while it works", async () => {
    const sentences = Array.from({ length: 10 }, (_, i) => `Line ${i}.`);
    split.mockResolvedValue({ ok: true, sentences });
    let finishBatch = () => {};
    translate.mockImplementation(
      (batch: string[]) =>
        new Promise((resolve) => {
          finishBatch = () =>
            resolve({
              ok: true,
              translations: batch.map((en) => `[zh] ${en}`),
            });
        }),
    );
    await renderForm();
    fireEvent.change(textBox(), { target: { value: sentences.join(" ") } });
    await click("斷句並翻譯");
    const bar = () => screen.getByRole("progressbar");
    expect(bar().getAttribute("aria-valuenow")).toBe("0");
    expect(bar().getAttribute("aria-label")).toBe("翻譯中 0/10 句");

    // The first batch of 8 is done: 80%.
    await act(async () => finishBatch());
    expect(bar().getAttribute("aria-valuenow")).toBe("80");
    expect(bar().getAttribute("aria-label")).toBe("翻譯中 8/10 句");
    expect(bar().getAttribute("aria-valuetext")).toBe("翻譯中 8/10 句 80%");

    await act(async () => finishBatch());
    expect(screen.getByText("共 10 句")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("merges a sentence with the next and splits one at the cursor", async () => {
    await renderForm();
    fireEvent.change(screen.getByLabelText("英文標題"), {
      target: { value: "T" },
    });
    fireEvent.change(textBox(), { target: { value: "x" } });
    await click("斷句並翻譯");

    await click("第 1 句與下一句合併");
    const first = screen.getByLabelText("第 1 句英文") as HTMLTextAreaElement;
    expect(first.value).toBe("We moved here. Do you like it?");
    expect(
      (screen.getByLabelText("第 1 句中文") as HTMLTextAreaElement).value,
    ).toBe("我們搬來這裡。你喜歡嗎？");
    expect(screen.getByText("共 1 句")).toBeTruthy();

    // No cursor inside the sentence yet: nothing to split.
    const split = () =>
      screen.getByRole("button", { name: "從游標處拆分第 1 句" });
    expect((split() as HTMLButtonElement).disabled).toBe(true);
    first.setSelectionRange(14, 14);
    fireEvent.select(first);
    expect((split() as HTMLButtonElement).disabled).toBe(false);
    await click("從游標處拆分第 1 句");
    expect(
      (screen.getByLabelText("第 1 句英文") as HTMLTextAreaElement).value,
    ).toBe("We moved here.");
    expect(
      (screen.getByLabelText("第 2 句英文") as HTMLTextAreaElement).value,
    ).toBe("Do you like it?");
    // The new sentence's Chinese is filled in when the practice is made.
    expect(
      (screen.getByLabelText("第 2 句中文") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("writes text with AI into the form to edit", async () => {
    generateText.mockReset().mockResolvedValue({
      ok: true,
      titleEn: "At the Store",
      titleZh: "在商店",
      subtitle: "在商店找牛奶的對話",
      text: "Where is the milk?\nIt's in aisle five.",
    });
    await renderForm();
    fireEvent.click(screen.getByLabelText("AI 生成"));
    // The title sits at the top of the form (D82).
    fireEvent.change(screen.getByLabelText("中文標題"), {
      target: { value: "我的期中報告" },
    });
    fireEvent.change(screen.getByLabelText("類別"), {
      target: { value: "campus" },
    });
    fireEvent.change(screen.getByLabelText("情境"), {
      target: { value: "office-hours" },
    });
    expect(screen.queryByLabelText(/主題或關鍵字/)).toBeNull();
    fireEvent.change(screen.getByLabelText("想練什麼？（選填）"), {
      target: { value: "請教授延後期中報告" },
    });
    fireEvent.click(screen.getByLabelText("高級"));
    fireEvent.click(screen.getByLabelText("4–5 分鐘"));
    fireEvent.click(screen.getByLabelText("對話"));
    fireEvent.click(screen.getByLabelText("英式"));
    await click("生成文字");
    expect(generateText).toHaveBeenCalledWith({
      topic: "",
      scenario: "office-hours",
      customScenario: "請教授延後期中報告",
      customCategory: "",
      titleEn: "",
      titleZh: "我的期中報告",
      level: "advanced",
      length: "4-5",
      format: "dialogue",
      accent: "gb",
    });
    // Back on the text form, filled in and editable; a dialogue's lines
    // are labeled with their speakers (D57).
    expect((textBox() as HTMLTextAreaElement).value).toBe(
      "A: Where is the milk?\nB: It's in aisle five.",
    );
    expect((screen.getByLabelText("英文標題") as HTMLInputElement).value).toBe(
      "At the Store",
    );
    expect((screen.getByLabelText("中文標題") as HTMLInputElement).value).toBe(
      "在商店",
    );
    expect((screen.getByLabelText("英文") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "已生成「At the Store｜在商店」",
    );
  });

  it("offers 30 seconds and a length of one's own, up to the plan's limit (D94)", async () => {
    generateText.mockReset().mockResolvedValue({
      ok: true,
      titleEn: "Hi",
      titleZh: "嗨",
      subtitle: "打招呼",
      text: "Hi there.",
    });
    await renderForm("free");
    fireEvent.click(screen.getByLabelText("AI 生成"));
    // The free plan allows 30 seconds: no minute-long choices.
    expect(screen.queryByLabelText("1–2 分鐘")).toBeNull();
    expect((screen.getByLabelText("30 秒") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByText(/你的方案每份最長 30 秒/)).toBeDefined();
    fireEvent.click(screen.getByLabelText("自訂"));
    fireEvent.change(screen.getByLabelText("分"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("秒"), { target: { value: "45" } });
    // Over the plan's 30 seconds: can't generate.
    expect(
      screen.getByRole("button", { name: /生成文字/ }).hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("秒"), { target: { value: "20" } });
    await click("生成文字");
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ length: "custom", seconds: 20 }),
    );
  });

  it("starts with a monologue, and takes a category of one's own (D82)", async () => {
    generateText.mockReset().mockResolvedValue({
      ok: true,
      titleEn: "Stars at Night",
      titleZh: "夜晚的星星",
      subtitle: "拍攝星空的入門說明",
      text: "Find a dark place.\nWait for your eyes to adjust.",
    });
    await renderForm();
    fireEvent.click(screen.getByLabelText("AI 生成"));
    expect((screen.getByLabelText("獨白") as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.change(screen.getByLabelText("類別"), {
      target: { value: "other" },
    });
    // No scenario list for one's own category; its name is required.
    expect(screen.queryByLabelText("情境")).toBeNull();
    expect(
      (screen.getByRole("button", { name: /生成文字/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("類別名稱（必填）"), {
      target: { value: "天文攝影" },
    });
    await click("生成文字");
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario: "",
        customCategory: "天文攝影",
        format: "monologue",
      }),
    );
  });

  it("explains when AI can't write the text", async () => {
    generateText.mockReset().mockResolvedValue({ ok: false, reason: "config" });
    await renderForm();
    fireEvent.click(screen.getByLabelText("AI 生成"));
    await click("生成文字");
    expect(screen.getByRole("alert").textContent).toContain("額度用完");
  });

  it("can't split text over the length limit", async () => {
    await renderForm();
    fireEvent.change(textBox(), { target: { value: "a".repeat(10_001) } });
    expect(
      (screen.getByRole("button", { name: "斷句並翻譯" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
