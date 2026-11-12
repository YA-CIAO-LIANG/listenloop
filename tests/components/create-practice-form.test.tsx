import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreatePracticeForm } from "@/components/CreatePracticeForm";
import { PlanProvider } from "@/components/PlanProvider";
import type { ReviseText } from "@/components/RevisePanel";
import type { PlanId } from "@/lib/plans";
import { renderWithIntl } from "../render";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// The real Server Actions can't run in a test DOM; the form takes them as props.
const recordTime = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/app/materials/generation-time-actions", () => ({
  recordGenerationTime: recordTime,
}));
vi.mock("@/app/materials/actions", () => ({
  splitText: vi.fn(),
  translateSentences: vi.fn(),
  createPractice: vi.fn(),
  generatePracticeAudio: vi.fn(),
  generatePracticeNotes: vi.fn(),
  generatePracticeText: vi.fn(),
  describeDraft: vi.fn(),
  reviseDraft: vi.fn(),
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
async function renderForm(
  planOrProps: PlanId | { create?: typeof create; sitePace?: number } = "paid",
) {
  const plan = typeof planOrProps === "string" ? planOrProps : "paid";
  const props = typeof planOrProps === "string" ? {} : planOrProps;
  const createAction = props.create ?? create;
  await act(async () => {
    renderWithIntl(
      <PlanProvider plan={plan}>
        <CreatePracticeForm
          split={split}
          translate={translate}
          create={createAction}
          generate={generate}
          generateNotes={generateNotes}
          generateText={generateText}
          describe={describeTitles}
          sitePace={props.sitePace}
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
  it.each([
    [false, false],
    ["no-key" as const, true],
  ])(
    "shows the YouTube source only when set up, or to an admin with a note (D129): %s",
    async (youtube, shown) => {
      await act(async () => {
        renderWithIntl(
          <PlanProvider plan="admin">
            <CreatePracticeForm youtube={youtube} />
          </PlanProvider>,
        );
      });
      const option = screen.queryByRole("radio", { name: "YouTube 連結" });
      expect(option !== null).toBe(shown);
      if (!option) return;
      await act(async () => fireEvent.click(option));
      expect(screen.getByText("尚未設定 YouTube API 金鑰")).toBeTruthy();
      expect(
        screen.getByRole("link", { name: /前往設定診斷/ }).getAttribute("href"),
      ).toBe("/admin/usage");
      expect(screen.queryByLabelText("YouTube 影片連結")).toBeNull();
    },
  );

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
    // How long it should take, before creating (D95): 2 × 2 s.
    expect(screen.getByText(/建立後預計約/).textContent).toBe(
      "建立後預計約 10 秒可以開始練習。",
    );
    // Its length from the actual words, at 150 a minute (D142): 7 words.
    expect(screen.getByText(/^長度約/).textContent).toBe(
      "長度約 3 秒（7 個字，以每分鐘約 150 字估算）。",
    );
    expect(screen.queryByText(/可以離開這個頁面/)).toBeNull();
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
    // No refresh: on the free plan it would swap the form (and this
    // message) for the plan card (D137). The result offers the practice.
    expect(router.refresh).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: /開始練習/ }).getAttribute("href"),
    ).toBe("/videos/p-p1");
    expect((textBox() as HTMLTextAreaElement).value).toBe("");
    // This device's pace is remembered for the next estimate (D95).
    expect(
      JSON.parse(localStorage.getItem("ll-gen-speed:v1") ?? "null"),
    ).toMatchObject({ samples: 1 });
    localStorage.removeItem("ll-gen-speed:v1");
    // …and the site's, from every device (D142).
    expect(recordTime).toHaveBeenCalledWith("p1", expect.any(Number));
  });

  it("estimates from the site's real times when known (D142)", async () => {
    await renderForm({ sitePace: 10 });
    fireEvent.change(textBox(), {
      target: { value: "We moved here. Do you like it?" },
    });
    await click("斷句並翻譯");
    expect(screen.getByText(/建立後預計約/).textContent).toBe(
      "建立後預計約 20 秒可以開始練習。",
    );
  });

  async function renderWithRevise(revise: ReviseText) {
    await act(async () => {
      renderWithIntl(
        <PlanProvider plan="paid">
          <CreatePracticeForm
            split={split}
            translate={translate}
            create={create}
            generate={generate}
            generateNotes={generateNotes}
            generateText={generateText}
            describe={describeTitles}
            revise={revise}
          />
        </PlanProvider>,
      );
    });
    fireEvent.change(screen.getByLabelText(/^英文標題/), {
      target: { value: "My Move" },
    });
    fireEvent.change(textBox(), {
      target: { value: "We moved here. Do you like it?" },
    });
    await click("斷句並翻譯");
    translate.mockClear();
  }

  async function instruct(instruction: string) {
    fireEvent.change(screen.getByLabelText("修改指令"), {
      target: { value: instruction },
    });
    await click("修改");
  }

  const english = (n: number) =>
    (screen.getByLabelText(`第 ${n} 句英文`) as HTMLTextAreaElement).value;

  it("previews a revision, applies it translating only what changed, and undoes (D96, D123)", async () => {
    const revise = vi.fn<ReviseText>(async () => ({
      ok: true,
      status: "changed",
      lines: ["We moved here.", "Do you love it?"],
    }));
    await renderWithRevise(revise);
    await instruct("換成更簡單的單字");
    expect(revise).toHaveBeenCalledWith({
      lines: ["We moved here.", "Do you like it?"],
      instruction: "換成更簡單的單字",
      format: "monologue",
    });
    // Nothing is written or translated before "apply".
    expect(screen.getByText("預覽修改")).toBeTruthy();
    expect(screen.getByText(/預覽好了：修改後共 2 句，其中 1 句/)).toBeTruthy();
    expect(translate).not.toHaveBeenCalled();
    expect(english(2)).toBe("Do you like it?");

    await click("套用");
    // Only the changed sentence is translated again.
    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate).toHaveBeenCalledWith(["Do you love it?"], "en");
    expect(english(2)).toBe("Do you love it?");
    expect(
      (screen.getByLabelText("第 1 句中文") as HTMLTextAreaElement).value,
    ).toBe("我們搬來這裡。");
    expect(
      screen.getByText(/已套用：2 句中有 1 句是新的或改過的/),
    ).toBeTruthy();

    await click("復原上一步");
    expect(english(2)).toBe("Do you like it?");
    expect(
      screen
        .getByRole("button", { name: "復原上一步" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("rewrites the style into more sentences and keeps the title (D123)", async () => {
    const revise = vi.fn<ReviseText>(async () => ({
      ok: true,
      status: "changed",
      lines: [
        "We moved here, in the dark.",
        "Do you like it, in the dark?",
        "Then the lights went out.",
      ],
    }));
    await renderWithRevise(revise);
    await instruct("改成恐怖風");
    expect(screen.getAllByText("改過")).toHaveLength(3);
    await click("套用");
    expect(english(3)).toBe("Then the lights went out.");
    expect((screen.getByLabelText(/^英文標題/) as HTMLInputElement).value).toBe(
      "My Move",
    );
  });

  it("discards a preview without changing anything", async () => {
    await renderWithRevise(async () => ({
      ok: true,
      status: "changed",
      lines: ["We moved here.", "Do you love it?"],
    }));
    await instruct("換成更簡單的單字");
    await click("不要這個修改");
    expect(english(2)).toBe("Do you like it?");
    expect(translate).not.toHaveBeenCalled();
    expect(screen.getByText("沒有套用，原本的內容沒有變。")).toBeTruthy();
  });

  it.each([
    [
      { ok: false, reason: "failed" } as const,
      "修改失敗，請稍後再試。原本的內容沒有變。",
    ],
    [
      { ok: false, reason: "filtered" } as const,
      /這個指令的內容無法產生，請換個說法/,
    ],
    [
      {
        ok: false,
        reason: "filtered",
        detail: "可以改成輕微懸疑。",
      } as const,
      /請換個說法.*可以改成輕微懸疑。/,
    ],
    [
      { ok: true, status: "unchanged", reason: "已經很簡單了。" } as const,
      "AI 判斷不需要修改：已經很簡單了。",
    ],
    [
      { ok: true, status: "unchanged", reason: "" } as const,
      /AI 沒有改動任何句子/,
    ],
  ])(
    "says why when nothing changes, never '0 sentences changed' (%j)",
    async (answer, message) => {
      await renderWithRevise(async () => answer);
      await instruct("改成恐怖風");
      expect(screen.getByText(message)).toBeTruthy();
      expect(screen.queryByText(/有 0 句/)).toBeNull();
      expect(screen.queryByText("預覽修改")).toBeNull();
      expect(english(2)).toBe("Do you like it?");
    },
  );

  it("suggests leaving a long job, and the server finishes it if the page closes (D95)", async () => {
    // 60 sentences at the default 2 s each (D142).
    const sentences = Array.from({ length: 60 }, (_, i) => `Line ${i}.`);
    split.mockResolvedValueOnce({ ok: true, sentences });
    translate.mockImplementation(async (batch: string[]) => ({
      ok: true,
      translations: batch.map(() => "一句。"),
    }));
    await renderForm();
    fireEvent.change(textBox(), { target: { value: sentences.join(" ") } });
    await click("斷句並翻譯");
    expect(screen.getByText(/預計約 2 分鐘/).textContent).toContain(
      "可以離開這個頁面",
    );

    // Notes never finish here: the page is closed midway.
    let finishNotes: (value: unknown) => void = () => {};
    generateNotes.mockImplementationOnce(
      () => new Promise((resolve) => (finishNotes = resolve)),
    );
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: beacon,
      configurable: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "建立練習" }));
    await act(async () => {});
    window.dispatchEvent(new Event("pagehide"));
    expect(beacon).toHaveBeenCalledWith("/materials/p1/prepare");
    await act(async () => finishNotes({ ok: false, reason: "failed" }));
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
    expect(router.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /到我的教材/ })).toBeDefined();
  });

  it("shows why creating failed, next to the button, every time (D137)", async () => {
    await renderForm({
      create: vi.fn(async () => ({
        ok: false as const,
        reason: "plan" as const,
        limit: "maxPracticeSeconds" as const,
        max: 30,
      })),
    });
    fireEvent.change(screen.getByLabelText("英文標題"), {
      target: { value: "T" },
    });
    fireEvent.change(textBox(), { target: { value: "A. B." } });
    await click("斷句並翻譯");
    await click("建立練習");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("最長 30 秒");
    expect(document.activeElement).toBe(alert);
  });

  it("says so when the create request itself fails (D137)", async () => {
    await renderForm({
      create: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    fireEvent.change(screen.getByLabelText("英文標題"), {
      target: { value: "T" },
    });
    fireEvent.change(textBox(), { target: { value: "A. B." } });
    await click("斷句並翻譯");
    await click("建立練習");
    expect(screen.getByRole("alert").textContent).toContain("發生錯誤");
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

  it("offers the lengths up to the plan's limit and a length of one's own (D94, D143)", async () => {
    generateText.mockReset().mockResolvedValue({
      ok: true,
      titleEn: "Hi",
      titleZh: "嗨",
      subtitle: "打招呼",
      text: "Hi there.",
    });
    await renderForm("free");
    fireEvent.click(screen.getByLabelText("AI 生成"));
    // The free plan allows 2 minutes: nothing longer.
    expect(screen.getByLabelText("30 秒")).toBeDefined();
    expect(screen.getByLabelText("1–2 分鐘")).toBeDefined();
    expect(screen.queryByLabelText("2–3 分鐘")).toBeNull();
    expect(screen.getByText(/你的方案每份最長 2 分鐘/)).toBeDefined();
    fireEvent.click(screen.getByLabelText("自訂"));
    fireEvent.change(screen.getByLabelText("分"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("秒"), { target: { value: "30" } });
    // Over the plan's 2 minutes: can't generate.
    expect(
      screen.getByRole("button", { name: /生成文字/ }).hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("分"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("秒"), { target: { value: "20" } });
    await click("生成文字");
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ length: "custom", seconds: 80 }),
    );
  });

  it("says how much of the week is left when the length doesn't fit (D143)", async () => {
    generateText.mockReset().mockResolvedValue({
      ok: false,
      reason: "weekLeft",
      max: 40,
    });
    await renderForm("free");
    fireEvent.click(screen.getByLabelText("AI 生成"));
    await click("生成文字");
    expect(screen.getByRole("alert").textContent).toContain(
      "本週只剩 40 秒可以建立",
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
    // One's own category is the default (D154): no scenario list.
    expect((screen.getByLabelText("類別") as HTMLSelectElement).value).toBe(
      "other",
    );
    expect(screen.queryByLabelText("情境")).toBeNull();
    fireEvent.change(screen.getByLabelText("類別名稱（選填）"), {
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

  it("starts on a category of one's own with the cursor in it; left empty, AI's category shows in the review to change (D154)", async () => {
    generateText.mockReset().mockResolvedValue({
      ok: true,
      titleEn: "Splitting the Power Bill",
      titleZh: "分攤電費",
      subtitle: "室友討論電費怎麼分",
      text: "The bill came today.\nLet's split it by use.",
      category: "money-admin",
    });
    await renderForm();
    fireEvent.click(screen.getByLabelText("AI 生成"));
    const name = screen.getByLabelText("類別名稱（選填）");
    expect(document.activeElement).toBe(name);
    // Nothing typed at all still writes: AI picks the topic.
    expect(
      (screen.getByRole("button", { name: /生成文字/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    fireEvent.change(screen.getByLabelText("想練什麼？（選填）"), {
      target: { value: "跟室友討論怎麼分攤電費" },
    });
    await click("生成文字");
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario: "",
        customCategory: "",
        customScenario: "跟室友討論怎麼分攤電費",
      }),
    );
    await click("斷句並翻譯");
    const guessed = screen.getByLabelText("類別") as HTMLSelectElement;
    expect(guessed.value).toBe("money-admin");
    expect(screen.getByText("AI 依內容判斷的類別，可以修改。")).toBeTruthy();
    fireEvent.change(guessed, { target: { value: "relationships" } });
    await click("建立練習");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: {
          category: "relationships",
          scenario: null,
          level: "intermediate",
          exam: null,
          examTarget: null,
        },
      }),
    );
  });

  it("files a text as Other when AI can't tell (D154)", async () => {
    generateText.mockReset().mockResolvedValue({
      ok: true,
      titleEn: "A Walk",
      titleZh: "散步",
      subtitle: "散步",
      text: "We walked.\nIt was nice.",
      category: null,
    });
    await renderForm();
    fireEvent.click(screen.getByLabelText("AI 生成"));
    await click("生成文字");
    await click("斷句並翻譯");
    expect((screen.getByLabelText("類別") as HTMLSelectElement).value).toBe(
      "other",
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
