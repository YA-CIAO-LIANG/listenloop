/**
 * Bilingual titles (D83): every material has an English and a Chinese
 * title, always English first. Older practices have only `title` (in
 * whichever language it was typed); it fills in until both are set.
 */
export type Titles = {
  /** English (or the only title an older practice has). */
  en: string;
  /** Traditional Chinese; null when there's none yet. */
  zh: string | null;
};

const hasHan = (text: string) => /\p{Script=Han}/u.test(text);

/** A practice row's titles, old rows included. */
export function practiceTitles(row: {
  title: string;
  title_en?: string | null;
  title_zh?: string | null;
}): Titles {
  const en = row.title_en ?? (hasHan(row.title) ? null : row.title);
  const zh = row.title_zh ?? (hasHan(row.title) ? row.title : null);
  return { en: en ?? row.title, zh: en ? zh : null };
}

/** "English Title｜中文標題" for places with room for one line only. */
export function oneLineTitle({ en, zh }: Titles): string {
  return zh && zh !== en ? `${en}｜${zh}` : en;
}

/** Letters of the Latin alphabet: an English title has some. */
export const looksEnglish = (text: string) => /[A-Za-z]/.test(text);

/**
 * The titles to save (D83): what the learner typed in each language is
 * kept exactly (its ends trimmed); a language left empty takes the
 * written one. Never the other way round.
 */
export function keepTypedTitles(
  typed: { en?: unknown; zh?: unknown },
  written: { en?: unknown; zh?: unknown },
): { en: string; zh: string } {
  const text = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  return {
    en: text(typed.en) || text(written.en),
    zh: text(typed.zh) || text(written.zh),
  };
}
