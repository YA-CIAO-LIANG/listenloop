/**
 * Facts every marketing document repeats, checked against the app on
 * 2026-11-13: plans in lib/plans.ts and docs/quotas.md, prices in
 * lib/payments/pricing.ts, features in lib/features.ts. Update here first
 * when a plan, price, or feature changes, then run npm run marketing:docx.
 */
export const SITE = "https://listenloop-three.vercel.app";
export const FEEDBACK = `${SITE}/feedback`;
export const LEVEL_TEST = `${SITE}/level-test`;

/** A tracked link: which channel and which post (see the launch plan). */
export const link = (source: string, content: string | number) =>
  `${SITE}/?utm_source=${source}&utm_content=${content}`;

export const PRICES = {
  plus: "NT$149／月（年繳 NT$1,490）",
  pro: "NT$299／月（年繳 NT$2,990）",
  student: "NT$90／月（年繳 NT$990）",
};

/** One line: what's free. */
export const FREE_LINE =
  "所有官方教材與 7 天循環的練習功能都免費；免費方案每週還能用 AI 建立 2 分鐘自己的教材。";

/** One line: where paid plans stand. */
export const PAID_STATUS =
  "付費方案（Plus、Pro、學生方案、班級方案）目前顯示「即將推出」，還沒有收費，可以加入等候名單。";

/**
 * Features that must not be promoted: paused or not built (D131: YouTube
 * links; no email sending service yet, so no email reminders or
 * newsletters; the aquarium is switched off; referrals are only a plan).
 */
export const DO_NOT_PROMOTE = [
  "貼 YouTube 連結建立教材（D131 已暫停）",
  "Email 提醒、電子報、寄信通知（目前沒有寄信服務；練習提醒是瀏覽器通知）",
  "魚缸、點數、買魚（M2.5 已關閉）",
  "推薦好友獎勵（只有規劃，尚未實作）",
  "付費方案的實際購買（尚未收費，只能加入等候名單）",
  "保證分數或「X 天多益幾分」這類承諾",
];
