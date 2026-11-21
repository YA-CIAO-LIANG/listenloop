import { selfHarmSignal } from "./safety";
import type { ChatTurnInput } from "./types";

/**
 * The fake provider's chat partner (D197): deterministic, in the model's
 * answer format, for development, tests, and E2E. Never calls an API.
 * A few rules find mistakes the way the real partner would report them.
 */
const RULES: {
  test: RegExp;
  fix: (m: string) => string;
  type: string;
  why: string;
  zh: string;
}[] = [
  {
    test: /\b(he|she|it) (go|want|like|have|do)\b/i,
    fix: (m) =>
      m
        .replace(/\b(go|do)$/i, "$1es")
        .replace(/\bhave$/i, "has")
        .replace(/\b(want|like)$/i, "$1s"),
    type: "verb",
    why: "第三人稱單數的現在式動詞要加 -s。",
    zh: "（他／她）去／想要……",
  },
  {
    test: /\byesterday i (go|eat|see|have)\b/i,
    fix: (m) =>
      m
        .replace(/go$/i, "went")
        .replace(/eat$/i, "ate")
        .replace(/see$/i, "saw")
        .replace(/have$/i, "had"),
    type: "verb",
    why: "說昨天的事要用過去式。",
    zh: "我昨天……",
  },
  {
    test: /\ba (apple|orange|hour|egg|idea)\b/i,
    fix: (m) => m.replace(/^a /i, "an "),
    type: "article",
    why: "母音開頭的字前面用 an。",
    zh: "一個……",
  },
];

const OFF_LIMITS =
  /\b(ignore (all|previous|the) (rules|instructions)|system prompt|you are now|girlfriend|boyfriend|date me|kiss|sexy|kill (him|her|them)|buy drugs)\b/i;

export function fakeChatTurn(input: ChatTurnInput) {
  const message = input.message.trim();
  if (selfHarmSignal(message)) {
    return {
      safety: "self-harm",
      reply:
        "謝謝你願意說出來。你不是一個人，現在就找一位信任的人聊聊，或撥打求助專線。",
      correction: blank(),
      phrase: { en: "", zh: "" },
      glossary: [],
    };
  }
  if (OFF_LIMITS.test(message)) {
    return {
      safety: "redirect",
      reply:
        "Let's keep it friendly and talk about something else. What are your plans this weekend?",
      correction: blank(),
      phrase: { en: "", zh: "" },
      glossary: [],
    };
  }
  let correction = blank();
  for (const rule of RULES) {
    const match = message.match(rule.test);
    if (!match) continue;
    const fixedPart = rule.fix(match[0]);
    const fixed = message.replace(match[0], fixedPart);
    correction = {
      needed: true,
      original: match[0],
      fixed,
      why: rule.why,
      natural: fixed,
      zh: rule.zh,
      type: rule.type,
      severity: 2,
    };
    break;
  }
  const turn = input.history.filter((m) => m.from === "them").length;
  const replies = [
    "That sounds great! What did you do after that?",
    "Oh, really? How did you feel about it?",
    "Nice. By the way, do you have any plans for the weekend?",
    "I see what you mean. Could you tell me a bit more?",
  ];
  const reply = replies[turn % replies.length];
  const phrases: Record<string, { en: string; zh: string }> = {
    "That sounds great": { en: "That sounds great", zh: "聽起來很棒" },
    "Oh, really": { en: "Oh, really", zh: "喔，真的嗎" },
    "By the way": { en: "By the way", zh: "順帶一提" },
    "I see what you mean": { en: "I see what you mean", zh: "我懂你的意思" },
  };
  const phrase = Object.entries(phrases).find(([key]) =>
    reply.startsWith(key),
  )?.[1] ?? { en: "", zh: "" };
  return {
    safety: "ok",
    reply,
    correction,
    phrase,
    glossary: reply.includes("weekend")
      ? [{ word: "weekend", zh: "週末" }]
      : [{ word: "feel", zh: "感覺" }],
  };
}

function blank() {
  return {
    needed: false,
    original: "",
    fixed: "",
    why: "",
    natural: "",
    zh: "",
    type: "grammar",
    severity: 1,
  };
}
