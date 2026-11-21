import type { NotebookEntry } from "../notebook";
import type { ChatCorrection, ChatMessage } from "./types";

/**
 * After a chat (D197): the three most important mistakes (by severity,
 * then the order they came), three natural ways of saying things (the
 * learner's own messages said naturally first, then the partner's
 * phrases), and the notebook items to review in 1, 3, and 7 days.
 */
export const SUMMARY_COUNT = 3;

export function chatSummary(messages: readonly ChatMessage[]): {
  mistakes: ChatCorrection[];
  phrases: { en: string; zh: string }[];
} {
  const corrections = messages
    .map((m, order) => ({ c: m.correction, order }))
    .filter((x): x is { c: ChatCorrection; order: number } => !!x.c);
  const mistakes = [...corrections]
    .sort((a, b) => b.c.severity - a.c.severity || a.order - b.order)
    .slice(0, SUMMARY_COUNT)
    .map((x) => x.c);
  const seen = new Set<string>();
  const phrases: { en: string; zh: string }[] = [];
  const add = (en: string, zh: string) => {
    const key = en.toLowerCase();
    if (!en || !zh || seen.has(key) || phrases.length >= SUMMARY_COUNT) return;
    seen.add(key);
    phrases.push({ en, zh });
  };
  for (const { c } of corrections) {
    if (c.natural !== c.fixed) add(c.natural, c.zh);
  }
  for (const m of messages) if (m.phrase) add(m.phrase.en, m.phrase.zh);
  for (const { c } of corrections) add(c.natural, c.zh);
  return { mistakes, phrases };
}

/**
 * The notebook's chat items: each mistake and natural phrase with its
 * Chinese, reviewed by writing the English from the Chinese.
 */
export function chatNotebookItems(
  chatId: string,
  messages: readonly ChatMessage[],
): Omit<NotebookEntry, "stage" | "due" | "added" | "at">[] {
  const { mistakes, phrases } = chatSummary(messages);
  return [
    ...mistakes
      .filter((c) => c.zh)
      .map((c, i) => ({
        id: `chat:${chatId}:m${i}`,
        kind: "chat" as const,
        promptId: "chat",
        text: c.zh,
        answer: c.natural,
        note: c.why,
        type: c.type,
      })),
    ...phrases.map((p, i) => ({
      id: `chat:${chatId}:p${i}`,
      kind: "chat" as const,
      promptId: "chat",
      text: p.zh,
      answer: p.en,
      note: "",
    })),
  ];
}
