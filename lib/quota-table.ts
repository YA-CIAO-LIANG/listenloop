import { TRANSCRIBE_MONTHLY_SECONDS } from "./ai/pricing";
import { CLASS_TIERS } from "./classroom";
import { FEEDBACK_PER_DAY } from "./feedback";
import { REPORT_LIMITS } from "./moderation";
import {
  accountPlanFor,
  PLAN_LINES,
  PLAN_TIERS,
  PLANS,
  type PlanId,
  type PlanLimits,
} from "./plans";
import { RATE_LIMITS } from "./rate-limits";
import { UPLOAD_LIMITS } from "./upload-audio";
import {
  classCostRows,
  JOE_ESTIMATES,
  listeningCostPerMinute,
  MEASURED_LISTENING,
  personalCostRows,
  UNIT_COSTS,
  VOICE_PRICES,
  WRITING_TOKENS,
} from "./payments/costs";
import { WORDS_PER_MINUTE } from "./units";
import { DEFAULT_USAGE_SETTINGS, dailyCostLimit } from "./usage";

/**
 * The quota table in docs/quotas.md (D161), made from the settings the
 * code uses, so the document can't drift: tests/quotas-doc.test.ts
 * checks the document contains exactly this table.
 */
const TIER_NAMES = { student: "學生", plus: "Plus", pro: "Pro" } as const;
const LINE_NAMES = {
  listening: "聽力",
  writing: "寫作",
  all: "全方位",
} as const;

const COLUMNS: readonly (readonly [string, Column])[] = [
  ["免費", "free"],
  ...PLAN_LINES.flatMap((line) =>
    PLAN_TIERS.map(
      (tier) =>
        [
          `${TIER_NAMES[tier]}・${LINE_NAMES[line]}`,
          accountPlanFor(line, tier),
        ] as const,
    ),
  ),
  ["班級（老師）", "class"],
  ["管理員", "admin"],
];

type Column = PlanId | "class";

const usd = (micros: number) => `US$${(micros / 1e6).toFixed(2)}`;
const none = "—";
const unlimited = "不限";
const num = (n: number) => n.toLocaleString("en-US");

function limitsOf(column: Column): PlanLimits {
  if (column !== "class") return PLANS[column];
  // A teacher's class plan brings its own monthly words (D103, D210), and
  // otherwise their own plan applies; shown here on free.
  return {
    ...PLANS.free,
    wordsPerWeek: null,
    // Shown as each size's words by `minutes` below (D173).
    wordsPerMonth: CLASS_TIERS[1].words,
    maxPracticeSeconds: Math.max(PLANS.free.maxPracticeSeconds ?? 0, 300),
  };
}

function minutes(l: PlanLimits, column?: Column): string {
  if (column === "class") {
    return `每月 ${CLASS_TIERS.map((tier) => num(tier.words)).join("／")} 字（小班／標準班／大班，聽力與全方位）`;
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
    `- 班級方案：${CLASS_TIERS.map((tier) => `${tier.seats} 位學生`).join("／")}（小班／標準班／大班）；寫作與全方位的班級，每位學生每週 ${CLASS_TIERS.map((tier) => `${tier.perStudent.essaysPerWeek} 篇批改、${tier.perStudent.backChecksPerWeek} 組額外練習${tier.perStudent.chatMessagesPerWeek ? `、${tier.perStudent.chatMessagesPerWeek} 則聊天` : ""}`).join("／")}（和學生自己的方案取較多的）。`,
  ].join("\n");
}

const nt = (n: number, digits = 2) => `NT$${n.toFixed(digits)}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * The cost section of docs/quotas.md (D210): unit costs before and after
 * calibrating, and each plan's cost at full and typical use against its
 * cap, made from lib/payments/costs.ts.
 */
export function costTableMarkdown(): string {
  const u = UNIT_COSTS;
  const m = MEASURED_LISTENING;
  const languageUsd = Object.values(m.languageUsd).reduce((a, b) => a + b, 0);
  const tokens = (t: { input: number; output: number }) =>
    `${t.input.toLocaleString("en-US")} 輸入／${t.output.toLocaleString("en-US")} 輸出 tokens`;
  const units = [
    "| 單位 | Joe 的估算 | 校正後 | 依據 |",
    "| --- | --- | --- | --- |",
    `| 自建聽力：每 ${WORDS_PER_MINUTE} 字（約 1 分鐘）合計 | ${nt(JOE_ESTIMATES.listeningPerMinute)} | ${nt(listeningCostPerMinute())} | AI 文字＋語音 |`,
    `| 自建聽力的 AI 文字（講解、翻譯、斷句、生成） | — | ${nt(u.listeningTextPerWord * WORDS_PER_MINUTE)} | 正式站紀錄 US$${languageUsd.toFixed(4)} ÷ ${m.words.toLocaleString("en-US")} 字 |`,
    `| 自建聽力的語音 | — | ${nt(u.listeningVoicePerWord * WORDS_PER_MINUTE)} | 語音合成每字 ${(m.speechChars / m.words).toFixed(2)} 字元 × US$${VOICE_PRICES.ttsUsdPerMillionChars}／百萬字元，和語音轉文字 US$${VOICE_PRICES.sttUsdPerHour}／小時取較高者 |`,
    `| 作文 AI 批改：每篇 | ${nt(JOE_ESTIMATES.essay)} | ${nt(u.essay, 3)} | ${tokens(WRITING_TOKENS.essay)} |`,
    `| 額外練習 AI 批改：每組 | ${nt(JOE_ESTIMATES.backCheck)} | ${nt(u.backCheck, 3)} | ${tokens(WRITING_TOKENS.backCheck)} |`,
    `| 聊天：每則 | ${nt(JOE_ESTIMATES.chatMessage)} | ${nt(u.chatMessage, 3)} | ${tokens(WRITING_TOKENS.chatMessage)} |`,
  ];
  const rows = [
    "| 方案 | 月繳 | 年繳每月平均 | 用滿額度 | 一般使用（30%） | 一般使用（50%） | 上限 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...[...personalCostRows(), ...classCostRows(CLASS_TIERS)].map(
      (r) =>
        `| ${r.id} | NT$${r.monthly} | ${nt(r.base, 1)} | ${nt(r.fullCost)}（${pct(r.fullShare)}） | ${r.typical
          .map((t) => `${nt(t.cost)}（${pct(t.share)}）`)
          .join(" | ")} | ${pct(r.cap)} |`,
    ),
  ];
  return [...units, "", ...rows].join("\n");
}
