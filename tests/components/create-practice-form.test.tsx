import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreatePracticeForm } from "@/components/CreatePracticeForm";
import { renderWithIntl } from "../render";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// The real Server Actions can't run in a test DOM; the form takes them as props.
vi.mock("@/app/materials/actions", () => ({
  prepareSentences: vi.fn(),
  createPractice: vi.fn(),
  generatePracticeAudio: vi.fn(),
  generatePracticeNotes: vi.fn(),
}));

const prepare = vi.fn();
const create = vi.fn();
const generate = vi.fn();
const generateNotes = vi.fn();

beforeEach(() => {
  router.refresh.mockReset();
  prepare.mockReset().mockResolvedValue({
    ok: true,
    sentences: [
      { en: "We moved here.", zh: "我們搬來這裡。" },
      { en: "Do you like it?", zh: "你喜歡嗎？" },
    ],
  });
  create.mockReset().mockResolvedValue({ ok: true, id: "p1" });
  generate.mockReset().mockResolvedValue({ ok: true, voiced: 1, total: 1 });
  generateNotes.mockReset().mockResolvedValue({ ok: true });
});

async function renderForm() {
  await act(async () => {
    renderWithIntl(
      <CreatePracticeForm
        prepare={prepare}
        create={create}
        generate={generate}
        generateNotes={generateNotes}
      />,
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
    fireEvent.change(screen.getByLabelText("標題"), {
      target: { value: "Moving" },
    });
    fireEvent.change(textBox(), {
      target: { value: "We moved here. Do you like it?" },
    });
    await click("斷句並翻譯");
    expect(prepare).toHaveBeenCalledWith(
      "We moved here. Do you like it?",
      "en",
    );

    expect(screen.getByText("共 2 句")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("第 1 句英文"), {
      target: { value: "We moved here last year." },
    });
    await click("刪除第 2 句");
    fireEvent.click(screen.getByLabelText("男聲"));
    fireEvent.click(screen.getByLabelText("澳洲"));
    await click("建立練習");
    expect(create).toHaveBeenCalledWith({
      title: "Moving",
      sourceLanguage: "en",
      voice: "au-male",
      sentences: [{ en: "We moved here last year.", zh: "我們搬來這裡。" }],
    });
    // Notes come first, so they match the reviewed English; then audio.
    expect(generateNotes).toHaveBeenCalledWith("p1");
    expect(generate).toHaveBeenCalledWith("p1");
    expect(generateNotes.mock.invocationCallOrder[0]).toBeLessThan(
      generate.mock.invocationCallOrder[0],
    );
    expect(screen.getByRole("status").textContent).toContain(
      "已建立「Moving」，講解和音檔都完成了",
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
    fireEvent.change(screen.getByLabelText("標題"), { target: { value: "T" } });
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
    expect((screen.getByLabelText("標題") as HTMLInputElement).value).toBe(
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
    prepare.mockResolvedValue({ ok: false, reason: "limit" });
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
    fireEvent.change(screen.getByLabelText("標題"), { target: { value: "T" } });
    fireEvent.change(textBox(), { target: { value: "A. B." } });
    await click("斷句並翻譯");
    await click("建立練習");
    expect(screen.getByRole("alert").textContent).toBe("第 2 句的英文是空的。");
    // Still on the review step with the sentences kept.
    expect(screen.getByLabelText("第 2 句英文")).toBeTruthy();
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
