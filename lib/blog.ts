import type { LearnCategory } from "./learn";

/**
 * Articles for search (D122): practical guides to English listening, in
 * Traditional Chinese (the people searching are students in Taiwan), each
 * linking to official materials. The text is in content/blog/<slug>.md;
 * the title, summary, date, and related topics are here.
 */
export type BlogPost = {
  slug: string;
  title: string;
  /** For search results and the list (about 80–120 characters). */
  description: string;
  /** YYYY-MM-DD. */
  published: string;
  /** Topics whose official materials are listed under the article. */
  topics: LearnCategory[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "listening-unclear-reasons",
    title: "英文聽力聽不清楚的 5 個原因（與對應練法）",
    description:
      "聽得懂大意卻不確定每個字？問題多半不是單字量，而是連音、弱讀、只練大意、語速和一直換素材。五個原因各有一個練法。",
    published: "2026-11-12",
    topics: ["daily-life", "travel"],
  },
  {
    slug: "connected-speech-rules",
    title: "英文連音規則完整整理：wanna、gonna、turn it off 怎麼聽",
    description:
      "子音接母音、相同子音念一次、t 的變化、wanna 與 gonna、did you 變「迪久」：五種最常見的英文連音規則，附例句與聽寫練法。",
    published: "2026-11-12",
    topics: ["casual-american", "relationships"],
  },
  {
    slug: "toeic-listening",
    title: "多益聽力怎麼練？卡在 350 分的一週練法",
    description:
      "多益聽力刷題分數不動？先把「確定度」練起來：用一段職場對話，第 1 天聽寫、第 2～6 天跟讀、第 7 天再聽寫，附注意重點與練習教材。",
    published: "2026-11-12",
    topics: ["exam", "business"],
  },
  {
    slug: "study-abroad-english",
    title: "留學前必練的生活英文：開戶、門號、租屋、看醫生",
    description:
      "出國第一週卡住的往往是生活英文。整理銀行開戶、辦手機、入住與看房、看醫生、校園的常見句子，每個情境附一份可以練的聽力教材。",
    published: "2026-11-12",
    topics: ["study-abroad", "health"],
  },
  {
    slug: "dictation-method",
    title: "英文聽寫練習法怎麼做？完整步驟與常見問題",
    description:
      "聽寫是最有效的聽力練習：選素材、逐句聽寫、對答案、找出錯的原因、跟讀後再聽寫。完整步驟、常見問題，以及從哪份教材開始。",
    published: "2026-11-12",
    topics: ["daily-life", "campus"],
  },
  // Keyword clusters from docs/seo-keywords.md (D167).
  {
    slug: "shadowing-method",
    title: "英文跟讀（shadowing）怎麼練？步驟、常見錯誤與發音檢查",
    description:
      "跟讀是聽到一句就跟著念，同時練聽力與英文發音。四個步驟、三個常見錯誤，以及怎麼用語音辨識知道自己有沒有念對，附可以直接跟讀的教材。",
    published: "2026-11-13",
    topics: ["casual-american", "daily-life"],
  },
  {
    slug: "ielts-listening",
    title: "雅思聽力怎麼準備？只播一次的四個部分與一週練法",
    description:
      "雅思聽力只播一次，填空要寫對拼字與數字。整理四個部分在考什麼、容易失分的原因，以及用聽寫加跟讀練熟一段 Part 1 對話的一週練法。",
    published: "2026-11-13",
    topics: ["exam", "study-abroad"],
  },
  {
    slug: "toefl-listening",
    title: "托福聽力怎麼練？跟上學術講座與校園對話的方法",
    description:
      "托福聽力以校園對話和學術講座為主，長句與專有名詞讓人跟丟。整理托福聽力的特色、常見問題，以及用聽寫與跟讀練熟一段講座的一週練法。",
    published: "2026-11-13",
    topics: ["exam", "campus"],
  },
  {
    slug: "gept-listening",
    title: "全民英檢聽力準備：初級、中級常見題型與一週練法",
    description:
      "全民英檢聽力常因一兩個字沒聽清楚而選錯：thirteen 與 thirty、can 與 can't。整理常見題型、選錯的原因，以及每天 10～15 分鐘的練法。",
    published: "2026-11-13",
    topics: ["exam", "daily-life"],
  },
  {
    slug: "gsat-listening",
    title: "學測英聽怎麼準備？高中生每天 15 分鐘的英聽練法",
    description:
      "學測英聽成績分 A、B、C、F 四級。整理英聽的常見題型、高中生常見的問題，以及用同一段對話聽寫、跟讀、再聽寫的一週練法。",
    published: "2026-11-13",
    topics: ["exam", "campus"],
  },
];

export const blogPath = (slug: string) => `/blog/${slug}`;

export const findPost = (slug: unknown) =>
  BLOG_POSTS.find((post) => post.slug === slug) ?? null;

/** Where an article's text is (read on the server). */
export const blogFile = (slug: string) => `content/blog/${slug}.md`;

/**
 * Articles about a topic, newest first (D167): listed on that topic's
 * page and on its materials' pages, so links run both ways.
 */
export function postsForTopic(topic: string | null | undefined): BlogPost[] {
  if (!topic) return [];
  return BLOG_POSTS.filter((post) =>
    (post.topics as readonly string[]).includes(topic),
  ).sort((a, b) => b.published.localeCompare(a.published));
}
