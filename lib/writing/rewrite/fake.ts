import type { RewriteInput } from "./types";

/**
 * The fake provider's rewrite (D218), for tests, development, and E2E:
 * deterministic word rules, in the model's answer format, never an API.
 * "fix" corrects a few common mistakes; "natural" also swaps a few plain
 * phrases; "advanced" uses longer words; "easier" and "harder" step the
 * shown version down or up. Real enough to walk the whole flow.
 */
const FIXES: [RegExp, string][] = [
  [/\b(he|she|it) (go|do)\b/gi, "$1 $2es"],
  [/\b(he|she|it) have\b/gi, "$1 has"],
  [/\b(he|she|it) (want|like)\b/gi, "$1 $2s"],
  [
    /\ba (apple|hour|umbrella|interesting|important|old|exam|idea)\b/gi,
    "an $1",
  ],
  [/\bgoed\b/gi, "went"],
  [/\bvery like\b/gi, "really like"],
  [/\bin the weekend\b/gi, "on the weekend"],
  [/^i /, "I "],
];
const NATURAL: [RegExp, string][] = [
  [/\bvery good\b/gi, "great"],
  [/\bvery happy\b/gi, "really happy"],
];
const ADVANCED: [RegExp, string][] = [
  [/\bgreat\b/gi, "wonderful"],
  [/\bgood\b/gi, "excellent"],
  [/\bhappy\b/gi, "delighted"],
  [/\bbig\b/gi, "enormous"],
  [/\bbut\b/gi, "nevertheless"],
  [/\bimportant\b/gi, "significant"],
];
const EASIER: [RegExp, string][] = [
  [/\bwonderful\b/gi, "nice"],
  [/\bexcellent\b/gi, "good"],
  [/\bdelighted\b/gi, "glad"],
  [/\benormous\b/gi, "big"],
  [/\bnevertheless\b/gi, "but"],
  [/\bsignificant\b/gi, "big"],
  [/\bgreat\b/gi, "good"],
  [/\breally\b/gi, "so"],
];

const apply = (text: string, rules: [RegExp, string][]) =>
  rules.reduce((t, [re, to]) => t.replace(re, to), text);

export function fakeRewrite(input: RewriteInput) {
  if (
    input.sentences.some((s) =>
      /write (it|this|the essay) for me|幫我寫/i.test(s.en),
    )
  ) {
    return { declined: "ghostwrite", items: [] };
  }
  return {
    declined: "none",
    items: input.sentences.map(({ i, en }) => {
      let revised = apply(en, FIXES);
      if (input.adjust) {
        // Adjusting: `en` is the version shown.
        const base = en;
        revised =
          input.adjust === "easier"
            ? apply(base, EASIER)
            : apply(apply(base, NATURAL), ADVANCED);
      } else if (input.level !== "fix") {
        revised = apply(revised, NATURAL);
        if (input.level === "advanced") revised = apply(revised, ADVANCED);
      }
      const changed = revised !== en;
      return {
        i,
        revised,
        why: changed ? "（測試）修正了用字或文法。" : "",
        zh: `（測試）第 ${i + 1} 句的中文意思。`,
      };
    }),
  };
}
