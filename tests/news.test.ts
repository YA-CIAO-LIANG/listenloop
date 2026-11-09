import { describe, expect, it } from "vitest";
import { articleFacts, parseRss, pickNews, plainText } from "@/lib/news/feed";
import { NEWS_SOURCES } from "@/lib/news/sources";

const feed = `<?xml version="1.0"?><rss><channel><title>Agency</title>
<item><title>Moon Base Student Challenge Opens</title><link>https://www.nasa.gov/a</link>
<description><![CDATA[<p>NASA opened a $1 million challenge for students &amp; teams to design a Moon base. Teams have until spring to send in their ideas, and winners will visit a NASA center.</p>]]></description>
<pubDate>Sun, 08 Nov 2026 15:26:38 +0000</pubDate></item>
<item><title>Trump Administration releases a strategy</title><link>https://www.noaa.gov/b</link>
<description>${"Facts. ".repeat(30)}</description><pubDate>Sat, 07 Nov 2026 10:00:00 +0000</pubDate></item>
<item><title>Old news</title><link>https://www.nasa.gov/c</link>
<description>${"Facts. ".repeat(30)}</description><pubDate>Mon, 01 Jan 2024 10:00:00 +0000</pubDate></item>
<item><title>No link</title><description>x</description></item>
</channel></rss>`;

describe("news materials (D100)", () => {
  it("reads an RSS feed's items as plain text", () => {
    const items = parseRss(feed);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      title: "Moon Base Student Challenge Opens",
      link: "https://www.nasa.gov/a",
    });
    expect(items[0].summary).toContain("students & teams");
    expect(items[0].summary).not.toContain("<p>");
    expect(plainText("a&#8217;s &lt;b&gt;")).toBe("a’s <b>");
  });

  it("picks recent, unused, non-political releases with enough facts", () => {
    const now = new Date("2026-11-08T20:00:00Z");
    const items = parseRss(feed);
    expect(
      pickNews(items, { used: new Set(), now }).map((i) => i.link),
    ).toEqual(["https://www.nasa.gov/a"]);
    expect(
      pickNews(items, { used: new Set(["https://www.nasa.gov/a"]), now }),
    ).toEqual([]);
  });

  it("takes a release page's first real paragraphs as its facts", () => {
    const html = `<nav><p>Home</p></nav><script>var x = "<p>no</p>";</script>
      <p>By the press office</p>
      <p>Forecasters said a strong El Niño is likely to shape the coming winter across the country.</p>
      <p>Wetter weather is expected in the south, while the north may stay warmer than usual.</p>`;
    expect(articleFacts(html)).toBe(
      "Forecasters said a strong El Niño is likely to shape the coming winter across the country. Wetter weather is expected in the south, while the north may stay warmer than usual.",
    );
    expect(articleFacts(html, 50)).toHaveLength(50);
  });

  it("only lists sources it can reuse, each on a news scenario", () => {
    for (const source of NEWS_SOURCES) {
      expect(source.feed).toMatch(/^https:\/\/[^/]+\.gov\//);
      expect(source.scenario).toMatch(/^news-/);
    }
  });
});
