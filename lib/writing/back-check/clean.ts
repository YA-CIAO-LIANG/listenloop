import type { BackCheckInput, BackJudgement } from "./types";

const hasHan = (text: string) => /\p{Script=Han}/u.test(text);
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/**
 * The model's answer made safe to show (D200): one judgement per asked
 * item (by `i`), the reason in Chinese; anything else dropped, so that
 * answer keeps its rule-based result.
 */
export function cleanBackCheck(
  value: unknown,
  input: BackCheckInput,
): Map<number, BackJudgement> {
  const out = new Map<number, BackJudgement>();
  const raw = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(raw)) return out;
  const asked = new Map(input.items.map((item) => [item.i, item]));
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const item = typeof e.i === "number" ? asked.get(e.i) : undefined;
    if (!item || out.has(item.i)) continue;
    if (typeof e.meaning !== "boolean" || typeof e.grammar !== "boolean")
      continue;
    const why = text(e.why, 300);
    if (!hasHan(why)) continue;
    const chinese = item.mode === "listen-zh";
    const better = chinese ? "" : text(e.better, 300);
    out.set(item.i, {
      meaning: e.meaning,
      grammar: chinese ? true : e.grammar,
      // A "better" version that is the reference or the answer itself
      // says nothing new.
      better:
        better && better !== item.answer.trim() && /[a-z]/i.test(better)
          ? better
          : "",
      why,
    });
  }
  return out;
}
