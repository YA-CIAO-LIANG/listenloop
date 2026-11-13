import type { MarketingDoc } from "../docx-builder.mts";
import { SITE } from "./facts.mts";

const zh = {
  name: "ListenLoop：英文聽力練習｜7 天聽寫跟讀",
  short:
    "英文聽力 7 天循環：聽寫找出漏聽的字、跟讀練語速，第 7 天看見自己聽懂多少。",
  full: [
    "ListenLoop 是給台灣學生的英文聽力練習。不是一次聽很多，而是把同一段英文練 7 天，練到每個字都聽得清楚——每天 10～15 分鐘的每日英文習慣。",
    "",
    "【7 天循環】",
    "・第 1 天英文聽寫：逐句播放、打字，逐字對答案；漏聽、聽錯、多打的字都標出來。完成後看雙語講義：中英對照、英文單字、文法，可以輸出 PDF。",
    "・第 2～6 天跟讀：聽一句、念一句，語音辨識告訴你漏念哪些字，順便練英文發音。",
    "・第 7 天再聽寫一次，和第 1 天逐句比較，進步變成數字。",
    "・聽錯的字會在 1、3、7 天後回到今日任務，在原句裡挖空複習。",
    "",
    "【英聽教材】",
    "・官方教材免費：生活英文、旅遊、留學英文、校園、職場、新聞、科普、演講，以及多益聽力、托福聽力、雅思聽力、全民英檢、學測英文風格的原創練習（只模仿題型與難度，非真實考題，與考試主辦單位無關）。",
    "・英文會話與獨白，有美式、英式、澳洲、印度口音。",
    "・Blender 開放電影等創用 CC 授權影片，一律標示出處。",
    "・依主題、程度、長度、口音篩選；「我今天有幾分鐘」幫你挑長度剛好的教材。",
    "",
    "【更多練習】",
    "・程度測驗：2～3 分鐘找到適合的程度與第一份教材。",
    "・聆聽模式：三遍聽法（盲聽 → 英文 → 英中對照），可以單句或整篇循環。",
    "・單字測驗：聽音拼字、選出正確翻譯，先考你聽錯的字。",
    "・免手動練習：自動播放、自動收音，適合雙手不方便的時候。",
    "・學習分析與練習日曆：連續天數、每天練習時間。",
    "・練習提醒：每天在你選的時間通知你。",
    "",
    "【建立自己的教材】",
    "・貼上中文或英文文字，或請 AI 依主題寫一段，選擇美、英、澳、印口音的聲音，變成有講義的 7 天練習。免費方案每週可以建立 2 分鐘。",
    "・付費方案（即將推出，目前不收費）：每月建立更多教材、上傳自己的錄音建立教材、語速調整、完整學習分析，以及完整練習其他學習者公開分享的教材。",
    "",
    "【其他】",
    "・不用登入也能學英文；用 Google、LINE 或 Email 登入後，手機和電腦同步進度。",
    "・深色模式、背景主題、中英文介面。",
    "・不放廣告，不販售資料；跟讀不錄音，可以隨時下載資料或刪除帳號。",
    "",
    "跟讀建議使用 Chrome，語音辨識最穩定。",
  ].join("\n"),
};

const en = {
  name: "ListenLoop: English Listening",
  short:
    "English listening in 7 days: dictate, shadow, and see how much more you hear.",
  full: [
    "ListenLoop is English listening practice for learners in Taiwan. Instead of listening to a lot once, you practice one clip for seven days until you can hear every word: a daily habit of about 10–15 minutes.",
    "",
    "Seven-day loop",
    "• Day 1, dictation: type each sentence and check every word; missed, misheard, and extra words are marked. Then read the bilingual handout with vocabulary and grammar, and save it as a PDF.",
    "• Days 2–6, shadowing: say each sentence back; speech recognition shows which words you missed, which also helps pronunciation.",
    "• Day 7, dictation again: compare with Day 1, sentence by sentence.",
    "• Missed words come back 1, 3, and 7 days later (spaced repetition), as gaps in the original sentence.",
    "",
    "Lessons",
    "• Free official lessons: everyday English, travel, study abroad, campus, work, news, science, talks, and original TOEIC-, TOEFL-, IELTS-, and GEPT-style listening (format and difficulty only; not real test items, not affiliated with the test makers).",
    "• Conversations and monologues with US, UK, Australian, and Indian accents.",
    "• Creative Commons films such as Blender's open movies, always credited.",
    "• Filter by topic, level, length, and accent, or by how many minutes you have today.",
    "",
    "More practice",
    "• Level test: find your level and first lesson in 2–3 minutes.",
    "• Listening mode: three passes (no subtitles, English, bilingual), with sentence or full-clip loops.",
    "• Vocabulary quiz: spell what you hear and pick the right translation, starting with words you missed.",
    "• Hands-free mode: automatic playback and listening.",
    "• Analytics and a practice calendar: streaks and daily minutes.",
    "• Daily practice reminders.",
    "",
    "Make your own lessons",
    "• Paste Chinese or English text, or let AI write a passage on a topic, pick a US, UK, Australian, or Indian voice, and get a 7-day lesson with notes. The free plan includes 2 minutes a week.",
    "• Paid plans (coming soon, not charged yet): more lessons a month, lessons from your own recordings, playback speed, full analytics, and full practice of lessons other learners share.",
    "",
    "Also",
    "• Practice without signing in; sign in with Google, LINE, or email to sync between phone and computer.",
    "• Dark mode, background themes, Chinese and English interface.",
    "• No ads; we don't sell data; shadowing is never recorded, and you can download your data or delete your account at any time.",
    "",
    "Chrome is recommended for shadowing.",
  ].join("\n"),
};

/** Play Console limits: 30, 80, and 4,000 characters. */
const LIMITS = { name: 30, short: 80, full: 4000 } as const;
for (const [lang, listing] of Object.entries({ zh, en })) {
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const length = [...listing[key]].length;
    if (length > LIMITS[key]) {
      throw new Error(`${lang} ${key}: ${length} > ${LIMITS[key]} characters`);
    }
  }
}

const count = (text: string) => [...text].length.toLocaleString("en-US");

const zhKeywords: [string, string, string][] = [
  ["英文聽力", "名稱、簡短說明", "核心需求，搜尋量最大"],
  ["聽力練習", "名稱", "動作型搜尋"],
  ["英文聽寫", "完整說明", "產品最獨特的方法"],
  ["跟讀", "簡短說明、完整說明", "第二個核心方法（shadowing）"],
  ["英聽", "（同義，Google 會比對）", "學生常用的簡稱"],
  ["多益聽力、多益", "完整說明", "大學生、上班族的大需求"],
  ["托福聽力", "完整說明", "留學需求"],
  ["雅思聽力", "完整說明", "留學需求（英國、澳洲）"],
  ["全民英檢", "完整說明", "國高中生需求"],
  ["學測英文", "完整說明", "高中生需求"],
  ["留學英文", "完整說明", "目標族群"],
  ["生活英文", "完整說明", "情境搜尋"],
  ["英文會話", "完整說明", "對話教材"],
  ["英文發音", "完整說明", "跟讀相關"],
  ["英文單字", "完整說明", "講義與單字測驗"],
  ["學英文", "完整說明", "泛用詞"],
  ["每日英文", "完整說明", "習慣型搜尋"],
  ["程度測驗", "完整說明", "新手的第一步"],
];

const enKeywords: [string, string, string][] = [
  ["English listening", "Name, short description", "Core need"],
  [
    "dictation",
    "Short description, full description",
    "Our distinctive method",
  ],
  ["shadowing", "Short description, full description", "Second core method"],
  ["TOEIC / TOEFL / IELTS listening", "Full description", "Exam audiences"],
  ["GEPT", "Full description", "Taiwan's exam"],
  ["learn English", "Full description", "Broad"],
  ["study abroad English", "Full description", "Target audience"],
  ["everyday English", "Full description", "Situation search"],
  ["English conversation", "Full description", "Dialogue lessons"],
  ["pronunciation", "Full description", "Shadowing"],
  ["vocabulary quiz", "Full description", "Quiz feature"],
  [
    "accents (US, UK, Australian, Indian)",
    "Full description",
    "Accent filter and voices",
  ],
  ["spaced repetition", "Full description", "Missed-word review"],
  ["level test", "Full description", "First step"],
];

export const playStore: MarketingDoc = {
  file: "09-Google-Play商店資料",
  title: "Google Play 商店資料",
  subtitle:
    "中英文名稱、簡短說明（80 字內）、完整說明（4,000 字內）與 ASO 關鍵字",
  summary:
    "Google Play 商店資訊：中英文 App 名稱、簡短說明（≤80 字）、完整說明（≤4,000 字）、ASO 關鍵字與寫法原則；字數由產生腳本檢查。",
  blocks: [
    {
      note: "依 2026-11-13 的功能與方案更新（YouTube 連結建立教材已暫停，不列入；付費方案寫「即將推出」）。正式填寫前請到 Play Console 確認最新規定。字數由產生腳本檢查，超過上限時無法產生這份文件。",
    },
    { h1: "1. 繁體中文（預設語言）" },
    { h2: `App 名稱（${count(zh.name)}／30 字）` },
    { copy: zh.name },
    { h2: `簡短說明（${count(zh.short)}／80 字）` },
    { copy: zh.short },
    { h2: `完整說明（${count(zh.full)}／4,000 字）` },
    { copy: zh.full },
    { h1: "2. English" },
    { h2: `App name (${count(en.name)}/30)` },
    { copy: en.name },
    { h2: `Short description (${count(en.short)}/80)` },
    { copy: en.short },
    { h2: `Full description (${count(en.full)}/4,000)` },
    { copy: en.full },
    { h1: "3. 其他欄位" },
    {
      table: {
        columns: [
          ["欄位", 2],
          ["內容", 5],
        ],
        rows: [
          ["應用程式類別", "教育（Education）"],
          ["標記", "語言學習"],
          ["聯絡 Email（必填，會公開）", "〔請 Joe 提供公開的聯絡信箱〕"],
          ["網站", SITE],
          ["隱私權政策", `${SITE}/privacy`],
          ["主題圖片（1024×500）", "`docs/store/feature-graphic.png`"],
          ["App 圖示（512×512）", "`docs/store/play-icon-512.png`"],
          [
            "截圖",
            "見 `docs/play-store.md` 第 4 節的清單（首頁、聽寫結果、講義、跟讀、第 7 天結果、教材庫、深色模式、英文介面）",
          ],
        ],
      },
    },
    { h1: "4. ASO 關鍵字" },
    {
      p: "Google Play 沒有獨立的關鍵字欄位：排名主要看 **App 名稱（30 字）、簡短說明（80 字）、完整說明（4,000 字）**，以及下載量、評分與留存。關鍵字要自然寫進這三處，不要堆砌（Google 會判定為垃圾內容）。",
    },
    { h2: "繁體中文" },
    {
      table: {
        columns: [
          ["關鍵字", 2],
          ["放在哪裡", 2],
          ["理由", 3],
        ],
        rows: zhKeywords,
      },
    },
    { h2: "English" },
    {
      table: {
        columns: [
          ["Keyword", 3],
          ["Where", 3],
          ["Why", 2],
        ],
        rows: enKeywords,
      },
    },
    { h2: "寫法原則與之後追蹤" },
    {
      bullets: [
        "名稱：品牌＋兩個最重要的詞（英文聽力、聽寫跟讀）。",
        "考試名稱一律加上「風格」「非真實考題」，避免誤導與商標問題；不使用考試 Logo。",
        "不寫評分、下載數、使用者見證等還沒有的數字。",
        "上架後每 1～2 個月看一次 Play Console 的「搜尋字詞」報表；用「商店資訊實驗」A/B 測試名稱與簡短說明；留意評論裡使用者自己怎麼形容產品。",
      ],
    },
  ],
};
