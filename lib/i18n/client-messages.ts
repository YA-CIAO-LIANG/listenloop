/**
 * Which messages reach the browser (D120). Server Components read every
 * message on the server; only Client Components need them in the page,
 * and next-intl would otherwise put all of them (about 137 KB) into every
 * page's HTML. Messages only server code uses never go; an area's
 * messages go only with that area's pages (its layout adds them).
 */
type Messages = Record<string, unknown>;

/** Used only by Server Components (tests/client-messages.test.ts checks). */
export const SERVER_ONLY_NAMESPACES = [
  "privacy",
  "terms",
  "refund",
  "learn",
  "blog",
  "metadata",
  "checkout",
  "collections",
  "redictation",
] as const;

/** Used by Client Components in one part of the site only. */
export const AREA_NAMESPACES = {
  admin: ["admin", "adminUsage", "adminOfficial"],
  materials: ["editPractice", "generate", "youtube", "upload"],
  classroom: ["classroom"],
  styleguide: ["styleguide"],
  // WritingLoop (D187): its pages only; the home page's tasks use
  // "writingTasks", sent everywhere.
  writing: ["writing", "writingChat"],
} as const;

export type MessageArea = keyof typeof AREA_NAMESPACES;

/** The messages a page in `area` (or anywhere, without one) sends. */
export function clientMessages(messages: Messages, area?: MessageArea) {
  const hidden = new Set<string>([
    ...SERVER_ONLY_NAMESPACES,
    ...Object.entries(AREA_NAMESPACES)
      .filter(([name]) => name !== area)
      .flatMap(([, namespaces]) => namespaces),
  ]);
  return Object.fromEntries(
    Object.entries(messages).filter(([namespace]) => !hidden.has(namespace)),
  );
}
