import type { BackCheckInput, BackInconsistency, BackJudgement } from "./types";

/**
 * A note worth showing: in Chinese (a few characters at least, not a
 * cut-off word) and not mixed with Japanese kana.
 */
const usableNote = (text: string) =>
  (text.match(/\p{Script=Han}/gu)?.length ?? 0) >= 4 &&
  !/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** What a Chinese note says of the meaning or the grammar (D205). */
const SAYS = {
  meaningRight:
    /(意思|語意|意義)(上)?(都|也|完全|基本上|大致|仍然|還是)?(正確|相同|一樣|一致|不變|沒有(改變|變)|沒變|對)/,
  meaningWrong:
    /(意思|語意|意義)(上)?(不同|不一樣|錯|有誤|改變|變了|有出入)|(意思|語意|意義)不(正確|對|一樣|相同|一致)/,
  grammarRight: /文法(上)?(都|也|完全)?(正確|沒有(問題|錯)|沒問題|無誤|沒錯)/,
  grammarWrong: /文法(上)?(錯|有誤|不正確|有問題|有錯)|文法不(對|正確)/,
};

/**
 * Whether a note says the opposite of a verdict (D205): it claims the
 * meaning (or the grammar) is right when the field says wrong, or the
 * other way round, without also saying what the field says.
 */
export function noteContradicts(
  note: string,
  verdict: Pick<BackJudgement, "meaning" | "grammar">,
): boolean {
  const against = (right: boolean, saysRight: RegExp, saysWrong: RegExp) =>
    right
      ? saysWrong.test(note) && !saysRight.test(note)
      : saysRight.test(note) && !saysWrong.test(note);
  return (
    against(verdict.meaning, SAYS.meaningRight, SAYS.meaningWrong) ||
    against(verdict.grammar, SAYS.grammarRight, SAYS.grammarWrong)
  );
}

/**
 * The model's answer made safe to show (D200, D205): one judgement per
 * asked item (by `i`); anything else dropped, so that answer keeps its
 * rule-based result. The verdicts are the fields: a note that says the
 * opposite of them is dropped, and each disagreement is reported (the
 * usage log and the eval count them).
 */
export function cleanBackCheck(
  value: unknown,
  input: BackCheckInput,
  onInconsistent?: (found: BackInconsistency) => void,
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
    const chinese = item.mode === "listen-zh";
    const verdict = { meaning: e.meaning, grammar: chinese ? true : e.grammar };
    const note = (field: BackInconsistency["field"], value: unknown) => {
      let said = text(value, 300);
      // Not in Chinese, cut off, or mixed: dropped, as if there were none.
      if (!usableNote(said)) said = "";
      if (said && noteContradicts(said, verdict)) {
        onInconsistent?.({ i: item.i, field, kind: "contradicts" });
        return "";
      }
      if (!said && !verdict[field]) {
        onInconsistent?.({ i: item.i, field, kind: "missing" });
      }
      return said;
    };
    const meaningWhy = note("meaning", e.meaningWhy);
    const grammarWhy = chinese ? "" : note("grammar", e.grammarWhy);
    const better = chinese ? "" : text(e.better, 300);
    out.set(item.i, {
      ...verdict,
      meaningWhy,
      grammarWhy,
      // A "better" version that is the reference or the answer itself
      // says nothing new.
      better:
        better && better !== item.answer.trim() && /[a-z]/i.test(better)
          ? better
          : "",
    });
  }
  return out;
}
