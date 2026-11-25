import { TRANSCRIBE_MONTHLY_SECONDS } from "./ai/pricing";
import { CLASS_TIERS } from "./classroom";
import { FEEDBACK_PER_DAY } from "./feedback";
import { REPORT_LIMITS } from "./moderation";
import { PLANS, type PlanLimits } from "./plans";
import { RATE_LIMITS } from "./rate-limits";
import { UPLOAD_LIMITS } from "./upload-audio";
import { DEFAULT_USAGE_SETTINGS, dailyCostLimit } from "./usage";
import { WORDS_PER_MINUTE } from "./units";

/**
 * The quota table in docs/quotas.md (D161), made from the settings the
 * code uses, so the document can't drift: tests/quotas-doc.test.ts
 * checks the document contains exactly this table.
 */
const COLUMNS = [
  ["免費", "free"],
  ["學生", "student"],
  ["Plus", "paid"],
  ["Pro", "pro"],
  ["班級（老師）", "class"],
  ["管理員", "admin"],
] as const;

type Column = (typeof COLUMNS)[number][1];

const usd = (micros: number) => `US$${(micros / 1e6).toFixed(2)}`;
const none = "—";
const unlimited = "不限";
const num = (n: number) => n.toLocaleString("en-US");

function limitsOf(column: Column): PlanLimits {
  if (column !== "class") return PLANS[column];
  // A teacher's class plan brings its own monthly minutes (D103), and
  // otherwise their own plan applies; shown here on Plus.
  return {
    ...PLANS.paid,
    // Shown as each tier's minutes by `minutes` below (D173).
    wordsPerMonth: CLASS_TIERS[1].minutes * WORDS_PER_MINUTE,
    maxPracticeSeconds: Math.max(PLANS.paid.maxPracticeSeconds ?? 0, 300),
  };
}

function minutes(l: PlanLimits, column?: Column): string {
  if (column === "class") {
    return `每月 ${CLASS_TIERS.map((tier) => num(tier.minutes * WORDS_PER_MINUTE)).join("／")} 字（小班／標準班／大班）`;
  }
  if (l.wordsPerWeek !== null) return `每週 ${num(l.wordsPerWeek)} 字`;
  if (l.wordsPerMonth !== null) return `每月 ${num(l.wordsPerMonth)} 字`;
  return unlimited;
}

const ROWS: [string, (l: PlanLimits, column: Column) => string, string][] = [
  ["AI 生成與建立教材", minutes, "每週一 00:00／每月 1 日 00:00"],
  [
    "每份教材最長",
    (l) =>
      l.maxPracticeSeconds === null
        ? unlimited
        : `${l.maxPracticeSeconds / 60} 分鐘`,
    "—",
  ],
  [
    "每份教材字數",
    (l) =>
      l.charsPerPractice === null
        ? unlimited
        : `${l.charsPerPractice.toLocaleString("en-US")} 字`,
    "—",
  ],
  [
    "語音轉文字（上傳錄音）",
    (l) =>
      l.uploadAudio
        ? `計入建立分鐘數；每段最長 ${UPLOAD_LIMITS.seconds / 60} 分鐘`
        : none,
    "同上",
  ],
  [
    "用指令修改",
    (l) =>
      l.revisesPerDay === null ? unlimited : `每天 ${l.revisesPerDay} 次`,
    "每天 00:00",
  ],
  [
    "AI 寫作批改（WritingLoop，D187）",
    (l) =>
      l.writingReviewsPerWeek === null
        ? unlimited
        : `每週 ${l.writingReviewsPerWeek} 次`,
    "每週一 00:00",
  ],
  [
    "聊天練習（WritingLoop，D197）",
    (l) =>
      l.chatMessagesPerWeek === null
        ? unlimited
        : `每週 ${l.chatMessagesPerWeek} 則`,
    "每週一 00:00",
  ],
  [
    "額外練習的 AI 批改（WritingLoop，D200）",
    (l) =>
      l.backChecksPerWeek === null
        ? unlimited
        : `每週 ${l.backChecksPerWeek} 組`,
    "每週一 00:00",
  ],
  [
    "每篇寫作字數",
    (l) =>
      l.writingWords === null
        ? unlimited
        : `${l.writingWords.toLocaleString("en-US")} 字`,
    "—",
  ],
  [
    "上傳檔案大小",
    (l) =>
      !l.uploadAudio
        ? none
        : l.uploadMegabytes === null
          ? `${UPLOAD_LIMITS.sourceBytes / 1024 / 1024} MB（技術上限）`
          : `${l.uploadMegabytes} MB`,
    "—",
  ],
  [
    "錄音總儲存空間",
    (l) =>
      !l.uploadAudio
        ? none
        : l.storageMegabytes === null
          ? unlimited
          : `${l.storageMegabytes} MB`,
    "刪除教材時釋出",
  ],
  [
    "教材數量",
    (l) =>
      l.practicesTotal !== null
        ? `累計 ${l.practicesTotal} 份`
        : l.practicesPerMonth !== null
          ? `每月 ${l.practicesPerMonth} 份`
          : "不限（受分鐘數限制）",
    "—",
  ],
  [
    "每天 AI 費用上限",
    (_l, column) =>
      usd(
        dailyCostLimit(
          DEFAULT_USAGE_SETTINGS,
          column === "class" ? "paid" : column,
          "manual",
        ),
      ),
    "每天 00:00（後台可調）",
  ],
  [
    "檢舉",
    () =>
      `每天 ${REPORT_LIMITS.perDay} 次、每小時 ${RATE_LIMITS.report.max} 次`,
    "每天／每小時",
  ],
  [
    "意見回饋",
    () => `每天 ${FEEDBACK_PER_DAY} 次、每小時 ${RATE_LIMITS.feedback.max} 次`,
    "每天／每小時",
  ],
  ["AI 操作速率", () => `每小時 ${RATE_LIMITS.ai.max} 次`, "每小時"],
];

export function quotaTableMarkdown(): string {
  const header = `| 項目 | ${COLUMNS.map(([name]) => name).join(" | ")} | 重設時間（台灣） |`;
  const rule = `| --- | ${COLUMNS.map(() => "---").join(" | ")} | --- |`;
  const lines = ROWS.map(
    ([name, value, reset]) =>
      `| ${name} | ${COLUMNS.map(([, column]) => value(limitsOf(column), column)).join(" | ")} | ${reset} |`,
  );
  return [header, rule, ...lines].join("\n");
}

/** Site-wide limits that apply to everyone together. */
export function siteLimitsMarkdown(): string {
  return [
    `- 全站每月 AI 費用上限：${usd(DEFAULT_USAGE_SETTINGS.siteMonthlyMicros)}（後台可調），達到時暫停一般使用者的 AI 功能，每月 1 日重設。`,
    `- 全站每月語音轉文字：${TRANSCRIBE_MONTHLY_SECONDS / 3600} 小時（Azure F0 免費 5 小時，留一點餘裕），每月 1 日重設。`,
    `- 班級方案：${CLASS_TIERS.map((tier) => `${tier.seats} 位學生`).join("／")}（小班／標準班／大班）；學生用自己的方案額度。`,
  ].join("\n");
}
