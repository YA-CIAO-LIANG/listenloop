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
];

export const blogPath = (slug: string) => `/blog/${slug}`;

export const findPost = (slug: unknown) =>
  BLOG_POSTS.find((post) => post.slug === slug) ?? null;

/** Where an article's text is (read on the server). */
export const blogFile = (slug: string) => `content/blog/${slug}.md`;
