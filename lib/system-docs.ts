/**
 * The system documents (docs/system/<language>/<doc>.md): the technical
 * system manual, the admin manual, and the user manual, in Traditional
 * Chinese and English with the same structure. Admins read them on
 * /admin/docs.
 */
export const SYSTEM_DOCS = ["system", "admin", "user"] as const;
export type SystemDoc = (typeof SYSTEM_DOCS)[number];

export const SYSTEM_DOC_LANGUAGES = ["zh-Hant", "en"] as const;
export type SystemDocLanguage = (typeof SYSTEM_DOC_LANGUAGES)[number];

/** Where a document lives, relative to the project root. */
export const systemDocPath = (language: SystemDocLanguage, doc: SystemDoc) =>
  `docs/system/${language}/${doc}.md`;

/** The ?doc= value, or the system manual. */
export const parseSystemDoc = (value: unknown): SystemDoc =>
  (SYSTEM_DOCS as readonly unknown[]).includes(value)
    ? (value as SystemDoc)
    : "system";

/** The ?lang= value, or the interface language when it's one of them. */
export function parseSystemDocLanguage(
  value: unknown,
  fallback: string,
): SystemDocLanguage {
  if ((SYSTEM_DOC_LANGUAGES as readonly unknown[]).includes(value)) {
    return value as SystemDocLanguage;
  }
  return fallback === "en" ? "en" : "zh-Hant";
}

/**
 * A heading's anchor, as GitHub makes it, so the documents' tables of
 * contents work both on GitHub and on /admin/docs: lowercase, punctuation
 * dropped (letters, digits, spaces, and hyphens stay, in any script),
 * spaces turned into hyphens.
 */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}
