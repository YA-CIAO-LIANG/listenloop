import { normalizeWords } from "../../scoring/normalize";
import { isErrorType } from "../types";
import type { ChatCorrection, ChatTurn } from "./types";

/**
 * The model's turn, made safe to show and keep (D197): known values
 * only, short texts, a correction only when it changes something, and a
 * phrase or glossary word only when it's in the reply. Null when there's
 * no reply to show.
 */
export const MAX_REPLY = 500;
const MAX_FIELD = 300;
export const MAX_GLOSSARY = 6;

const text = (value: unknown, max = MAX_FIELD) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const hasHan = (value: string) => /\p{Script=Han}/u.test(value);
const same = (a: string, b: string) =>
  normalizeWords(a).join(" ") === normalizeWords(b).join(" ");
const inside = (part: string, whole: string) =>
  part.length > 0 && whole.toLowerCase().includes(part.toLowerCase());

function cleanCorrection(raw: unknown, message: string): ChatCorrection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.needed !== true) return null;
  const fixed = text(r.fixed);
  const why = text(r.why);
  // A "correction" that changes nothing isn't one.
  if (!fixed || !why || same(fixed, message)) return null;
  const original = text(r.original);
  const severity = Number(r.severity);
  const zh = text(r.zh);
  return {
    original: inside(original, message)
      ? original
      : message.slice(0, MAX_FIELD),
    fixed,
    why,
    natural: text(r.natural) || fixed,
    zh: hasHan(zh) ? zh : "",
    type: isErrorType(r.type) ? r.type : "grammar",
    severity: severity === 2 || severity === 3 ? severity : 1,
  };
}

export function cleanChatTurn(raw: unknown, message: string): ChatTurn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const reply = text(r.reply, MAX_REPLY);
  if (!reply) return null;
  const safety =
    r.safety === "redirect" || r.safety === "self-harm" ? r.safety : "ok";
  if (safety === "self-harm") {
    return { safety, reply, correction: null, phrase: null, glossary: [] };
  }
  const p = (r.phrase ?? {}) as Record<string, unknown>;
  const phraseEn = text(p.en, 120);
  const phraseZh = text(p.zh, 120);
  const seen = new Set<string>();
  const glossary = (Array.isArray(r.glossary) ? r.glossary : [])
    .map((g) => {
      const item = (g ?? {}) as Record<string, unknown>;
      return { word: text(item.word, 60), zh: text(item.zh, 60) };
    })
    .filter((g) => {
      const key = g.word.toLowerCase();
      if (!inside(g.word, reply) || !hasHan(g.zh) || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, MAX_GLOSSARY);
  return {
    safety,
    reply,
    correction: cleanCorrection(r.correction, message),
    phrase:
      inside(phraseEn, reply) && hasHan(phraseZh)
        ? { en: phraseEn, zh: phraseZh }
        : null,
    glossary,
  };
}
