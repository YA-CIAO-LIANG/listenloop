/**
 * The FAQ page (D167): questions in display order, grouped. Each one's
 * text is in the message files under `faq.items.<id>.question` and
 * `.answer`; the page and its FAQPage structured data read the same text,
 * as Google asks (the answers people see and the ones in the data match).
 * Keep answers true to what the site does now (lib/plans.ts,
 * docs/quotas.md, the privacy policy).
 */
export const FAQ_GROUPS = [
  {
    id: "basics",
    items: ["what", "who", "free", "signIn"],
  },
  {
    id: "loop",
    items: ["loop", "unlock", "pass", "retry", "minutes"],
  },
  {
    id: "practice",
    items: ["shadowing", "materials", "exams", "create", "level"],
  },
  {
    id: "account",
    items: ["devices", "app", "delete"],
  },
] as const;

export type FaqId = (typeof FAQ_GROUPS)[number]["items"][number];

export const FAQ_IDS: readonly FaqId[] = FAQ_GROUPS.flatMap(
  (group) => group.items,
);
