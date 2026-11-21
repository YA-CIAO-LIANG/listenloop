/**
 * Self-harm in a chat (D197): checked on the learner's message before any
 * AI call, in Chinese and English, so help shows even if the model
 * misses it or is unavailable. When it matches, the practice stops: no
 * role-play, no correction, a gentle message and helplines. The model's
 * own "self-harm" verdict does the same for what words can't catch.
 */
const SIGNALS = [
  // Common warning signs that don't name it (the eval's filtered cases).
  /不想醒來|不要醒來|消失就好|沒有我(會|比較)好|沒有我大家|遺書|交代後事/,
  /\b(never wake up|not wake up|better off without me|goodbye (letter|note)s?|giv(e|ing) (all )?my (things|stuff|belongings) away|no reason to (live|go on)|disappear forever)\b/i,
  /自殺|自杀|輕生|轻生|尋死|寻死|想死|不想活|活不下去|結束生命|结束生命|自殘|自残|割腕|傷害自己|伤害自己|跳樓|跳楼/,
  /\b(kill(ing)? my ?self|suicid(e|al)|end(ing)? (it all|my life)|want to die|wanna die|self[- ]?harm|hurt(ing)? my ?self|cut(ting)? my ?self|don'?t want to (live|be alive))\b/i,
];

export const selfHarmSignal = (message: string) =>
  SIGNALS.some((pattern) => pattern.test(message));

/** Where to get help: Taiwan first (the learners), then the US. */
export const HELPLINES = [
  { id: "tw-1925", phone: "1925" },
  { id: "tw-1995", phone: "1995" },
  { id: "us-988", phone: "988" },
] as const;
