import { CATEGORY_IDS, OTHER_CATEGORY, type CategoryId } from "./categories";

/**
 * Topic landing pages (D116): one public page per category, for search
 * engines and for sharing ("English listening practice for studying
 * abroad"), listing that category's official materials. "Other" (the
 * learner's own categories) has none.
 */
export type LearnCategory = Exclude<CategoryId, typeof OTHER_CATEGORY>;

export const LEARN_CATEGORIES = CATEGORY_IDS.filter(
  (id): id is LearnCategory => id !== OTHER_CATEGORY,
);

export const isLearnCategory = (value: unknown): value is LearnCategory =>
  (LEARN_CATEGORIES as readonly unknown[]).includes(value);

/** A landing page's address. */
export const learnPath = (category: LearnCategory) => `/learn/${category}`;
