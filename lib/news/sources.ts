/**
 * Where news materials come from (D100): trusted sources whose releases
 * may be reused freely. ListenLoop never uses a release's text: the facts
 * are rewritten in its own words (NEWS_INSTRUCTIONS), and the practice
 * says what it was rewritten from, with a link.
 *
 * Each source is a U.S. federal agency: its releases are works of the
 * U.S. government, in the public domain (17 U.S.C. § 105).
 *
 * Left out, and why:
 * - VOA Learning English: public domain too, but its feeds haven't been
 *   updated since March 2025;
 * - news agencies (AP, Reuters, AFP): their text is licensed, and the
 *   project doesn't use them (CLAUDE.md);
 * - the State Department and the White House: mostly politics, which
 *   isn't the course's subject.
 */
export type NewsSource = {
  id: string;
  name: string;
  /** RSS 2.0 feed of news releases. */
  feed: string;
  /** The news scenario its stories file under (lib/categories.ts). */
  scenario: "news-science" | "news-environment" | "news-health";
};

export const NEWS_SOURCES: readonly NewsSource[] = [
  {
    id: "nasa",
    name: "NASA",
    feed: "https://www.nasa.gov/news-release/feed/",
    scenario: "news-science",
  },
  {
    id: "noaa",
    name: "NOAA",
    feed: "https://www.noaa.gov/news-release/rss.xml",
    scenario: "news-environment",
  },
  {
    id: "cdc",
    name: "CDC",
    feed: "https://tools.cdc.gov/api/v2/resources/media/132608.rss",
    scenario: "news-health",
  },
];

/**
 * Headlines left out: politics and policy announcements, which date fast
 * and aren't neutral listening practice; and daily picture posts.
 */
export const SKIP_HEADLINES =
  /\b(trump|biden|administration|congress|senate|election|tariff|secretary|strategy|budget|lawsuit|APOD)\b/i;

/** News materials made in one scheduled run, and their run budget. */
export const NEWS_PER_RUN = 3;
export const NEWS_RUN_BUDGET_USD = 0.3;
