import { modelSentencesAligned } from "./back-translation";
import { splitSentences } from "./drills";
import { WRITING_LEVELS, WRITING_TYPES, type WritingPrompt } from "./types";

/**
 * What's wrong with an official writing prompt (D187), or nothing. The
 * build fails on a published prompt with problems (data/writing/index.ts);
 * a draft only needs its id and type. Also the automatic check P2's
 * prompts pass before they're published.
 */
export function writingPromptProblems(value: unknown): string[] {
  const p = value as Partial<WritingPrompt> | null;
  if (!p || typeof p !== "object") return ["not an object"];
  const problems: string[] = [];
  const need = (ok: unknown, what: string) => {
    if (!ok) problems.push(what);
  };
  need(
    typeof p.id === "string" &&
      p.id.length <= 40 &&
      /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id),
    "id (kebab-case, at most 40 characters)",
  );
  need(WRITING_TYPES.includes(p.type as never), "type");
  if (p.draft) return problems;
  need(WRITING_LEVELS.includes(p.level as never), "level");
  need(p.title?.en && p.title?.zh, "title");
  need(
    typeof p.subtitle === "string" &&
      p.subtitle.length > 0 &&
      p.subtitle.length <= 60,
    "subtitle (1–60)",
  );
  need(typeof p.task === "string" && p.task.length >= 20, "task");
  need(typeof p.taskZh === "string" && p.taskZh.length >= 10, "taskZh");
  need(
    p.words &&
      Number.isInteger(p.words.min) &&
      Number.isInteger(p.words.max) &&
      p.words.min >= 20 &&
      p.words.max >= p.words.min,
    "words",
  );
  need(
    Number.isInteger(p.minutes) && p.minutes! >= 5 && p.minutes! <= 60,
    "minutes (5–60)",
  );
  need(
    Array.isArray(p.focus) && p.focus.length >= 2 && p.focus.length <= 4,
    "focus (2–4)",
  );
  const en = p.model?.en ?? [];
  const zh = p.model?.zh ?? [];
  need(
    en.length >= 1 && en.length === zh.length,
    "model: en and zh paragraphs",
  );
  need(
    zh.every((z) => typeof z === "string" && z.length > 0),
    "model zh",
  );
  // Each model sentence has its Chinese, for back-translation (D195).
  need(
    en.length === zh.length && modelSentencesAligned({ model: { en, zh } }),
    "model: as many Chinese sentences as English in each paragraph",
  );
  if (p.words && en.length) {
    const count = en.join(" ").split(/\s+/).filter(Boolean).length;
    // The model may be a little over the target, never far under it.
    need(
      count >= p.words.min * 0.9 && count <= p.words.max * 1.3,
      `model length (${count} words)`,
    );
  }
  if (p.type === "chart")
    need(p.chart && p.chart.rows.length >= 2, "chart data");
  if (p.type === "ielts-task1")
    need(p.chart && p.chart.rows.length >= 2, "chart data");
  const patterns = p.patterns ?? [];
  need(patterns.length >= 3 && patterns.length <= 5, "patterns (3–5)");
  const model = en.join(" ").toLowerCase();
  for (const [i, pattern] of patterns.entries()) {
    need(pattern.pattern && pattern.zh && pattern.example, `pattern ${i}`);
    need(
      model.includes(pattern.example?.toLowerCase() ?? "\u0000"),
      `pattern ${i}: example is in the model`,
    );
    need(
      Array.isArray(pattern.keys) && pattern.keys.length >= 1,
      `pattern ${i}: keys`,
    );
    const example = ` ${pattern.example?.toLowerCase().replace(/[^a-z0-9' ]+/g, " ")} `;
    for (const key of pattern.keys ?? []) {
      need(
        example.replace(/\s+/g, " ").includes(` ${key.toLowerCase()} `),
        `pattern ${i}: key "${key}" in its example`,
      );
    }
  }
  need((p.combine ?? []).length >= 1, "combine drills");
  for (const [i, c] of (p.combine ?? []).entries()) {
    need(c.parts?.length >= 2 && c.answer, `combine ${i}`);
  }
  need((p.paraphrase ?? []).length >= 1, "paraphrase drills");
  for (const [i, d] of (p.paraphrase ?? []).entries()) {
    need(d.sentence && d.answers?.length >= 1, `paraphrase ${i}`);
  }
  need(
    en.some((para) => splitSentences(para).length >= 3),
    "a model paragraph of 3+ sentences (reorder)",
  );
  return problems;
}
