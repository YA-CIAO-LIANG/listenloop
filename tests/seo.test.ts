import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { BLOG_POSTS, blogPath, postsForTopic } from "@/lib/blog";
import { FAQ_GROUPS, FAQ_IDS } from "@/lib/faq";
import { detectLocale } from "@/lib/i18n/detect-locale";
import { LEARN_CATEGORIES, learnPath } from "@/lib/learn";
import { isIndexableMaterial } from "@/lib/practice-material";
import {
  languageAlternates,
  localizedUrl,
  ogText,
  PUBLIC_PAGES,
  seoMetadata,
  serializeJsonLd,
} from "@/lib/seo";
import { PRIVATE_PATHS, SITE_URL, siteVerification } from "@/lib/site";
import {
  breadcrumbList,
  faqPage,
  learningResource,
  webApplication,
} from "@/lib/structured-data";
import { getAllVideos } from "@/lib/video-library";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

const OFFICIAL_ID = "p-11111111-2222-4333-8444-555555555555";
vi.mock("@/auth/library", () => ({
  getOfficialPractices: async () => [{ id: OFFICIAL_ID }],
}));

type Messages = Record<string, unknown>;
const MESSAGES: Record<string, Messages> = { "zh-Hant": zh, en };

/** A message by its dotted key, e.g. "learn.indexTitle". */
function message(messages: Messages, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Messages)?.[part], messages);
  if (typeof value !== "string") throw new Error(`missing message ${key}`);
  return value;
}

describe("language addresses (D167)", () => {
  it("puts zh-Hant at the clean URL and English at ?hl=en", () => {
    expect(localizedUrl("/", "zh-Hant")).toBe(`${SITE_URL}/`);
    expect(localizedUrl("/", "en")).toBe(`${SITE_URL}/?hl=en`);
    expect(localizedUrl("/learn/travel", "en")).toBe(
      `${SITE_URL}/learn/travel?hl=en`,
    );
    expect(languageAlternates("/faq")).toEqual({
      "zh-Hant": `${SITE_URL}/faq`,
      en: `${SITE_URL}/faq?hl=en`,
      "x-default": `${SITE_URL}/faq`,
    });
  });

  it("lets ?hl= win over the cookie and the browser for one request", () => {
    expect(
      detectLocale({ override: "en", cookie: "zh-Hant", acceptLanguage: "zh" }),
    ).toBe("en");
    expect(
      detectLocale({ override: "fr", cookie: "zh-Hant", acceptLanguage: "en" }),
    ).toBe("zh-Hant");
    expect(detectLocale({ override: null, acceptLanguage: "en-US" })).toBe(
      "en",
    );
  });

  it("points each language's canonical at itself, with hreflang", () => {
    const input = {
      path: "/learn/travel",
      title: "T",
      description: "D",
      siteName: "ListenLoop",
    };
    const zhMeta = seoMetadata({ ...input, locale: "zh-Hant" });
    const enMeta = seoMetadata({ ...input, locale: "en" });
    expect(zhMeta.alternates?.canonical).toBe(`${SITE_URL}/learn/travel`);
    expect(enMeta.alternates?.canonical).toBe(`${SITE_URL}/learn/travel?hl=en`);
    expect(enMeta.alternates?.languages).toEqual(
      languageAlternates("/learn/travel"),
    );
    expect(enMeta.openGraph).toMatchObject({
      url: `${SITE_URL}/learn/travel?hl=en`,
      locale: "en_US",
    });
    expect(enMeta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("gives a one-language article one address in every interface", () => {
    const meta = seoMetadata({
      path: "/blog/x",
      title: "T",
      description: "D",
      siteName: "ListenLoop",
      locale: "en",
      contentLocale: "zh-Hant",
      type: "article",
      publishedTime: "2026-11-13",
    });
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/blog/x`);
    expect(meta.alternates?.languages).toEqual({
      "zh-Hant": `${SITE_URL}/blog/x`,
      "x-default": `${SITE_URL}/blog/x`,
    });
    expect(meta.openGraph).toMatchObject({ type: "article", locale: "zh_TW" });
  });
});

describe("titles and descriptions (D167)", () => {
  for (const [locale, messages] of Object.entries(MESSAGES)) {
    it(`are unique across public pages, topics, and articles (${locale})`, () => {
      const pages = [
        ...PUBLIC_PAGES.map((page) => ({
          path: page.path,
          title: message(messages, page.title),
          description: message(messages, page.description),
        })),
        ...LEARN_CATEGORIES.map((category) => ({
          path: learnPath(category),
          title: message(messages, "learn.pageTitle").replace(
            "{name}",
            message(messages, `categories.names.${category}`),
          ),
          description: message(messages, `learn.intros.${category}`),
        })),
        ...BLOG_POSTS.map((post) => ({
          path: blogPath(post.slug),
          title: post.title,
          description: post.description,
        })),
      ];
      const titles = pages.map((p) => p.title);
      const descriptions = pages.map((p) => p.description);
      expect(new Set(titles).size, "duplicate title").toBe(titles.length);
      expect(new Set(descriptions).size, "duplicate description").toBe(
        descriptions.length,
      );
      for (const page of pages) {
        expect(page.title.length, page.path).toBeGreaterThan(1);
        expect(page.description.length, page.path).toBeGreaterThan(15);
        // Longer descriptions are cut off in search results.
        expect(page.description.length, page.path).toBeLessThanOrEqual(260);
      }
    });
  }

  it("every public page has a page file", () => {
    for (const { path } of PUBLIC_PAGES) {
      const file = path === "/" ? "app/page.tsx" : `app${path}/page.tsx`;
      expect(existsSync(file), file).toBe(true);
    }
  });
});

describe("sitemap and robots (D167)", () => {
  it("lists public pages, topics, articles, and indexable materials", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const { path } of PUBLIC_PAGES) {
      expect(urls).toContain(localizedUrl(path, "zh-Hant"));
    }
    expect(urls).toContain(`${SITE_URL}/faq`);
    for (const category of LEARN_CATEGORIES) {
      expect(urls).toContain(`${SITE_URL}${learnPath(category)}`);
    }
    for (const post of BLOG_POSTS) {
      expect(urls).toContain(`${SITE_URL}${blogPath(post.slug)}`);
    }
    for (const video of getAllVideos()) {
      expect(urls).toContain(`${SITE_URL}/videos/${video.id}`);
    }
    expect(urls).toContain(`${SITE_URL}/videos/${OFFICIAL_ID}`);
    // Never a private page or a practice step.
    for (const url of urls) {
      const path = new URL(url).pathname;
      for (const prefix of PRIVATE_PATHS.filter((p) => !p.includes("*"))) {
        expect(path.startsWith(prefix), url).toBe(false);
      }
      expect(path).not.toMatch(/\/videos\/[^/]+\/(day|handout|listen|quiz)/);
    }
    // Every page in both languages, but articles in their own only.
    const faq = entries.find((e) => e.url === `${SITE_URL}/faq`);
    expect(faq?.alternates?.languages).toEqual(languageAlternates("/faq"));
    const post = entries.find((e) =>
      e.url.endsWith(blogPath(BLOG_POSTS[0].slug)),
    );
    expect(post?.alternates).toBeUndefined();
  });

  it("keeps crawlers out of private pages and points to the sitemap", async () => {
    const { default: robots } = await import("@/app/robots");
    const rules = robots();
    expect(rules.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    const disallow = [rules.rules].flat()[0]?.disallow;
    for (const path of ["/admin", "/account", "/api/", "/videos/*/day/"]) {
      expect(disallow).toContain(path);
    }
    // Public pages stay crawlable.
    for (const { path } of PUBLIC_PAGES) {
      expect(
        PRIVATE_PATHS.some((p) => !p.includes("*") && path.startsWith(p)),
        path,
      ).toBe(false);
    }
  });

  it("indexes official materials and built-in videos, not learners' own", () => {
    expect(isIndexableMaterial({ id: "sintel", youtubeId: "abc" })).toBe(true);
    expect(isIndexableMaterial({ id: OFFICIAL_ID, official: true })).toBe(true);
    // A learner's practice made from a YouTube video.
    expect(isIndexableMaterial({ id: OFFICIAL_ID, youtubeId: "abc" })).toBe(
      false,
    );
    expect(isIndexableMaterial({ id: OFFICIAL_ID })).toBe(false);
  });
});

describe("site verification (D167)", () => {
  it("adds a tag only for the tokens that are set", () => {
    expect(siteVerification({})).toBeUndefined();
    expect(siteVerification({ GOOGLE_SITE_VERIFICATION: " g " })).toEqual({
      google: "g",
    });
    expect(siteVerification({ BING_SITE_VERIFICATION: "b" })).toEqual({
      other: { "msvalidate.01": "b" },
    });
  });
});

describe("structured data (D167)", () => {
  it("escapes text that could close the script element", () => {
    const text = serializeJsonLd({
      name: "</script><script>alert(1)</script> &  ",
    });
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(text).not.toContain("&");
    expect(text).not.toContain(" ");
    expect(JSON.parse(text)).toEqual({
      name: "</script><script>alert(1)</script> &  ",
    });
  });

  it("describes the app, a material, a FAQ, and breadcrumbs", () => {
    expect(
      webApplication({ name: "ListenLoop", description: "d", url: "u" }),
    ).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      applicationCategory: "EducationalApplication",
      offers: { "@type": "Offer", price: "0" },
    });
    expect(
      learningResource({
        name: "A",
        url: "u",
        provider: "ListenLoop",
        level: "beginner",
        seconds: 95,
      }),
    ).toMatchObject({
      "@type": "LearningResource",
      inLanguage: "en",
      educationalLevel: "Beginner",
      timeRequired: "PT2M",
      provider: { "@type": "Organization", name: "ListenLoop" },
    });
    expect(
      breadcrumbList([
        { name: "Home", url: "a" },
        { name: "Page", url: "b" },
      ]).itemListElement,
    ).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "a" },
      { "@type": "ListItem", position: 2, name: "Page", item: "b" },
    ]);
    const faq = faqPage([{ question: "Q?", answer: "A." }]);
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "Q?",
      acceptedAnswer: { "@type": "Answer", text: "A." },
    });
  });

  it("has every FAQ question and answer in both languages", () => {
    expect(FAQ_IDS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(FAQ_IDS).size).toBe(FAQ_IDS.length);
    for (const messages of Object.values(MESSAGES)) {
      for (const group of FAQ_GROUPS) {
        expect(message(messages, `faq.groups.${group.id}`)).toBeTruthy();
      }
      for (const id of FAQ_IDS) {
        expect(message(messages, `faq.items.${id}.question`)).toBeTruthy();
        expect(message(messages, `faq.items.${id}.answer`)).toBeTruthy();
      }
    }
  });

  it("keeps the FAQ to current features (no YouTube links, no email)", () => {
    for (const messages of Object.values(MESSAGES)) {
      const text = JSON.stringify((messages as { faq: unknown }).faq);
      expect(text).not.toMatch(/youtube/i);
      expect(text).not.toMatch(/電子報|email reminder|newsletter|Email 提醒/i);
    }
  });
});

describe("internal links (D167)", () => {
  it("every exam and topic cluster has articles", () => {
    for (const topic of ["exam", "daily-life", "campus", "study-abroad"]) {
      expect(postsForTopic(topic).length, topic).toBeGreaterThan(0);
    }
    expect(postsForTopic(null)).toEqual([]);
    const exam = postsForTopic("exam");
    expect(exam.map((p) => p.published)).toEqual(
      [...exam.map((p) => p.published)].sort().reverse(),
    );
  });
});

describe("share images (D167)", () => {
  it("keeps only text the image font can draw", () => {
    expect(ogText("Rock ’n’ Roll — “Live”｜中文")).toBe(
      "Rock 'n' Roll - \"Live\"",
    );
    expect(ogText("a".repeat(100), 20)).toBe(`${"a".repeat(17)}...`);
  });
});
