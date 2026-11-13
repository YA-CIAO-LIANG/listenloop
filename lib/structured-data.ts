import { SITE_URL } from "./site";

/**
 * schema.org structured data (JSON-LD) for search engines (D167). Only
 * facts the page itself shows: no ratings, prices, or dates we don't have.
 */

const CONTEXT = "https://schema.org";

/** ListenLoop as the provider of every material and article. */
export const organization = (name: string) => ({
  "@type": "Organization",
  name,
  url: `${SITE_URL}/`,
});

/** The home page: the web app itself, free to use. */
export function webApplication(input: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    "@context": CONTEXT,
    "@type": "WebApplication",
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: ["zh-Hant", "en"],
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" },
  };
}

export type Crumb = { name: string; url: string };

/** Where the page sits: Home › Topic › This page. */
export function breadcrumbList(crumbs: readonly Crumb[]) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/** The FAQ page: every question with its answer, as the page shows them. */
export function faqPage(
  items: readonly { question: string; answer: string }[],
) {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

/** schema.org's educationalLevel names for our levels. */
const LEVEL_NAMES = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

/**
 * A material's page: a LearningResource rather than a Course, since a
 * Course needs an instance, schedule, and offer we'd have to invent (D167).
 */
export function learningResource(input: {
  name: string;
  description?: string | null;
  url: string;
  provider: string;
  level?: keyof typeof LEVEL_NAMES | null;
  /** Seconds of audio, when known. */
  seconds?: number | null;
  license?: string | null;
  sourceUrl?: string | null;
}) {
  return {
    "@context": CONTEXT,
    "@type": "LearningResource",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    inLanguage: "en",
    learningResourceType: "Listening practice",
    teaches: "English listening comprehension",
    educationalUse: ["dictation", "shadowing"],
    ...(input.level ? { educationalLevel: LEVEL_NAMES[input.level] } : {}),
    ...(input.seconds && input.seconds > 0
      ? { timeRequired: `PT${Math.max(1, Math.round(input.seconds / 60))}M` }
      : {}),
    isAccessibleForFree: true,
    provider: organization(input.provider),
    ...(input.license ? { license: input.license } : {}),
    ...(input.sourceUrl ? { isBasedOn: input.sourceUrl } : {}),
  };
}

/** An article (D122). */
export function blogPosting(input: {
  headline: string;
  description: string;
  url: string;
  published: string;
  publisher: string;
}) {
  return {
    "@context": CONTEXT,
    "@type": "BlogPosting",
    headline: input.headline,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    datePublished: input.published,
    inLanguage: "zh-Hant",
    author: organization(input.publisher),
    publisher: organization(input.publisher),
  };
}
