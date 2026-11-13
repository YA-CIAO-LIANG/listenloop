import type { MarketingDoc } from "../docx-builder.mts";
import { FREE_LINE, PAID_STATUS, PRICES, SITE } from "./facts.mts";

const shots: [string, string][] = [
  ["01-home", "首頁（未登入）：主標語、7 天循環三步驟"],
  ["02-library", "官方教材庫與篩選（主題、程度、長度、口音）"],
  ["03-dictation-result", "第 1 天聽寫結果：漏聽的字有底線、多打的有刪除線"],
  ["04-handout", "雙語講義：英中對照、單字、文法、螢光筆標示聽錯的字"],
  ["05-analytics", "學習分析：連續天數、每日練習時間"],
  ["06-create", "建立教材：貼上文字或請 AI 依主題寫一段"],
  [
    "07-admin",
    "管理後台總覽（給投資人、比賽評審看營運面時使用；不放在一般宣傳）",
  ],
];

export const pressKit: MarketingDoc = {
  file: "07-媒體資料包",
  title: "媒體資料包",
  subtitle: "產品簡介、創辦人介紹（待填）、截圖清單、常見問題",
  summary:
    "給媒體、部落客、比賽主辦單位：一句話與 100 字簡介（中英）、功能與方案、創辦人介紹（待 Joe 填寫）、截圖清單、Logo 用法、常見問題。",
  blocks: [
    {
      note: "給媒體、部落客、比賽主辦單位使用。黃底〔 〕的欄位請 Joe 填寫；「創辦人介紹」整段都是待填的範本，寄出前一定要改成自己的版本。",
    },
    { h1: "1. 產品簡介" },
    { h2: "一句話" },
    {
      copy: "ListenLoop 是給台灣學生的英文聽力練習網站：一段英文練 7 天，第 1 天聽寫、第 2～6 天跟讀、第 7 天再聽寫，和第 1 天比較，讓進步看得見。",
    },
    { h2: "100 字簡介" },
    {
      copy: "很多人英文聽得懂大意，卻不確定每個字。ListenLoop 用一週的節奏練熟一段英文：第 1 天逐字聽寫找出漏聽的字，第 2～6 天跟讀熟悉語速，第 7 天用同一份教材再測一次，和第 1 天比較。聽錯的字會在 1、3、7 天後回來複習。官方教材免費，涵蓋生活、留學、職場與考試風格的原創練習。",
    },
    { h2: "English (100 words)" },
    {
      copy: "Many learners get the gist of spoken English without being sure of every word. ListenLoop gives one clip a week-long rhythm: word-by-word dictation on Day 1 reveals what you missed, shadowing on Days 2–6 builds speed, and on Day 7 you take the same clip again and compare. Missed words come back for review 1, 3, and 7 days later. Official lessons are free and cover daily life, studying abroad, work, and original exam-style listening, with bilingual notes on vocabulary, grammar, and why a phrase is hard to hear.",
    },
    { h2: "重點資訊" },
    {
      table: {
        columns: [
          ["項目", 1],
          ["內容", 3],
        ],
        rows: [
          ["網站", SITE],
          ["形式", "網頁版（可加入手機主畫面使用）；Google Play 版準備中"],
          ["介面語言", "繁體中文、英文"],
          [
            "登入",
            "不用登入也能練；用 Google、LINE 或 Email 登入後，進度同步到雲端",
          ],
          [
            "官方教材",
            "〔請填：上線時的官方教材數量〕份，含 Blender 開放電影 Sintel 片段（CC BY）",
          ],
          ["價格", `${FREE_LINE}${PAID_STATUS}`],
          ["目前階段", "Beta 測試中（〔請填：Beta 開始日期〕起）"],
          [
            "使用者數、完成 7 天循環的人數",
            "〔上線後依後台數字填寫，不要估計〕",
          ],
        ],
      },
    },
    { h2: "主要功能" },
    {
      bullets: [
        "**7 天循環**：第 1 天聽寫、第 2～6 天跟讀（瀏覽器語音辨識）、第 7 天再聽寫並與第 1 天逐句比較。",
        "**逐字對答案**：漏聽、聽錯、多打的字分別標示（底線、刪除線，不只靠顏色）；數字的不同寫法視為相同。",
        "**雙語講義**：第 1 天完成後開放，中英對照、單字、文法，可輸出 PDF。",
        "**我的錯字**：聽錯的字在 1、3、7 天後回到今日任務，在原句挖空複習。",
        "**聆聽模式**、**單字測驗**、**程度測驗**、**學習分析與練習日曆**、**練習提醒（瀏覽器通知）**。",
        "**建立自己的教材**：貼上中文或英文文字，或請 AI 依主題寫一段，選擇美、英、澳、印口音的聲音，變成有講義的 7 天練習。",
        "**公開分享**：使用者可以把自己的教材設為公開；免費方案可以預覽，完整練習是付費功能。有檢舉與下架機制。",
        "**班級**：老師建立班級、指派教材、查看學生進度（班級方案即將推出）。",
      ],
    },
    { h2: "方案（即將推出，尚未收費）" },
    {
      table: {
        columns: [
          ["方案", 1],
          ["價格", 2],
          ["內容", 4],
        ],
        rows: [
          [
            "免費",
            "NT$0",
            "所有官方教材與功能、基本學習分析，每週建立 2 分鐘自己的教材",
          ],
          [
            "Plus",
            PRICES.plus,
            "每月建立 40 分鐘、上傳自己的錄音建立教材、語速調整、完整學習分析、自訂通關條件、完整練習公開教材",
          ],
          [
            "學生方案",
            PRICES.student,
            "Plus 的全部內容；用學校信箱的 Google 帳號登入自動認證，有效一年",
          ],
          [
            "Pro",
            PRICES.pro,
            "每月建立 120 分鐘、單份最長 10 分鐘、優先產生、批次 PDF，以及 Plus 的全部功能",
          ],
          [
            "班級",
            "〔開放時公布〕",
            "班級、作業、進度後台、CSV 匯出、公告；每班最多 40 位學生",
          ],
        ],
      },
    },
    { h1: "2. 創辦人介紹（範本，請 Joe 改寫）" },
    {
      note: "以下整段是範本，不是事實。請換成你自己的姓名、身分與故事，刪掉不適用的句子。",
    },
    {
      copy: "〔姓名〕，〔學校／系所／身分〕。〔一句話說你和英文的關係，例如：學英文多年，發現自己「聽得懂卻不確定」〕。於是把最有效但最麻煩的方法——聽寫與跟讀——做成每天 10～15 分鐘就能完成的 7 天課程。〔姓名〕以產品負責人身分主導需求、設計與驗收，並與 AI 開發工具（Claude Code）協作開發。〔選填：得獎、經歷、未來計畫〕",
    },
    {
      copy: "English: 〔Name〕, 〔school / role〕. 〔One line about you and English〕. 〔Name〕 turned dictation and shadowing, the most effective and most tedious listening methods, into a 7-day course of 10–15 minutes a day, leading requirements, design, and acceptance as product owner while building with Claude Code as an AI engineering partner.",
    },
    { p: "**照片**：〔請附一張創辦人照片的檔名或連結〕" },
    { h1: "3. 截圖清單" },
    {
      p: "檔案在專案的 `docs/portfolio/screenshots/`。每張都有四個版本：手機（390 px）或電腦（1366 px）、淺色或深色，2 倍解析度。檔名格式：`<編號>-<頁面>-<phone|laptop>-<light|dark>.png`。",
    },
    {
      table: {
        columns: [
          ["檔名開頭", 2],
          ["畫面", 5],
        ],
        rows: shots.map(([file, what]) => [`${file}-`, what]),
      },
    },
    {
      bullets: [
        "截圖裡的分數與練習紀錄是示範資料，不是真實使用者的成績，報導時請不要當成成效數據。",
        "影片畫面來自 Blender 基金會的開放電影，使用時請保留出處：© Blender Foundation，CC BY。",
        "其他素材：App 圖示 `docs/store/play-icon-512.png`、商店橫幅 `docs/store/feature-graphic.png`、網站圖示 `app/icon.svg`。",
      ],
    },
    { h1: "4. Logo 與名稱" },
    {
      bullets: [
        "名稱寫法：ListenLoop（一個字、兩個大寫 L）。",
        "品牌色：橘 #E8590C、墨黑 #141414、紙白 #FAFAF8。",
        "可以：報導、評論、教學介紹時使用 Logo 與截圖，可以等比例縮放。",
        "不可以：改變 Logo 的顏色、比例或圖形；用在暗示合作或背書的地方。詳見「品牌指南」。",
      ],
    },
    { h1: "5. 常見問題" },
    {
      table: {
        columns: [
          ["問題", 2],
          ["回答", 5],
        ],
        rows: [
          [
            "ListenLoop 是免費的嗎？",
            "官方教材與 7 天循環的所有練習功能都免費，免費方案每週還能建立 2 分鐘自己的教材。付費方案即將推出，目前沒有收費。",
          ],
          [
            "和一般英文聽力 App 有什麼不同？",
            "不是一次聽很多段，而是一段練 7 天：逐字聽寫找出漏聽的字、跟讀熟悉語速，第 7 天再測一次和第 1 天比較，讓進步變成數字。",
          ],
          [
            "適合什麼程度？",
            "初級到高級都有；不確定的話，先做 2～3 分鐘的程度測驗，網站會推薦第一份教材。",
          ],
          [
            "教材從哪裡來？",
            "官方教材是 ListenLoop 製作的原創內容（AI 產生後經過檢查），以及創用 CC 授權的影片（例如 Blender 開放電影），一律標示出處；不使用通訊社素材。",
          ],
          [
            "考試風格的教材是真題嗎？",
            "不是。多益、托福、雅思、全民英檢風格的練習只模仿題型與難度，是原創內容，和考試主辦單位無關。",
          ],
          [
            "跟讀會錄音嗎？",
            "不會。語音辨識由瀏覽器處理（在 Chrome 中會由 Google 的辨識服務處理），網站只保存念對的比例。",
          ],
          [
            "手機可以用嗎？",
            "可以，也能加入主畫面當 App 使用。跟讀建議使用電腦版 Chrome，辨識最穩定。",
          ],
          [
            "資料安全嗎？可以刪除帳號嗎？",
            "可以在帳號頁下載自己的資料、永久刪除帳號；不放廣告、不販售資料。詳見隱私權政策（/privacy）。",
          ],
          ["誰在開發？", "〔請填：創辦人或團隊，一句話〕"],
          ["媒體聯絡", "〔姓名〕〔Email〕"],
        ],
      },
    },
    { h1: "6. 聯絡方式" },
    {
      bullets: [
        "媒體聯絡：〔姓名〕〔Email〕",
        `網站：${SITE}`,
        "社群：〔Instagram〕〔Threads〕〔YouTube〕",
      ],
    },
  ],
};
