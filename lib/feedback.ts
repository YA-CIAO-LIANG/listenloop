/** Feedback from the footer's form (D60). */
export const FEEDBACK_CATEGORIES = [
  "bug",
  "suggestion",
  "content",
  "account",
  "other",
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_MAX_CHARS = 2000;

/** Feedback a signed-in account may send in one day (Taiwan time). */
export const FEEDBACK_PER_DAY = 10;

export type FeedbackInput = {
  category: FeedbackCategory;
  message: string;
  /** The page it was sent from, a path on this site. */
  page: string | null;
};

/** The form's input checked and tidied, or null if it isn't usable. */
export function cleanFeedback(raw: unknown): FeedbackInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const message =
    typeof r.message === "string"
      ? r.message.replace(/[ \t]+/g, " ").trim()
      : "";
  if (
    !(FEEDBACK_CATEGORIES as readonly unknown[]).includes(r.category) ||
    !message ||
    [...message].length > FEEDBACK_MAX_CHARS
  ) {
    return null;
  }
  const page =
    typeof r.page === "string" && /^\/[^\s]{0,199}$/.test(r.page)
      ? r.page
      : null;
  return { category: r.category as FeedbackCategory, message, page };
}
