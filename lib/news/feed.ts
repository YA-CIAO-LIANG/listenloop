import { SKIP_HEADLINES } from "./sources";

/** One release from a feed. */
export type NewsItem = {
  title: string;
  link: string;
  /** The release's summary, as plain text. */
  summary: string;
  published: Date | null;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Text without tags, CDATA, or entities, spaces collapsed. */
export function plainText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
      if (code.startsWith("#x"))
        return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith("#"))
        return String.fromCodePoint(Number(code.slice(1)));
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** The items of an RSS 2.0 feed (title, link, description, pubDate). */
export function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const field = (name: string) =>
      plainText(
        new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(
          match[1],
        )?.[1] ?? "",
      );
    const title = field("title");
    const link = field("link");
    if (!title || !/^https:\/\//.test(link)) continue;
    const date = new Date(field("pubDate"));
    items.push({
      title,
      link,
      summary: field("description"),
      published: Number.isNaN(date.getTime()) ? null : date,
    });
  }
  return items;
}

/**
 * The releases worth a story: newest first, not used before, recent
 * (within `maxAgeDays`), with a summary long enough to have facts, and
 * not politics (SKIP_HEADLINES).
 */
export function pickNews(
  items: readonly NewsItem[],
  {
    used,
    now,
    maxAgeDays = 30,
    minSummaryChars = 120,
  }: {
    used: ReadonlySet<string>;
    now: Date;
    maxAgeDays?: number;
    minSummaryChars?: number;
  },
): NewsItem[] {
  const oldest = now.getTime() - maxAgeDays * 86_400_000;
  return items
    .filter(
      (item) =>
        !used.has(item.link) &&
        item.published !== null &&
        item.published.getTime() >= oldest &&
        item.published.getTime() <= now.getTime() + 86_400_000 &&
        item.summary.length >= minSummaryChars &&
        !SKIP_HEADLINES.test(item.title),
    )
    .sort((a, b) => b.published!.getTime() - a.published!.getTime());
}

/**
 * The facts of a release from its web page, when the feed's summary is
 * too short (D100): the text of its first paragraphs, up to `maxChars`.
 * Only given to the model to rewrite; never shown or kept.
 */
export function articleFacts(html: string, maxChars = 1500): string {
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  let text = "";
  for (const match of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const paragraph = plainText(match[1]);
    // Real sentences only: skip bylines, menus, and captions.
    if (paragraph.length < 60 || !/[.!?]["”’]?$/.test(paragraph)) continue;
    text = text ? `${text} ${paragraph}` : paragraph;
    if (text.length >= maxChars) break;
  }
  return text.slice(0, maxChars);
}

const STOP = new Set(
  "a an and are as at by for from in into is it its of on or the to with nasa noaa cdc new".split(
    " ",
  ),
);
const keywords = (title: string) =>
  new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );

/**
 * Whether two headlines are about the same thing (two or more keywords in
 * common), so one run doesn't make two stories on one topic.
 */
export function similarHeadlines(a: string, b: string): boolean {
  const words = keywords(b);
  return [...keywords(a)].filter((w) => words.has(w)).length >= 2;
}
